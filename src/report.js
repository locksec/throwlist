/**
 * @typedef {import('./merge.js').MergeResult} MergeResult
 * @typedef {import('./config.js').Source} Source
 */

const SAMPLE = 25;

/** Names a domain might borrow from a real provider to look trustworthy. */
const PROVIDER_NAMES = /gmail|googlemail|yahoo|outlook|hotmail|icloud|proton|gmx|yandex|aol\b|zoho|fastmail|tutanota/;

/** @param {number} n */
const fmt = n => n.toLocaleString('en-US');

/** @param {string[]} list */
const sample = list =>
  list.length === 0 ? '' : list.slice(0, SAMPLE).map(d => `\`${d}\``).join(', ') + (list.length > SAMPLE ? `, and ${fmt(list.length - SAMPLE)} more` : '');

/**
 * The change report: the pull request body for a refresh, and the summary printed by
 * `npm run build`.
 * @param {object} input
 * @param {string} input.today
 * @param {MergeResult} input.result
 * @param {Source[]} input.sources
 * @param {Map<string, string>} input.failures Source id -> why it was not read this run.
 * @param {string[]} [input.collectNotes] Lines from the service readers.
 * @returns {string}
 */
export function buildReport({ today, result, sources, failures, collectNotes = [] }) {
  const { listed, added, removed, held, paidHost, allowlisted, relayed, redundant, rejected, counts } = result;
  const out = [];
  out.push(`# Throwlist refresh, ${today}`, '');
  out.push(`${fmt(listed.size)} domains listed: ${fmt(added.length)} added, ${fmt(removed.size)} removed.`, '');

  out.push('## Sources', '', '| Source | Lists a domain on its own? | Domains read | Status |', '| --- | --- | ---: | --- |');
  for (const s of sources) {
    const status = failures.has(s.id) ? `not read: ${failures.get(s.id)}. Its domains carry over from the last release.` : 'read';
    out.push(`| ${s.id} | ${s.trust === 'direct' ? 'yes' : 'only if another list agrees'} | ${counts.has(s.id) ? fmt(/** @type {number} */ (counts.get(s.id))) : '-'} | ${status} |`);
  }
  out.push('');

  if (collectNotes.length) out.push('## Watched services', '', ...collectNotes.map(n => `- ${n}`), '');

  out.push(`## Added (${fmt(added.length)})`, '');
  if (added.length) {
    const bySource = new Map();
    for (const d of added) for (const id of /** @type {import('./merge.js').Entry} */ (listed.get(d)).sources) bySource.set(id, (bySource.get(id) ?? 0) + 1);
    out.push(`By source: ${[...bySource].sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id} ${fmt(n)}`).join(', ')}.`, '');
    out.push(sample(added), '');
  }

  out.push(`## Removed (${fmt(removed.size)})`, '');
  const reasons = new Map();
  for (const [d, why] of removed) reasons.set(why, [...(reasons.get(why) ?? []), d]);
  for (const [why, list] of reasons) out.push(`- ${why}: ${fmt(list.length)}. ${sample(list)}`);
  if (removed.size) out.push('');

  const lookalikes = added.filter(d => PROVIDER_NAMES.test(d));
  if (lookalikes.length) {
    out.push('## Worth a look', '', `New domains that borrow a real provider's name. These are usually throwaway lookalikes; check none is the provider itself.`, '', sample(lookalikes), '');
  }

  out.push('## Kept off the list', '');
  out.push(`- Allowlisted though a source names them: ${fmt(allowlisted.size)}. ${sample([...allowlisted].map(([d, p]) => `${d} (${p})`))}`);
  out.push(`- Relay services, published in relays.txt instead: ${fmt(relayed.size)}. ${sample([...relayed].map(([d, s]) => `${d} (${s})`))}`);
  out.push(`- Held back, named by only one community list or under an education or government suffix: ${fmt(held.length)}.`);
  out.push(`- Held back, mail now hosted by Google Workspace, Microsoft 365 or similar, and never seen on a throwaway service: ${fmt(paidHost.length)}.`);
  out.push(`- Subdomains of a listed domain: ${fmt(redundant.length)}.`);
  const rejectedReasons = new Map();
  for (const why of rejected.values()) rejectedReasons.set(why, (rejectedReasons.get(why) ?? 0) + 1);
  out.push(`- Rejected entries: ${[...rejectedReasons].map(([why, n]) => `${fmt(n)} ${why}`).join(', ') || 'none'}.`);
  out.push('');
  return out.join('\n');
}
