#!/usr/bin/env node
/**
 * Draft store screenshots (docs/screenshots/*.png) from an E2E web export, plus a cold-launch check:
 * taps and time from a fresh launch to the first phrase.
 *
 *   KEEP_EXPORT=1 node e2e/web/quick-play-to-win.mjs              # prints "Exported: <dir>"
 *   BLURT_WEB_DIR=<dir> node e2e/web/store-screenshots.mjs [outDir] # default outDir: docs/screenshots
 *
 * Chromium at 430x932 CSS px and 3x = 1290x2796, the iPhone 6.9" size. Real phrases from the
 * bundled packs. The only hook use: the Caught shot moves the running fuse's end to "now", so the
 * real store loop blows it without a 45-75 s wait. Retake on devices before submission
 * (docs/store-listing.md).
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dir = process.env.BLURT_WEB_DIR;
if (!dir || !existsSync(path.join(dir, 'index.html'))) {
  console.error('Set BLURT_WEB_DIR to an E2E web export (see the header of this file).');
  process.exit(1);
}
const out = path.resolve(process.argv[2] ?? path.join(ROOT, 'docs', 'screenshots'));
mkdirSync(out, { recursive: true });

const port = String(8700 + Math.floor(Math.random() * 200));
const server = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: dir, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1000));

const browser = await chromium.launch({ headless: !process.env.HEADED });
let failed = false;
try {
  const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 });
  const page = await context.newPage();
  const sel = (t) => `[data-testid="${t}"]:visible`;
  const id = (t) => page.locator(sel(t)).first();
  const shot = async (name) => {
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    console.log('[shots] wrote', path.join(out, `${name}.png`));
  };

  // Cold launch (fresh profile = first launch, so the tutorial shows) to the first phrase.
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await page
    .locator(`${sel('how-to-play-screen')}, ${sel('home-screen')}`)
    .first()
    .waitFor({ timeout: 30_000 });
  let taps = 0;
  if (await page.locator(sel('tutorial-skip')).count()) {
    await id('tutorial-skip').click();
    taps++;
  }
  await id('home-screen').waitFor();
  await page.waitForTimeout(400);
  await shot('home');
  await id('home-quick-play').click();
  taps++;
  await id('round-phrase').waitFor();
  console.log(`[shots] cold launch to first phrase: ${taps} taps, ${Date.now() - t0} ms (headless, no reading time)`);

  // Round: pass until a short, plain-ASCII, 2+ word phrase is up (reads well on a store page).
  for (let i = 0; i < 40; i++) {
    const p = (await id('round-phrase').innerText()).trim();
    if (p.split(/\s+/).length >= 2 && p.length <= 18 && /^[\x20-\x7E]+$/.test(p)) break;
    await page.waitForTimeout(350);
    await id('round-got-it').click();
  }
  await page.waitForTimeout(600);
  console.log('[shots] round phrase:', (await id('round-phrase').innerText()).trim());
  await shot('round');

  // Caught: end the running fuse now; the store's fuse loop does the rest.
  await page.evaluate(() => {
    const { game } = window.__blurt.useGame.getState();
    window.__blurt.useGame.setState({ game: { ...game, fuseEndsAt: Date.now() + 300 } });
  });
  await id('caught-screen').waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1500); // let the flash and the +1 badge settle
  await shot('caught');

  // Pack Picker: Custom Game -> Choose packs, a few packs selected, grid scrolled to the top.
  await id('caught-continue').click();
  await id('scoreboard-screen').waitFor();
  await page.evaluate(() => window.__blurt.useGame.getState().quitGame());
  await id('home-screen').waitFor();
  await id('home-custom-game').click();
  await id('setup-choose-packs').click();
  await id('packs-screen').waitFor();
  await page.waitForTimeout(400);
  for (const p of ['pack-movies', 'pack-food-drink', 'pack-animals', 'pack-video-games']) {
    if (await page.locator(sel(p)).count()) await id(p).click();
  }
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) if (el.scrollTop > 0) el.scrollTop = 0;
  });
  await page.waitForTimeout(700);
  await shot('pack-picker');
} catch (e) {
  failed = true;
  console.error('[shots] FAIL', e);
} finally {
  await browser.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
