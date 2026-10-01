import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** @param {...string} parts */
export const repoPath = (...parts) => join(ROOT, ...parts);

export const USER_AGENT = 'ThrowlistBot/0.1 (+https://github.com/locksec/throwlist)';
