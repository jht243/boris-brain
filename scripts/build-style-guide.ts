import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../src/config.js";
import { complete } from "../src/llm.js";
import type { CorpusPost } from "../src/wp-client.js";
import { buildQuantifiedSection } from "../src/style-stats.js";

function samplePosts(posts: CorpusPost[], count: number): CorpusPost[] {
  if (posts.length <= count) return posts;
  const step = Math.floor(posts.length / count);
  const sampled: CorpusPost[] = [];
  for (let i = 0; i < posts.length && sampled.length < count; i += step) {
    sampled.push(posts[i]!);
  }
  return sampled;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required. Copy .env.example to .env and add your key.");
  }

  const posts = JSON.parse(fs.readFileSync(PATHS.corpus, "utf8")) as CorpusPost[];
  const sample = samplePosts(posts, 14);

  const corpusSample = sample
    .map((p, i) => `## Sample ${i + 1}: ${p.title}\nDate: ${p.date}\n\n${p.body.slice(0, 2500)}`)
    .join("\n\n---\n\n");

  console.log(`Analyzing ${sample.length} posts for the Axis style guide...`);

  const qualitative = await complete({
    system:
      "You analyze B2B SaaS / CRM-consulting blog writing and produce concrete, actionable style guides for LLM content generation. Be specific, not generic.",
    temperature: 0.2,
    maxTokens: 2500,
    user: `Analyze these blog posts from Axis Consulting, a CRM implementation and sales-automation consultancy (heavy on Pipedrive, Salesforce, HubSpot, PandaDoc, and workflow automation). Produce a Markdown style guide capturing SPECIFIC, DISTINCTIVE patterns, not generic blog advice.

Include sections:
1. Voice & Tone (1-2 distinguishing traits)
2. Typical Article Structure (the real section progression they use)
3. How they explain CRM/automation concepts to a non-technical sales audience
4. Recurring frameworks, analogies, and CTA patterns
5. Words and phrases to USE (over-indexed in THEIR writing)
6. Words and phrases to AVOID (generic SaaS filler + AI-tell words like "seamless", "robust", "leverage", "delve", "in conclusion")
7. CTA template pointing readers to Axis Consulting

The output articles must read human-written, NOT AI-generated: no em-dashes, no emojis. Reflect that in the guide. Skip headline lists and opening lists, those are appended separately.

POSTS:
${corpusSample}`,
  });
  if (!qualitative) throw new Error("Style guide generation returned empty");

  const quantified = buildQuantifiedSection(posts);
  const guide = `# Axis Consulting Style Guide\n\n${qualitative}\n\n---\n\n${quantified}`;

  fs.mkdirSync(path.dirname(PATHS.styleGuide), { recursive: true });
  fs.writeFileSync(PATHS.styleGuide, guide, "utf8");
  console.log(`Style guide saved → ${PATHS.styleGuide}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
