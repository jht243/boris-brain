import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export const PATHS = {
  root,
  corpus: path.join(root, "data/corpus/posts.json"),
  corpusDir: path.join(root, "data/corpus/posts"),
  embeddings: path.join(root, "data/embeddings/index.json"),
  styleGuide: path.join(root, "prompts/axis-style.md"),
  systemPrompt: path.join(root, "prompts/system.md"),
  outputDir: path.join(root, "output"),
};

// Axis Consulting — CRM & sales-automation consultancy (WordPress + Yoast).
export const BRAND = {
  name: "Axis Consulting",
  site: "https://www.axisconsulting.io",
  // Phone / CTA destination shown in generated CTAs. Adjust as needed.
  ctaUrl: "https://www.axisconsulting.io/contact",
  tagline: "CRM implementation, workflow automation, and revenue operations",
};

export const WP_BASE = "https://axisconsulting.io/wp-json/wp/v2";
// Ingest the whole blog (no single-author filter — Axis publishes under several authors).
export const CORPUS_LIMIT = 200;

// Embeddings stay on OpenAI (used only to build/query the RAG index).
export const EMBEDDING_MODEL = "text-embedding-3-small";

// Article generation runs on Anthropic Claude. Sonnet 4.6 is much faster than Opus per call,
// which keeps a full multi-call generation inside Render's request window, with near-Opus quality.
export const GENERATION_MODEL = "claude-sonnet-4-6";
