# Axis Consulting — Axis Brain (MVP)

AI writing system that drafts **SEO-optimized blog articles in Axis Consulting's voice**, grounded in ~200 of their published axisconsulting.io posts. Current content theme: **using AI to improve CRM data** (Pipedrive, Salesforce, HubSpot, and more).

Every article ships with a CTA, an FAQ section, a meta description, target length (1,500-2,200 words), and an **SEO checker** score. Drafts are written to read human, not AI-generated: no em-dashes, no emojis, no filler.

## Setup

```bash
cp .env.example .env   # add OPENAI_API_KEY
npm install
npm run setup          # ingest posts + embed + build style guide
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run ingest` | Fetch up to 200 Axis posts from the WordPress API |
| `npm run build-index` | Chunk corpus and build the local embedding index |
| `npm run build-style` | Generate `prompts/axis-style.md` from the corpus |
| `npm run generate -- --topic "AI for Pipedrive"` | Draft one SEO article + print its SEO report |
| `npm run dashboard` | Launch the web dashboard at http://localhost:3000 |

## Generate from the CLI

```bash
npm run generate -- --topic "Using AI to clean Pipedrive CRM data" --keyword "AI for Pipedrive"
```

## Dashboard

`npm run dashboard` then open http://localhost:3000. Click a preset CRM (AI for Pipedrive, AI for Salesforce, etc.) or type a custom topic. The article renders in the center; the live **SEO checker** (score, grade, per-check pass/fail, and AI-tell flags) renders on the right. Drafts are editable with live re-scoring.

## Project layout

```
scripts/          CLI entry points (ingest, build-index, build-style, generate, dashboard)
src/              wp-client, chunker, rag, generate, seo (checker), server
prompts/          system prompt + Axis style guide
data/corpus/      ingested posts
data/embeddings/  vector index
output/           generated drafts (.md)
public/           dashboard UI
```
