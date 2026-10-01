import { isAllowed, parseRobots } from './robots.js';
import { USER_AGENT } from './paths.js';

const TIMEOUT_MS = 30_000;

/**
 * Whether a page is a bot check (Cloudflare's "Just a moment" and the like) rather than the
 * page itself. Mentions of a CAPTCHA elsewhere on a normal page do not count.
 * @param {string} text
 */
export function looksLikeBotCheck(text) {
  return /<title>\s*(just a moment|attention required|access denied|ddos-guard)/i.test(text) || /challenge-platform|cf-chl-|cf_chl_/.test(text);
}

/**
 * Fetches a URL as ThrowlistBot.
 * @param {string} url
 * @returns {Promise<Response>}
 */
export function botFetch(url) {
  return fetch(url, { headers: { 'user-agent': USER_AGENT }, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
}

/**
 * Fetches a page only when the site's robots.txt allows it. Robots answers are cached per
 * origin for the run. An unreachable robots.txt or a server error means no access; a
 * missing one (4xx) means full access, as RFC 9309 says.
 */
export class PoliteClient {
  /** @type {Map<string, import('./robots.js').Group[] | null>} */
  #robots = new Map();

  /**
   * @param {string} origin
   * @returns {Promise<import('./robots.js').Group[] | null>}
   */
  async #rulesFor(origin) {
    if (this.#robots.has(origin)) return this.#robots.get(origin) ?? null;
    /** @type {import('./robots.js').Group[] | null} */
    let rules = null;
    try {
      const res = await botFetch(`${origin}/robots.txt`);
      if (res.ok) rules = parseRobots(await res.text());
      else if (res.status >= 400 && res.status < 500) rules = [];
    } catch {
      rules = null;
    }
    this.#robots.set(origin, rules);
    return rules;
  }

  /**
   * @param {string} url
   * @returns {Promise<{ ok: true, text: string } | { ok: false, reason: string }>}
   */
  async get(url) {
    const u = new URL(url);
    const rules = await this.#rulesFor(u.origin);
    if (rules === null) return { ok: false, reason: 'robots.txt unreachable' };
    if (!isAllowed(rules, 'throwlistbot', u.pathname + u.search)) return { ok: false, reason: 'robots.txt disallows it' };
    try {
      const res = await botFetch(url);
      const text = await res.text();
      if (!res.ok) return { ok: false, reason: looksLikeBotCheck(text) ? `a bot check answered (HTTP ${res.status})` : `HTTP ${res.status}` };
      return { ok: true, text };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  }
}
