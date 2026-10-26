/**
 * Content and store policy checks (PRD 9 and 11): no competitor trademarks in anything a player or
 * store reviewer reads, no purchase prompts, and no analytics, ad, crash-reporting or billing SDK
 * in the dependency tree ("Data Not Collected"). The generic word "catchphrase" is fine; the
 * two-word mark is not. Sound licenses are checked in src/audio/catalog.test.ts.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const TRADEMARKS = /catch[\s-]+phrase|phrase[\s-]*frenzy|brain[\s-]*rice/i;
/** Package names that would collect data, show ads or take payments. */
const DATA_OR_PAYMENT_SDK =
  /analytics|firebase|sentry|bugsnag|crashlytics|amplitude|segment|mixpanel|posthog|datadog|newrelic|instabug|appsflyer|adjust|branch|onesignal|admob|mobile-ads|facebook|fbsdk|tracking-transparency|expo-insights|expo-updates|react-native-iap|expo-iap|purchases|billing/i;
const PURCHASE = /\b(purchase|buy now|unlock (this|all|more)|premium|subscribe|in-app purchase)\b|\$\s?\d/i;

function files(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p, exts));
    else if (exts.some((e) => name.endsWith(e)) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Everything that ships as user-facing copy or goes on a store page. */
const shipped = [
  ...files(path.join(ROOT, 'app'), ['.tsx', '.ts']),
  ...files(path.join(ROOT, 'src'), ['.tsx', '.ts']),
  ...files(path.join(ROOT, 'content', 'packs'), ['.json']),
  path.join(ROOT, 'app.config.ts'),
  path.join(ROOT, 'docs', 'store-listing.md'),
  path.join(ROOT, 'docs', 'privacy-policy.md'),
];

describe('policy', () => {
  it.each(shipped.map((f) => [path.relative(ROOT, f), f]))('%s has no competitor trademark', (_rel, file) => {
    const hit = readFileSync(file, 'utf8').match(TRADEMARKS);
    expect(hit?.[0] ?? null).toBeNull();
  });

  it('app screens and the design system have no purchase prompt', () => {
    for (const file of [...files(path.join(ROOT, 'app'), ['.tsx']), ...files(path.join(ROOT, 'src', 'ui'), ['.tsx'])]) {
      const hit = readFileSync(file, 'utf8').match(PURCHASE);
      expect({ file: path.relative(ROOT, file), hit: hit?.[0] ?? null }).toEqual({
        file: path.relative(ROOT, file),
        hit: null,
      });
    }
  });

  it('has no analytics, ads, crash-reporting, update or billing SDK in the dependency tree', () => {
    const lock = JSON.parse(readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8')) as {
      packages: Record<string, unknown>;
    };
    const names = Object.keys(lock.packages).map((k) => k.replace(/^.*node_modules\//, ''));
    expect(names.length).toBeGreaterThan(100);
    expect(names.filter((n) => DATA_OR_PAYMENT_SDK.test(n))).toEqual([]);
  });
});
