import fs from "node:fs";
import OpenAI from "openai";
import { BRAND, PATHS } from "./config.js";
import { complete, completeJson } from "./llm.js";
import { retrieveSimilar, retrieveFullPosts, type IndexedChunk } from "./rag.js";
import { scoreSeo, type SeoReport } from "./seo.js";

const TEMP = 0.5;

export interface GenerateOptions {
  /** Human topic, e.g. "AI for Pipedrive" or "Using AI to clean Salesforce data". */
  topic: string;
  /** Primary SEO keyword. Defaults to the topic. */
  keyword?: string;
  outputPath?: string;
}

export interface GenerateResult {
  draft: string;
  seo: SeoReport;
}

interface ArticlePlan {
  title: string;
  metaDescription: string;
  intro: string;
  sections: { h2: string; guidance: string }[];
  faqs: { q: string }[];
}

const RULES =
  "Hard voice rules: NO em-dashes (—), NO en-dashes (–), NO emojis, and NO AI-tell filler " +
  '("in conclusion", "moreover", "furthermore", "delve", "seamless", "robust", "leverage/leveraging" as filler, ' +
  '"game-changer", "ever-evolving", "it\'s important to note"). Vary sentence length. ' +
  "Write like a human RevOps consultant, plain and specific.";

function renderExemplars(posts: { title: string; body: string }[]): string {
  return posts
    .map((p, i) => `### Exemplar ${i + 1}: ${p.title}\n\n${p.body.slice(0, 2800)}`)
    .join("\n\n---\n\n");
}

function renderSnippets(chunks: IndexedChunk[]): string {
  return chunks.map((c) => `From "${c.postTitle}": ${c.text.slice(0, 800)}`).join("\n\n");
}

/** Deterministic safety net for the two AI-tells we can fix without harming meaning. */
function sanitizeHumanTone(draft: string): string {
  return draft
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s*–\s*/g, " to ")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ ,/g, ",")
    .replace(/\n{3,}/g, "\n\n");
}

async function planArticle(
  system: string,
  styleGuide: string,
  exemplars: string,
  topic: string,
  keyword: string,
): Promise<ArticlePlan> {
  const plan = await completeJson<ArticlePlan>({
    system,
    temperature: 0.5,
    maxTokens: 3000,
    user: `Plan an SEO blog article for Axis Consulting.
TOPIC: ${topic}
PRIMARY KEYWORD (use this EXACT phrase): ${keyword}

Return JSON only:
{
  "title": "H1, 30-65 chars, contains the exact keyword, a real clickable headline (not a press release)",
  "metaDescription": "120-160 chars, contains the exact keyword",
  "intro": "2-3 short paragraphs of prose (no heading). State the reader's CRM-data problem and the AI fix. Put the exact keyword in the first 100 words.",
  "sections": [ {"h2": "descriptive heading", "guidance": "what this section must cover, with concrete CRM field names / workflows"} ],
  "faqs": [ {"q": "a real search-query question ending in ?"} ]
}

Requirements:
- 7 sections. At least one section h2 must contain the EXACT keyword phrase "${keyword}".
- 5 FAQ questions.
- ${RULES}

STYLE GUIDE:
${styleGuide.slice(0, 3500)}

EXEMPLAR AXIS POSTS:
${exemplars}`,
  });

  const kw = keyword.toLowerCase();
  if (!plan.sections.some((s) => s.h2.toLowerCase().includes(kw)) && plan.sections[0]) {
    plan.sections[0].h2 = `What ${keyword} Does for Your CRM Data`;
  }
  return plan;
}

