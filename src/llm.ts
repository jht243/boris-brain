import Anthropic from "@anthropic-ai/sdk";
import { GENERATION_MODEL } from "./config.js";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is required for generation. Add it to .env (get one at https://console.anthropic.com).",
    );
  }
  client = new Anthropic({ apiKey });
  return client;
}

export interface CompleteOptions {
  /** System prompt. Cached across calls (prompt caching) since it is reused per generation. */
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  /** Force a JSON object reply via assistant prefill; returns the parsed object. */
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

export async function complete(opts: CompleteOptions): Promise<string> {
  const anthropic = getAnthropic();
  // Prefill an opening brace when we want JSON so Claude returns the object directly.
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: opts.user }];
  if (opts.json) messages.push({ role: "assistant", content: "{" });

  const res = await anthropic.messages.create({
    model: GENERATION_MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.45,
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    messages,
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  // Re-attach the prefilled brace that Claude continued from.
  return opts.json ? extractJson("{" + text) : text;
}

export async function completeJson<T>(opts: Omit<CompleteOptions, "json">): Promise<T> {
  const raw = await complete({ ...opts, json: true });
  return JSON.parse(raw) as T;
}
