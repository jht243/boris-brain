// Deterministic SEO + "does this read AI-generated?" checker.
// Runs with zero API calls so it can score every draft and power the dashboard panel.

export interface SeoCheck {
  id: string;
  label: string;
  pass: boolean;
  weight: number; // contribution to the score
  detail: string;
}

export interface SeoReport {
  keyword: string;
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  wordCount: number;
  readingTimeMin: number;
  title: string | null;
  metaDescription: string;
  checks: SeoCheck[];
  aiTells: string[]; // human-readable list of AI-generated red flags found
}

const AI_FILLER = [
  "in conclusion",
  "in today's fast-paced world",
  "it's important to note",
  "it is important to note",
  "moreover",
  "furthermore",
  "delve",
  "in the realm of",
  "navigate the landscape",
  "ever-evolving",
  "ever-changing",
  "at the end of the day",
  "game-changer",
  "game changer",
  "seamless",
  "seamlessly",
  "robust",
  "unlock the power",
  "leveraging",
  "in this digital age",
  "when it comes to",
  "the world of",
];

function stripMd(s: string): string {
  return s
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

function words(s: string): string[] {
  return stripMd(s).split(/\s+/).filter(Boolean);
}

function sentences(s: string): string[] {
  return stripMd(s)
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 3);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Count whole-phrase keyword occurrences, case-insensitive. */
function keywordCount(text: string, keyword: string): number {
  if (!keyword.trim()) return 0;
  const re = new RegExp(escapeRe(keyword.trim()), "gi");
  return (text.match(re) ?? []).length;
}

export function detectAiTells(draft: string): string[] {
  const tells: string[] = [];
  const lower = draft.toLowerCase();

  const emDashes = (draft.match(/—/g) ?? []).length;
  if (emDashes > 0) tells.push(`${emDashes} em-dash(es) (—) — replace with commas/periods`);
  const enDashes = (draft.match(/–/g) ?? []).length;
  if (enDashes > 0) tells.push(`${enDashes} en-dash(es) (–)`);

  // Emoji (broad ranges).
  const emoji = draft.match(
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu,
  );
  if (emoji && emoji.length) tells.push(`${emoji.length} emoji(s)`);

  for (const phrase of AI_FILLER) {
    if (lower.includes(phrase)) tells.push(`AI-tell phrase: "${phrase}"`);
  }

  // Uniform sentence rhythm is a classic LLM signature.
  const sl = sentences(draft).map((s) => s.split(/\s+/).length);
  if (sl.length > 8) {
    const mean = sl.reduce((a, b) => a + b, 0) / sl.length;
    const variance = sl.reduce((a, b) => a + (b - mean) ** 2, 0) / sl.length;
    const stdev = Math.sqrt(variance);
    if (stdev < 4.5) {
      tells.push(`Low sentence-length variation (stdev ${stdev.toFixed(1)}) — vary rhythm`);
    }
  }

  return tells;
}

/** Pull the meta description: explicit `**Meta description:** ...` line, else first paragraph. */
function extractMeta(draft: string): string {
  const m = draft.match(/meta description[:*\s]+(.+)/i);
  if (m && m[1]) return m[1].replace(/[*_`]/g, "").trim().slice(0, 320);
  const lines = draft.split("\n");
  const firstH2 = lines.findIndex((l) => /^##\s/.test(l));
  const body = lines.slice(0, firstH2 > 0 ? firstH2 : lines.length);
  const para = body.find((l) => l.trim().length > 60 && !/^#/.test(l));
  return (para ?? "").replace(/[*_`]/g, "").trim().slice(0, 320);
}

export function scoreSeo(draft: string, keyword: string): SeoReport {
  const lines = draft.split("\n");
  const titleLine = lines.find((l) => /^#\s+/.test(l));
  const title = titleLine ? titleLine.replace(/^#\s+/, "").trim() : null;
  const h2s = lines.filter((l) => /^##\s+/.test(l)).map((l) => l.replace(/^#{2,}\s+/, "").trim());
  const allWords = words(draft);
  const wordCount = allWords.length;
  const kw = keyword.trim().toLowerCase();
  const kwInBody = keywordCount(draft, keyword);
  const density = wordCount ? (kwInBody / wordCount) * 100 : 0;

  const firstChunk = stripMd(lines.slice(0, 25).join(" ")).toLowerCase().slice(0, 700);
  const meta = extractMeta(draft);
  const links = draft.match(/\[[^\]]+\]\((https?:[^)]+)\)/g) ?? [];
  const axisLinks = links.filter((l) => /axisconsulting\.io/i.test(l));
  const hasFaq = /##\s+(frequently asked questions|faq)/i.test(draft);
  const faqQs = (draft.match(/^###\s+.+\?/gim) ?? []).length;
  const hasList = /^\s*([-*]|\d+\.)\s+/m.test(draft);
  const hasCta = /\b(book|schedule|get in touch|contact|talk to|request|free assessment|get started|reach out)\b/i.test(
    stripMd(lines.slice(-30).join(" ")),
  );
  const aiTells = detectAiTells(draft);

  const checks: SeoCheck[] = [
    {
      id: "title-keyword",
      label: "Primary keyword in title",
      pass: !!title && kw.length > 0 && title.toLowerCase().includes(kw),
      weight: 12,
      detail: title ? `Title: "${title}"` : "No H1 title found",
    },
    {
      id: "title-length",
      label: "Title length 30-65 chars",
      pass: !!title && title.length >= 30 && title.length <= 65,
      weight: 8,
      detail: title ? `${title.length} chars` : "No title",
    },
    {
      id: "keyword-early",
      label: "Keyword in first 100 words",
      pass: kw.length > 0 && firstChunk.includes(kw),
      weight: 10,
      detail: firstChunk.includes(kw) ? "Found in intro" : "Not found early",
    },
    {
      id: "word-count",
      label: "Length 1,500-2,200 words",
      pass: wordCount >= 1500 && wordCount <= 2400,
      weight: 12,
      detail: `${wordCount} words`,
    },
    {
      id: "density",
      label: "Keyword density 0.3-2.8%",
      pass: density >= 0.3 && density <= 2.8,
      weight: 8,
      detail: `${density.toFixed(2)}% (${kwInBody} exact uses)`,
    },
    {
      id: "headings",
      label: "5-10 H2 sections",
      pass: h2s.length >= 5 && h2s.length <= 10,
      weight: 10,
      detail: `${h2s.length} H2 headings`,
    },
    {
      id: "keyword-heading",
      label: "Keyword in a subheading",
      pass: kw.length > 0 && h2s.some((h) => h.toLowerCase().includes(kw)),
      weight: 6,
      detail: kw ? "Checked H2 headings" : "No keyword set",
    },
    {
      id: "faq",
      label: "FAQ section (3+ Q&A)",
      pass: hasFaq && faqQs >= 3,
      weight: 10,
      detail: hasFaq ? `${faqQs} FAQ questions` : "No FAQ section",
    },
    {
      id: "list",
      label: "Has a bullet/numbered list",
      pass: hasList,
      weight: 4,
      detail: hasList ? "List found" : "No list",
    },
    {
      id: "cta",
      label: "Call to action present",
      pass: hasCta,
      weight: 8,
      detail: hasCta ? "CTA found near end" : "No clear CTA",
    },
    {
      id: "internal-link",
      label: "Links to Axis Consulting",
      pass: axisLinks.length >= 1,
      weight: 6,
      detail: `${axisLinks.length} axisconsulting.io link(s), ${links.length} total`,
    },
    {
      id: "meta",
      label: "Meta description 120-160 chars",
      pass: meta.length >= 110 && meta.length <= 165,
      weight: 6,
      detail: meta ? `${meta.length} chars` : "None",
    },
    {
      id: "human",
      label: "Reads human (no AI tells)",
      pass: aiTells.length === 0,
      weight: 14,
      detail: aiTells.length ? `${aiTells.length} flag(s)` : "Clean",
    },
  ];

  const earned = checks.filter((c) => c.pass).reduce((a, c) => a + c.weight, 0);
  const total = checks.reduce((a, c) => a + c.weight, 0);
  const score = Math.round((earned / total) * 100);
  const grade: SeoReport["grade"] =
    score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";

  return {
    keyword,
    score,
    grade,
    wordCount,
    readingTimeMin: Math.max(1, Math.round(wordCount / 220)),
    title,
    metaDescription: meta,
    checks,
    aiTells,
  };
}

/** Compact text summary for the CLI. */
export function renderSeoText(r: SeoReport): string {
  const lines = [
    `SEO score: ${r.score}/100 (${r.grade})  •  ${r.wordCount} words  •  ~${r.readingTimeMin} min read`,
    `Keyword: "${r.keyword}"`,
    "",
    ...r.checks.map((c) => `  ${c.pass ? "✓" : "✗"} ${c.label} — ${c.detail}`),
  ];
  if (r.aiTells.length) {
    lines.push("", "AI-tell flags:");
    for (const t of r.aiTells) lines.push(`  ! ${t}`);
  }
  return lines.join("\n");
}