async function writeSection(
  system: string,
  snippets: string,
  ctx: { title: string; keyword: string; allHeadings: string[] },
  section: { h2: string; guidance: string },
): Promise<string> {
  const body = await complete({
    system,
    temperature: TEMP,
    maxTokens: 1200,
    user: `Write ONE section of the article titled "${ctx.title}" (about ${ctx.keyword}).

SECTION HEADING: ${section.h2}
COVER: ${section.guidance}

Other section headings in this article (do not repeat their content): ${ctx.allHeadings.join("; ")}

Write 220-320 words of prose for THIS section only. Be concrete: name real CRM fields, workflows, and before/after outcomes. You may use one short bullet list if it helps. Use the exact keyword phrase "${ctx.keyword}" only if it fits naturally.
${RULES}

Voice reference snippets:
${snippets}

Output the section body as Markdown WITHOUT the heading line (no "##"). No preamble.`,
  });
  return body.replace(/^#{1,6}\s+.*$/m, "").trim();
}

async function writeFaqs(
  system: string,
  title: string,
  keyword: string,
  faqs: { q: string }[],
): Promise<string> {
  const out = await complete({
    system,
    temperature: TEMP,
    maxTokens: 1500,
    user: `Write the FAQ answers for the article "${title}" (about ${keyword}).

Questions:
${faqs.map((f, i) => `${i + 1}. ${f.q}`).join("\n")}

For each question output:
### <question>
<a 40-80 word answer>

${RULES}
Output Markdown only, starting at the first ### question. No preamble, no "## FAQ" heading.`,
  });
  return out.trim();
}

function buildCta(): string {
  return `If your CRM data is slowing your sales team down, ${BRAND.name} can help. We clean, enrich, and automate the data inside your CRM so your pipeline is something you can actually trust. [Book a CRM data assessment with Axis Consulting](${BRAND.ctaUrl}) and we will map the highest-impact fixes for your stack.`;
}

function assemble(plan: ArticlePlan, sectionBodies: string[], faqBlock: string): string {
  const parts: string[] = [];
  parts.push(`# ${plan.title}`);
  parts.push(`**Meta description:** ${plan.metaDescription}`);
  parts.push(plan.intro.trim());
  plan.sections.forEach((s, i) => {
    parts.push(`## ${s.h2}`);
    parts.push(sectionBodies[i]!.trim());
  });
  parts.push(`## Frequently Asked Questions`);
  parts.push(faqBlock);
  parts.push(`## Work With Axis Consulting`);
  parts.push(buildCta());
  return parts.join("\n\n");
}

/** Targeted, non-destructive revision directive for a near-passing draft. */
function directiveFor(id: string, detail: string, seo: SeoReport): string {
  switch (id) {
    case "word-count": {
      const need = Math.max(0, 1700 - seo.wordCount);
      return `Add about ${need} more words by deepening existing sections (keep every existing sentence; add concrete examples and CRM field names). Do not add new sections or filler. Currently ${seo.wordCount} words.`;
    }
    case "density":
      return `Use the exact keyword phrase "${seo.keyword}" a couple more times, naturally. Currently ${detail}.`;
    case "meta":
      return `Fix line 2 so it is \`**Meta description:** ...\`, 120-160 chars, including the keyword. Currently ${detail}.`;
    case "title-length":
      return `Rewrite the H1 to 30-65 chars including the keyword. Currently ${detail}.`;
    default:
      return `Fix ${id} (currently ${detail}).`;
  }
}

async function reviseForSeo(system: string, draft: string, seo: SeoReport): Promise<string> {
  const fixes = [
    ...seo.checks.filter((c) => !c.pass).map((c) => `- ${directiveFor(c.id, c.detail, seo)}`),
    ...seo.aiTells.map((t) => `- Remove AI-tell: ${t}`),
  ].join("\n");
  return complete({
    system,
    temperature: TEMP,
    maxTokens: 8000,
    user: `Revise this article to fix the issues below. Keep all correct content verbatim where possible, keep the structure (H1, meta line, H2s, FAQ, CTA), keep the voice. When expanding, ADD to existing sections rather than rewriting shorter.

ISSUES:
${fixes}

${RULES}

CURRENT DRAFT:
${draft}

Output the full corrected Markdown article only. No preamble, no code fences.`,
  });
}

export async function generateArticle(
  openai: OpenAI,
  options: GenerateOptions,
): Promise<GenerateResult> {
  const topic = options.topic.trim();
  const keyword = (options.keyword ?? topic).trim();
  const styleGuide = fs.readFileSync(PATHS.styleGuide, "utf8");
  const system = fs.readFileSync(PATHS.systemPrompt, "utf8");

  // Retrieval uses OpenAI embeddings; writing uses Claude.
  const query = `${topic} CRM data`;
  const [fullPosts, chunks] = await Promise.all([
    retrieveFullPosts(openai, query, 2),
    retrieveSimilar(openai, query, 6),
  ]);
  const exemplars = renderExemplars(fullPosts);
  const snippets = renderSnippets(chunks);

  const plan = await planArticle(system, styleGuide, exemplars, topic, keyword);
  const allHeadings = plan.sections.map((s) => s.h2);

  const [sectionBodies, faqBlock] = await Promise.all([
    Promise.all(
      plan.sections.map((s) =>
        writeSection(system, snippets, { title: plan.title, keyword, allHeadings }, s),
      ),
    ),
    writeFaqs(system, plan.title, keyword, plan.faqs),
  ]);

  let draft = sanitizeHumanTone(assemble(plan, sectionBodies, faqBlock));
  let seo = scoreSeo(draft, keyword);
  let best = { draft, seo };
  console.log(`Initial draft: ${seo.score}/100 (${seo.grade}), ${seo.wordCount} words`);

  for (let attempt = 0; attempt < 2 && seo.score < 90; attempt++) {
    draft = sanitizeHumanTone(await reviseForSeo(system, draft, seo));
    seo = scoreSeo(draft, keyword);
    console.log(
      `SEO pass ${attempt}: ${seo.score}/100 (${seo.grade}), ${seo.wordCount} words, aiTells=${seo.aiTells.length}`,
    );
    if (seo.score >= best.seo.score) best = { draft, seo };
  }
  console.log(`Final SEO score: ${best.seo.score}/100 (${best.seo.grade})`);

  if (options.outputPath) {
    fs.mkdirSync(PATHS.outputDir, { recursive: true });
    fs.writeFileSync(options.outputPath, best.draft, "utf8");
  }
  return best;
}
