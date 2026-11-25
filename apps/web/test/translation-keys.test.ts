import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resourcesFor } from '../src/lib/i18n/create';

/**
 * DoD §1: "no translation key renders as a raw key". Every literal `t('…')` in the
 * product is resolved against the file's namespace (`useTranslation('ns')`, or `auth`
 * for server pages using `getTranslator`) and must exist in sr, en and ru, for the
 * wedding and the celebration overlay. Dynamic keys (template strings) are skipped.
 */
const ROOT = join(__dirname, '..');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' || name.startsWith('.') ? [] : files(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });

const lookup = (tree: unknown, path: string[]): unknown =>
  path.reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    tree,
  );

const exists = (resources: Record<string, Record<string, unknown>>, ns: string, key: string): boolean => {
  const path = key.split('.');
  const parent = lookup(resources[ns], path.slice(0, -1));
  const leaf = path.at(-1) ?? '';
  if (!parent || typeof parent !== 'object') return false;
  const record = parent as Record<string, unknown>;
  return (
    typeof record[leaf] === 'string' ||
    typeof record[`${leaf}_one`] === 'string' ||
    typeof record[`${leaf}_other`] === 'string'
  );
};

type Use = { file: string; ns: string; key: string };

const collectUses = (): Use[] => {
  const uses: Use[] = [];
  for (const file of [...files(join(ROOT, 'app')), ...files(join(ROOT, 'src'))]) {
    const source = readFileSync(file, 'utf8');
    // Each `t(` belongs to the nearest preceding `useTranslation` (a file can hold
    // several components); server pages use `getTranslator`, whose default is `auth`.
    const scopes = [...source.matchAll(/useTranslation\(\s*(?:'([a-zA-Z]+)')?/g)].map((match) => ({
      at: match.index ?? 0,
      ns: match[1] ?? 'auth',
    }));
    const serverDefault = /getTranslator\(/.test(source) ? 'auth' : null;
    if (!scopes.length && !serverDefault) continue;
    for (const match of source.matchAll(/\bt\(\s*'([^'$]+)'/g)) {
      const at = match.index ?? 0;
      const scope = scopes.filter((entry) => entry.at < at).at(-1);
      const defaultNs = scope?.ns ?? serverDefault ?? scopes[0]?.ns ?? 'auth';
      const raw = match[1] as string;
      const [ns, key] = raw.includes(':') ? (raw.split(':') as [string, string]) : [defaultNs, raw];
      uses.push({ file: relative(ROOT, file), ns, key });
    }
  }
  return uses;
};

describe('translation keys used in the product', () => {
  const uses = collectUses();

  it('finds the literal keys (sanity)', () => {
    expect(uses.length).toBeGreaterThan(200);
  });

  for (const language of ['sr', 'en', 'ru'] as const) {
    for (const eventType of ['wedding', 'celebration'] as const) {
      it(`all resolve in ${language} (${eventType})`, () => {
        const resources = resourcesFor(language, eventType)[language] as Record<string, Record<string, unknown>>;
        const missing = uses
          .filter((use) => !exists(resources, use.ns, use.key))
          .map((use) => `${use.file}: ${use.ns}:${use.key}`);
        expect([...new Set(missing)]).toEqual([]);
      });
    }
  }
});
