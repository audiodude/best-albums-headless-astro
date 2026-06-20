// Thin CLI: ghostwrite a rough draft writeup in the site's voice.
// Pulls every existing album body from src/content/albums as few-shot examples,
// then asks Claude Opus 4.8 (medium effort) for a draft to react to — NOT final copy.
//
//   npm run ghostwrite -- "Weezer — Pinkerton"
//   node scripts/ghostwrite.mjs "Pixies — Doolittle"
//
// Reads ANTHROPIC_API_KEY from the environment.
// The draft prints to stdout; a one-line header prints to stderr, so you can pipe:
//   npm run ghostwrite -- "Sloan — Navy Blues" 2>/dev/null | pbcopy

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from './ghostwrite-prompt.mjs';

const ALBUMS_DIR = 'src/content/albums';

const target = process.argv.slice(2).join(' ').trim();
if (!target) {
  console.error('Usage: npm run ghostwrite -- "Artist — Album"');
  console.error('   e.g. npm run ghostwrite -- "Weezer — Pinkerton"');
  process.exit(1);
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('Set ANTHROPIC_API_KEY in your environment.');
  process.exit(1);
}

function splitFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw.trim() };
  let data = {};
  try {
    data = parseYaml(m[1]) ?? {};
  } catch {
    // Malformed frontmatter — skip this file's metadata, keep its body out.
  }
  return { data, body: m[2].trim() };
}

async function loadExamples() {
  let files;
  try {
    files = (await readdir(ALBUMS_DIR)).filter((f) => f.endsWith('.md'));
  } catch {
    return []; // dir missing (run from elsewhere) → CLI falls back to SEED_EXAMPLES
  }
  const examples = [];
  for (const f of files) {
    const { data, body } = splitFrontmatter(await readFile(join(ALBUMS_DIR, f), 'utf8'));
    if (body && data.title && data.artist) {
      examples.push({ artist: data.artist, album: data.title, body });
    }
  }
  return examples;
}

const examples = await loadExamples();
const client = new Anthropic({ apiKey });

const res = await client.messages.create({
  model: 'claude-opus-4-8',
  max_tokens: 4096,
  thinking: { type: 'adaptive' },
  output_config: { effort: 'medium' },
  system: buildSystemPrompt(examples),
  messages: [{ role: 'user', content: `Write a draft writeup for: ${target}` }],
});

const draft = res.content
  .filter((b) => b.type === 'text')
  .map((b) => b.text)
  .join('')
  .trim();

if (!draft) {
  console.error(`No draft produced (stop_reason: ${res.stop_reason}).`);
  process.exit(1);
}

const exCount = examples.length || 'seed';
console.error(`# Draft — ${target}  (${exCount} examples, ${res.usage.output_tokens} output tok)\n`);
console.log(draft);
