/**
 * A small robots.txt reader following RFC 9309: the group for our user agent if there is
 * one, otherwise the `*` group; the longest matching rule wins, and allow wins a tie.
 * @typedef {{ allow: boolean, path: string }} Rule
 * @typedef {{ agents: string[], rules: Rule[] }} Group
 */

/**
 * @param {string} text
 * @returns {Group[]}
 */
export function parseRobots(text) {
  /** @type {Group[]} */
  const groups = [];
  /** @type {Group | null} */
  let group = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (!group || !lastWasAgent) groups.push((group = { agents: [], rules: [] }));
      group.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === 'allow' || key === 'disallow') && group) {
      if (value) group.rules.push({ allow: key === 'allow', path: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

/**
 * @param {string} pattern
 * @param {string} path
 */
function matches(pattern, path) {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`).test(path);
}

/**
 * @param {Group[]} groups
 * @param {string} agent Product token, such as `throwlistbot`.
 * @param {string} path Path and query of the URL.
 */
export function isAllowed(groups, agent, path) {
  const token = agent.toLowerCase();
  let chosen = groups.filter(g => g.agents.some(a => a.split('/')[0] === token));
  if (chosen.length === 0) chosen = groups.filter(g => g.agents.includes('*'));
  let best = { length: -1, allow: true };
  for (const rule of chosen.flatMap(g => g.rules)) {
    if (!matches(rule.path, path)) continue;
    const length = rule.path.length;
    if (length > best.length || (length === best.length && rule.allow)) best = { length, allow: rule.allow };
  }
  return best.allow;
}
