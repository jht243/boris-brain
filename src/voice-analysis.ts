// Data-driven voice fingerprint: extracts the words, phrases, sentence-openers, and formatting
// habits that are genuinely over-represented in Axis's own writing, so the style guide recommends
// HIS signature vocabulary instead of generic SaaS clichés the model would otherwise guess.

import type { CorpusPost } from "./wp-client.js";

const STOPWORDS = new Set(
  ("a an the and or but if then else when while of to in on at by for with about as into through " +
    "over after before between out against during without within along across behind beyond up down " +
    "is are was were be been being have has had do does did will would can could should may might must " +
    "this that these those it its it's they them their there here what which who whom whose how why where " +
    "you your yours we our ours us i me my mine he she his her hers them so than too very just also not no " +
    "yes all any both each few more most other some such only own same s t can't don't won't more get got " +
    "from one two like make made way time well even back much many now new use used using")
    .split(/\s+/),
);

// Generic SaaS / AI-tell words we never want to resurface as "words to use".
const GENERIC_BLOCKLIST = new Set([
  "seamless", "seamlessly", "robust", "leverage", "leveraging", "delve", "streamline", "streamlined",
  "streamlining", "optimize", "optimized", "optimizing", "unlock", "unlocking", "transform",
  "transforming", "cutting", "edge", "next", "gen", "revolutionary", "powerful", "innovative",
  "solution", "solutions", "empower", "elevate", "harness", "utilize", "synergy", "holistic",
  "game", "changer", "landscape", "realm", "moreover", "furthermore",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w));
}

// TOC plugin text and the repeated CTA template are boilerplate, not authored voice — drop them.
const NOISE_WORDS = new Set(["table", "contents", "toc"]);
const BOILERPLATE_SENTENCE =
  /table of contents|fill out the form|choose axis consulting|speak with (an )?expert|looking for help|don'?t know where to start|get in touch|power of technology|service you need|let (us )?know about|data has been submitted|processing your data|we will be in touch|required fields|please fill|try again/i;

function bodyText(post: CorpusPost): string {
  // Strip markdown markers the corpus stored (headings, list bullets, links) and TOC text.
  return post.body
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/table of contents/gi, " ");
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 4)
    .filter((s) => !BOILERPLATE_SENTENCE.test(s)); // drop CTA/TOC boilerplate
}

interface Ranked {
  term: string;
  count: number;
  docs: number;
}

function topByDocFreq(perDoc: Map<string, number>[], min: number, take: number): Ranked[] {
  const count = new Map<string, number>();
  const docs = new Map<string, number>();
  for (const d of perDoc) {
    for (const [term, c] of d) {
      count.set(term, (count.get(term) ?? 0) + c);
      docs.set(term, (docs.get(term) ?? 0) + 1);
    }
  }
  return [...count.entries()]
    .filter(([term]) => (docs.get(term) ?? 0) >= min)
    .map(([term, c]) => ({ term, count: c, docs: docs.get(term) ?? 0 }))
    .sort((a, b) => b.docs - a.docs || b.count - a.count)
    .slice(0, take);
}

function ngrams(words: string[], n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i + n <= words.length; i++) {
    const gram = words.slice(i, i + n);
    // keep grams with at least one content word and no blocklisted word
    if (gram.every((w) => STOPWORDS.has(w))) continue;
    if (gram.some((w) => GENERIC_BLOCKLIST.has(w))) continue;
    out.push(gram.join(" "));
  }
  return out;
}

export interface VoiceFingerprint {
  unigrams: Ranked[];
  bigrams: Ranked[];
  trigrams: Ranked[];
  openers: Ranked[];
  formatting: {
    posts: number;
    avgWords: number;
    pctWithBullets: number;
    avgH2: number;
    pctQuestionHeadline: number;
    pctNumberHeadline: number;
    contractionRate: number; // contractions per 100 words
  };
}

