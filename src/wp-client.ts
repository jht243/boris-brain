import { WP_BASE } from "./config.js";

export interface WpPost {
  id: number;
  date: string;
  slug: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  author: number;
  categories: number[];
}

export interface CorpusPost {
  id: number;
  date: string;
  slug: string;
  link: string;
  title: string;
  excerpt: string;
  body: string;
  categories: number[];
}

const UA =
  "AxisBrain/0.1 (+https://www.axisconsulting.io; content-research)";

async function fetchJson<T>(url: string): Promise<{ data: T; total?: number }> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`WP API ${res.status}: ${url}`);
  const total = res.headers.get("X-WP-Total");
  const data = (await res.json()) as T;
  return { data, total: total ? Number(total) : undefined };
}

/** Fetch the most recent published posts across all authors. */
export async function fetchAxisPosts(limit: number): Promise<WpPost[]> {
  const posts: WpPost[] = [];
  let page = 1;

  while (posts.length < limit) {
    const url = `${WP_BASE}/posts?per_page=100&page=${page}&orderby=date&order=desc&status=publish`;
    const { data } = await fetchJson<WpPost[]>(url);
    if (!data.length) break;
    posts.push(...data);
    if (data.length < 100) break;
    page += 1;
  }

  return posts.slice(0, limit);
}
