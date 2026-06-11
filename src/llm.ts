import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GENERATION_MODEL } from "./config.js";

// Route by model name: "claude-*" -> Anthropic, anything else ("gpt-*", "o*") -> OpenAI.
// Swap providers just by changing GENERATION_MODEL in config.ts.
const isClaude = GENERATION_MODEL.startsWith("claude");
const isReasoning = /^o\d/.test(GENERATION_MODEL); // o1/o3/o4 don't take custom temperature

let anthropic: Anthropic | null = null;
let openai: OpenAI | null = null;

function getAnthropic(): Anthropic {
  if (anthropic) return anthropic;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required for Claude generation.");
  anthropic = new Anthropic({ apiKey });
  return anthropic;
}

function getOpenAI(): OpenAI {
  if (openai) return openai;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for GPT generation.");
  openai = new OpenAI({ apiKey });
  return openai;
}

export interface CompleteOptions {
  /** System prompt. Cached across calls (Claude prompt caching) since it is reused per generation. */
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  /** Ask for a single JSON object; returns the raw JSON string (parse with completeJson). */
  json?: boolean;
}

/** Pull the first balanced {...} block out of a string (defensive JSON extraction). */
function extractJson(s: string): string {
  const start = s.indexOf("{");
  if (start === -1) return s;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return s.slice(start);
}

async function completeClaude(opts: CompleteOptions): Promise<string> {
  const res = await getAnthropic().messages.create({
    model: GENERATION_MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    // claude-opus-4-8/sonnet-4-6 reject custom temperature and assistant prefill, so we omit both
    // and rely on the prompt to request JSON; extractJson recovers the object.
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: opts.user }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return opts.json ? extractJson(text) : text;
}

async function completeOpenAI(opts: CompleteOptions): Promise<string> {
  const res = await getOpenAI().chat.completions.create({
    model: GENERATION_MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    ...(isReasoning ? {} : { temperature: opts.temperature ?? 0.5 }),
    ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  });
  const text = res.choices[0]?.message?.content?.trim() ?? "";
  return opts.json ? extractJson(text) : text;
}

export async function complete(opts: CompleteOptions): Promise<string> {
  return isClaude ? completeClaude(opts) : completeOpenAI(opts);
}

export async function completeJson<T>(opts: Omit<CompleteOptions, "json">): Promise<T> {
  const raw = await complete({ ...opts, json: true });
  return JSON.parse(raw) as T;
}
