// Downloads each open-source list into cache/ and refreshes the Public Suffix List.
// Writes cache/manifest.json saying which sources were read, for scripts/build.js.
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { loadSources } from '../src/config.js';
import { botFetch } from '../src/http.js';
import { repoPath } from '../src/paths.js';

const PSL_URL = 'https://publicsuffix.org/list/public_suffix_list.dat';

mkdirSync(repoPath('cache'), { recursive: true });

/** @type {Record<string, { url: string, file?: string, bytes?: number, error?: string }>} */
const manifest = {};
/** @type {Map<string, Promise<{ file?: string, bytes?: number, error?: string }>>} */
const downloads = new Map();

/** @param {string} url */
async function download(url) {
  const file = `cache/${createHash('sha1').update(url).digest('hex').slice(0, 16)}`;
  try {
    const res = await botFetch(url);
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const body = await res.text();
    if (body.length < 100) return { error: 'empty answer' };
    writeFileSync(repoPath(file), body);
    return { file, bytes: body.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

for (const source of loadSources()) {
  if (!source.url) continue;
  if (!downloads.has(source.url)) downloads.set(source.url, download(source.url));
  manifest[source.id] = { url: source.url, ...(await downloads.get(source.url)) };
  const m = manifest[source.id];
  console.log(`${source.id.padEnd(20)} ${m.error ? `failed: ${m.error}` : `${m.bytes} bytes`}`);
}

writeFileSync(repoPath('cache', 'manifest.json'), JSON.stringify({ fetched: new Date().toISOString(), sources: manifest }, null, 2));

const psl = await download(PSL_URL);
if (psl.file && psl.bytes && psl.bytes > 100_000) {
  copyFileSync(repoPath(psl.file), repoPath('data', 'public_suffix_list.dat'));
  console.log(`public suffix list   ${psl.bytes} bytes`);
} else {
  console.log(`public suffix list   kept the current copy (${psl.error ?? 'answer too small'})`);
}
