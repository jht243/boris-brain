import fs from "node:fs";
import path from "node:path";
import express from "express";
import OpenAI from "openai";
import { PATHS } from "./config.js";
import { draftArticle, reviseArticle } from "./generate.js";
import { scoreSeo } from "./seo.js";

// Preset topic grid for the dashboard. Each becomes a one-click "generate" button.
const PRESET_TOPICS: { label: string; topic: string; keyword: string }[] = [
  { label: "AI for Pipedrive", topic: "Using AI to improve CRM data in Pipedrive", keyword: "AI for Pipedrive" },
  { label: "AI for Salesforce", topic: "Using AI to improve CRM data in Salesforce", keyword: "AI for Salesforce" },
  { label: "AI for HubSpot", topic: "Using AI to improve CRM data in HubSpot", keyword: "AI for HubSpot" },
  { label: "AI for Zoho CRM", topic: "Using AI to improve CRM data in Zoho CRM", keyword: "AI for Zoho CRM" },
  { label: "AI for Zendesk", topic: "Using AI to improve customer data in Zendesk", keyword: "AI for Zendesk" },
  { label: "AI for Monday CRM", topic: "Using AI to improve CRM data in monday CRM", keyword: "AI for monday CRM" },
  { label: "Clean CRM Data with AI", topic: "Using AI to clean and standardize CRM data", keyword: "clean CRM data with AI" },
  { label: "AI Data Enrichment", topic: "Using AI for CRM contact and company data enrichment", keyword: "AI CRM data enrichment" },
  { label: "AI Deduplication", topic: "Using AI to find and merge duplicate CRM records", keyword: "AI CRM deduplication" },
  { label: "AI Lead Scoring", topic: "Using AI to score and prioritize CRM leads", keyword: "AI lead scoring CRM" },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export function createServer(client: OpenAI) {
  const app = express();
  app.use(express.json({ limit: "5mb" }));
  app.use(express.static(path.join(PATHS.root, "public")));

  app.get("/api/topics", (_req, res) => {
    res.json({ topics: PRESET_TOPICS });
  });

  // STAGE 1 — draft + score (no revision). Body: { topic, keyword? }
  // Kept fast/parallel so it finishes inside Render's request window.
  app.post("/api/generate", async (req, res) => {
    const { topic, keyword } = req.body as { topic?: string; keyword?: string };
    if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
      res.status(400).json({ error: "topic required" });
      return;
    }
    const outPath = path.join(PATHS.outputDir, `${Date.now()}-${slugify(keyword || topic)}.md`);
    try {
      const { draft, seo, sources } = await draftArticle(client, {
        topic: topic.trim(),
        keyword: keyword?.trim() || undefined,
        outputPath: outPath,
      });
      res.json({ draft, seo, sources, outputPath: path.relative(PATHS.root, outPath) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: String(err) });
    }
  });

  // STAGE 2 — one SEO revision pass on an existing draft. Body: { draft, keyword, outputPath? }
  // Separate request so the revision rewrite never stacks onto stage 1's time budget.
  app.post("/api/revise", async (req, res) => {
    const { draft, keyword, outputPath } = req.body as {
      draft?: string;
      keyword?: string;
      outputPath?: string;
    };
    if (typeof draft !== "string" || draft.length < 50) {
      res.status(400).json({ error: "draft required" });
      return;
    }
    // Only overwrite a path inside output/ (the draft we just generated).
    let outPath: string | undefined;
    if (outputPath && typeof outputPath === "string" && !outputPath.includes("..")) {
      const full = path.resolve(PATHS.root, outputPath);
      if (full.startsWith(PATHS.outputDir) && full.endsWith(".md")) outPath = full;
    }
    try {
      const result = await reviseArticle({
        draft,
        keyword: (keyword || "").trim(),
        outputPath: outPath,
      });
      res.json({
        draft: result.draft,
        seo: result.seo,
        outputPath: outPath ? path.relative(PATHS.root, outPath) : outputPath,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: String(err) });
    }
  });

  // Re-score edited content live. Body: { content, keyword }
  app.post("/api/seo", (req, res) => {
    const { content, keyword } = req.body as { content?: string; keyword?: string };
    if (typeof content !== "string") {
      res.status(400).json({ error: "content required" });
      return;
    }
    res.json({ seo: scoreSeo(content, keyword ?? "") });
  });

  app.get("/api/drafts", (_req, res) => {
    try {
      const samplesDir = path.join(PATHS.outputDir, "samples");
      // Real drafts live in output/; "dummy"/sample drafts live in output/samples/.
      const collect = (dir: string, sample: boolean) => {
        if (!fs.existsSync(dir)) return [];
        return fs
          .readdirSync(dir)
          .filter((f) => f.endsWith(".md"))
          .map((f) => {
            const full = path.join(dir, f);
            const stat = fs.statSync(full);
            let title = f.replace(/\.md$/, "");
            try {
              const head = fs.readFileSync(full, "utf8").split("\n").slice(0, 3).join("\n");
              const m = head.match(/^#\s+(.+)$/m);
              if (m && m[1]) title = m[1].trim();
            } catch {}
            return {
              path: path.relative(PATHS.root, full),
              name: f,
              title,
              mtime: stat.mtime.toISOString(),
              sample,
            };
          });
      };
      const drafts = [...collect(PATHS.outputDir, false), ...collect(samplesDir, true)]
        .sort((a, b) => (a.mtime < b.mtime ? 1 : -1))
        .slice(0, 30);
      res.json({ drafts });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/draft", (req, res) => {
    const rel = String(req.query.path ?? "");
    if (!rel || rel.includes("..")) {
      res.status(400).json({ error: "invalid path" });
      return;
    }
    const full = path.resolve(PATHS.root, rel);
    if (!full.startsWith(PATHS.outputDir)) {
      res.status(403).json({ error: "outside output dir" });
      return;
    }
    if (!fs.existsSync(full)) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json({ path: rel, content: fs.readFileSync(full, "utf8") });
  });

  app.post("/api/draft/save", (req, res) => {
    const { path: rel, content } = req.body as { path?: string; content?: string };
    if (!rel || typeof rel !== "string" || rel.includes("..")) {
      res.status(400).json({ error: "invalid path" });
      return;
    }
    if (typeof content !== "string") {
      res.status(400).json({ error: "content must be a string" });
      return;
    }
    const full = path.resolve(PATHS.root, rel);
    if (!full.startsWith(PATHS.outputDir) || !full.endsWith(".md")) {
      res.status(403).json({ error: "invalid target" });
      return;
    }
    try {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, "utf8");
      res.json({ ok: true, savedAt: fs.statSync(full).mtime.toISOString() });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return app;
}
