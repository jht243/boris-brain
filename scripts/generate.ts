import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { PATHS } from "../src/config.js";
import { generateArticle } from "../src/generate.js";
import { renderSeoText } from "../src/seo.js";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function parseArgs(): { topic: string; keyword?: string; output: string } {
  const args = process.argv.slice(2);
  let topic = "";
  let keyword = "";
  let output = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--topic" && args[i + 1]) topic = args[++i]!;
    else if (args[i] === "--keyword" && args[i + 1]) keyword = args[++i]!;
    else if (args[i] === "--output" && args[i + 1]) output = args[++i]!;
    else if (!topic && !args[i]!.startsWith("--")) topic = args[i]!;
  }

  if (!topic) {
    console.error('Usage: npm run generate -- --topic "AI for Pipedrive" [--keyword "..."] [--output path.md]');
    process.exit(1);
  }
  if (!output) output = path.join(PATHS.outputDir, `${Date.now()}-${slugify(topic)}.md`);
  return { topic, keyword: keyword || undefined, output };
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required. Copy .env.example to .env and add your key.");
  }
  for (const required of [PATHS.corpus, PATHS.embeddings, PATHS.styleGuide]) {
    if (!fs.existsSync(required)) throw new Error(`Missing ${required}. Run: npm run setup`);
  }

  const { topic, keyword, output } = parseArgs();
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  console.log(`Generating article: "${topic}"\n`);
  const { draft, seo } = await generateArticle(client, { topic, keyword, outputPath: output });

  console.log(`\nDraft saved → ${output}\n`);
  console.log("--- SEO Report ---");
  console.log(renderSeoText(seo));
  console.log("\n--- Preview (first 700 chars) ---\n");
  console.log(draft.slice(0, 700) + "...");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
