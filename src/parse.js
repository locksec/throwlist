/**
 * @typedef {{ first?: string, last?: string, services?: string[] }} Seen
 * @typedef {Map<string, Seen>} SourceData Raw domain -> what the source says about it.
 */

/** @param {number} seconds */
const isoDate = seconds => new Date(seconds * 1000).toISOString().slice(0, 10);

/**
 * One domain per line; `#` and `//` start comments.
 * @param {string} text
 * @returns {SourceData}
 */
export function parseLines(text) {
  const out = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/(#|\/\/).*$/, '').trim();
    if (line) out.set(line.split(/\s+/)[0], {});
  }
  return out;
}

/**
 * A JSON array of domains.
 * @param {string} text
 * @returns {SourceData}
 */
export function parseJsonArray(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('Expected a JSON array');
  return new Map(data.filter(d => typeof d === 'string').map(d => [d, {}]));
}

/**
 * 7c/fakefilter's json/data.json: `{ domains: { "x.com": { provider, firstseen, lastseen } } }`
 * with Unix times.
 * @param {string} text
 * @returns {SourceData}
 */
export function parseFakefilter(text) {
  const { domains } = JSON.parse(text);
  if (!domains || typeof domains !== 'object') throw new Error('Expected a domains object');
  const out = new Map();
  for (const [domain, info] of Object.entries(domains)) {
    out.set(domain, {
      first: info.firstseen ? isoDate(info.firstseen) : undefined,
      last: info.lastseen ? isoDate(info.lastseen) : undefined,
    });
  }
  return out;
}

/**
 * Whether an origin in the aggregator's source map is another published list (a file on
 * GitHub or a .txt/.conf/.json download) rather than one of its own crawls of a service.
 * @param {string} origin
 */
export const isListOrigin = origin =>
  /^https:\/\/(raw|gist)\.githubusercontent\.com\//.test(origin) || /\.(txt|conf|json)$/i.test(origin);

/**
 * disposable/disposable-email-domains' domains_source_map.txt: one `origin:domain` per line,
 * where origin is a crawler name or the URL of a list it compiles.
 * @param {string} text
 * @param {{ select?: 'crawls' | 'lists', skip?: string[] }} options
 * @returns {SourceData}
 */
export function parseSourceMap(text, { select = 'crawls', skip = [] }) {
  const out = new Map();
  for (const line of text.split(/\r?\n/)) {
    const at = line.lastIndexOf(':');
    if (at < 1) continue;
    const origin = line.slice(0, at);
    const domain = line.slice(at + 1).trim();
    if (!domain || skip.some(s => origin.includes(s))) continue;
    if ((select === 'lists') === isListOrigin(origin)) out.set(domain, {});
  }
  return out;
}
