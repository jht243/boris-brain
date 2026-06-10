import fs from "node:fs";
import path from "node:path";
import { CORPUS_LIMIT, PATHS } from "../src/config.js";
import { htmlToText } from "../src/html.js";
import { fetchAxisPosts, type CorpusPost } from "../src/wp-client.js";

function decodeEntities(s: string): string {
  return s
    .replace(/&#8217;|&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8211;|&#8212;/g, "-")
    .replace(/&#038;|&amp;/g, "&")
    .replace(/&hellip;/g, "...")
    .replace(/&nbsp;/g, " ");
}

async function main() {
  console.log(`Fetching up to ${CORPUS_LIMIT} Axis Consulting posts...`);
  const wpPosts = await fetchAxisPosts(CORPUS_LIMIT);

  const posts: CorpusPost[] = wpPosts.map((p) => ({
    id: p.id,
    date: p.date,
    slug: p.slug,
    link: p.link,
    title: decodeEntities(p.title.rendered),
    excerpt: decodeEntities(htmlToText(p.excerpt.rendered)),
    body: decodeEntities(htmlToText(p.content.rendered)),
    categories: p.categories,
  }));

  fs.mkdirSync(path.dirname(PATHS.corpus), { recursive: true });
  fs.mkdirSync(PATHS.corpusDir, { recursive: true });

  fs.writeFileSync(PATHS.corpus, JSON.stringify(posts, null, 2), "utf8");

  for (const post of posts) {
    const md = `# ${post.title}\n\nSource: ${post.link}\nDate: ${post.date}\n\n${post.body}\n`;
    fs.writeFileSync(path.join(PATHS.corpusDir, `${post.slug}.md`), md, "utf8");
  }

  console.log(`Ingested ${posts.length} posts → ${PATHS.corpus}`);
  if (posts.length < CORPUS_LIMIT) {
    console.warn(`Note: only ${posts.length} posts found (target was ${CORPUS_LIMIT}).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