export function analyzeVoice(posts: CorpusPost[]): VoiceFingerprint {
  const uniDocs: Map<string, number>[] = [];
  const biDocs: Map<string, number>[] = [];
  const triDocs: Map<string, number>[] = [];
  const openerCount = new Map<string, number>();

  let totalWords = 0;
  let withBullets = 0;
  let totalH2 = 0;
  let contractions = 0;

  for (const post of posts) {
    const text = bodyText(post);
    const sents = sentences(text); // boilerplate already filtered out
    const words = tokenize(sents.join(" "));
    totalWords += words.length;

    const uni = new Map<string, number>();
    for (const w of words) {
      if (STOPWORDS.has(w) || GENERIC_BLOCKLIST.has(w) || NOISE_WORDS.has(w)) continue;
      uni.set(w, (uni.get(w) ?? 0) + 1);
    }
    uniDocs.push(uni);

    const bi = new Map<string, number>();
    for (const g of ngrams(words, 2)) bi.set(g, (bi.get(g) ?? 0) + 1);
    biDocs.push(bi);

    const tri = new Map<string, number>();
    for (const g of ngrams(words, 3)) tri.set(g, (tri.get(g) ?? 0) + 1);
    triDocs.push(tri);

    for (const s of sents) {
      const opener = s.split(/\s+/).slice(0, 2).join(" ").toLowerCase().replace(/[^a-z' ]/g, "");
      if (!opener || opener.split(" ").every((w) => STOPWORDS.has(w) || NOISE_WORDS.has(w))) continue;
      openerCount.set(opener, (openerCount.get(opener) ?? 0) + 1);
    }

    if (/^[-*]\s+/m.test(post.body)) withBullets++;
    totalH2 += (post.body.match(/^##\s+/gm) ?? []).length;
    contractions += (text.match(/\b\w+['’](s|re|ve|ll|t|d|m)\b/gi) ?? []).length;
  }

  const headlines = posts.map((p) => p.title);
  const qHead = headlines.filter((h) => h.trim().endsWith("?")).length;
  const numHead = headlines.filter((h) => /\d/.test(h)).length;

  const openers = [...openerCount.entries()]
    .map(([term, count]) => ({ term, count, docs: 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return {
    unigrams: topByDocFreq(uniDocs, Math.ceil(posts.length * 0.15), 30),
    bigrams: topByDocFreq(biDocs, 5, 25),
    trigrams: topByDocFreq(triDocs, 4, 20),
    openers,
    formatting: {
      posts: posts.length,
      avgWords: Math.round(totalWords / Math.max(1, posts.length)),
      pctWithBullets: Math.round((withBullets / Math.max(1, posts.length)) * 100),
      avgH2: Math.round((totalH2 / Math.max(1, posts.length)) * 10) / 10,
      pctQuestionHeadline: Math.round((qHead / Math.max(1, headlines.length)) * 100),
      pctNumberHeadline: Math.round((numHead / Math.max(1, headlines.length)) * 100),
      contractionRate: Math.round((contractions / Math.max(1, totalWords)) * 1000) / 10,
    },
  };
}

/** Markdown section for the style guide, plus the term list for the LLM prompt. */
export function buildSignatureSection(posts: CorpusPost[]): { markdown: string; terms: string[] } {
  const f = analyzeVoice(posts);
  const list = (rs: Ranked[]) => rs.map((r) => `${r.term}`).join(", ");

  const terms = [
    ...f.unigrams.map((r) => r.term),
    ...f.bigrams.map((r) => r.term),
    ...f.trigrams.map((r) => r.term),
  ];

  const markdown = `## Signature Vocabulary & Phrasing (data-driven, from ${f.formatting.posts} posts)

These are terms and phrases genuinely over-represented in Axis's own writing. Prefer THESE; do NOT
substitute generic SaaS words (streamline, optimize, unlock, transform, seamless, robust, leverage).

**Signature single words (by how many posts use them):**
${list(f.unigrams)}

**Signature 2-word phrases:**
${list(f.bigrams)}

**Signature 3-word phrases:**
${list(f.trigrams)}

**How Axis tends to start sentences:**
${f.openers.map((o) => `"${o.term}…"`).join(", ")}

**Formatting habits (match these):**
- Avg article length: **${f.formatting.avgWords} words**
- Uses bullet lists in **${f.formatting.pctWithBullets}%** of posts
- Avg H2 sections per post: **${f.formatting.avgH2}**
- Question headlines: **${f.formatting.pctQuestionHeadline}%** · numbered/listicle headlines: **${f.formatting.pctNumberHeadline}%**
- Contraction rate: **${f.formatting.contractionRate} per 100 words** (conversational, uses "you're / it's / don't")
`;

  return { markdown, terms };
}
