#!/usr/bin/env node
/**
 * Web E2E: cold launch -> (tutorial) -> Settings (target score via the real Stepper) -> Home ->
 * Quick Play -> Got it / Skip / Pause -> fuse blows -> Caught -> Scoreboard -> ... -> Win ->
 * Play Again, all through the real UI.
 *
 * The only use of the `window.__blurt` test hooks: shortening the fuse (the UI floor is 15 s) and
 * reading state for assertions. Phases are never faked: every fuse is blown by the real store loop.
 * Also asserts that no network request happens during play (after the initial page load).
 *
 *   node e2e/web/quick-play-to-win.mjs                 # export + serve + run
 *   BLURT_WEB_DIR=/path/to/export node e2e/web/...     # reuse an existing E2E export
 *   HEADED=1 node e2e/web/quick-play-to-win.mjs        # watch it
 *
 * See e2e/README.md.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TARGET = 2; // points to win, set through the Settings stepper (default 7 -> 2)
const FUSE_MS = { fuseMinMs: 2_000, fuseMaxMs: 3_000 };

const log = (...a) => console.log('[e2e]', ...a);
function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

// ---- 1. export --------------------------------------------------------------------------------
function exportWeb() {
  if (process.env.BLURT_WEB_DIR) {
    assert(existsSync(path.join(process.env.BLURT_WEB_DIR, 'index.html')), 'BLURT_WEB_DIR has no index.html');
    return process.env.BLURT_WEB_DIR;
  }
  const out = mkdtempSync(path.join(os.tmpdir(), 'blurt-web-'));
  log('exporting web build to', out);
  const res = spawnSync('npx', ['expo', 'export', '--clear', '--platform', 'web', '--output-dir', out], {
    cwd: ROOT,
    stdio: ['ignore', 'inherit', 'inherit'],
    // --clear: Metro's transform cache is shared across checkouts and can serve another worktree's
    // routes. EXPO_ROUTER_APP_ROOT: without it, an export from a git worktree can bundle another checkout's app/.
    env: { ...process.env, EXPO_PUBLIC_E2E_HOOKS: '1', EXPO_ROUTER_APP_ROOT: path.join(ROOT, 'app'), CI: '1' },
  });
  assert(res.status === 0, 'expo export failed');
  return out;
}

// ---- 2. serve ---------------------------------------------------------------------------------
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function serve(dir) {
  const port = await freePort();
  const proc = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
    cwd: dir,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  // http.server logs one line per request on stderr: every line is a real hit on the server.
  const hits = [];
  let buf = '';
  proc.stderr.on('data', (d) => {
    buf += d;
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const l of lines) if (/"(GET|POST|HEAD|PUT)/.test(l)) hits.push(l.replace(/^.*?"/, '"'));
  });
  const url = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return { url, hits, stop: () => proc.kill() };
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  proc.kill();
  throw new Error('static server did not start');
}

// ---- 3. play ----------------------------------------------------------------------------------
async function run(page, url, onPlayStart) {
  // Expo Router's stack keeps covered screens in the DOM, so only ever match visible elements.
  const sel = (testId) => `[data-testid="${testId}"]:visible`;
  const id = (testId) => page.locator(sel(testId));
  const shown = async (testId) => (await id(testId).count()) > 0;
  const either = (a, b, timeout) =>
    page
      .locator(`${sel(a)}, ${sel(b)}`)
      .first()
      .waitFor({ timeout });
  const visible = (testId, timeout = 10_000) => id(testId).first().waitFor({ state: 'visible', timeout });
  const tap = async (testId) => {
    await id(testId).first().click();
  };
  const game = () => page.evaluate(() => window.__blurt.useGame.getState().game);

  await page.goto(url, { waitUntil: 'load' });

  // Cold launch: first run shows the tutorial; skip it.
  await either('how-to-play-screen', 'home-screen', 30_000);
  if (await shown('tutorial-skip')) {
    log('tutorial shown: skipping');
    await tap('tutorial-skip');
  }
  await visible('home-screen');

  // Settings: points to win 7 -> TARGET with the real stepper.
  await tap('home-settings');
  await visible('settings-screen');
  const startTarget = await page.evaluate(() => window.__blurt.useSettings.getState().defaultRules.targetScore);
  for (let i = startTarget; i > TARGET; i--) await tap('settings-target-dec');
  const target = await page.evaluate(() => window.__blurt.useSettings.getState().defaultRules.targetScore);
  assert(target === TARGET, `target score set to ${TARGET} via the UI (got ${target})`);
  await tap('settings-back');
  await visible('home-screen');

  // Test hook (allowed): shorten the hidden fuse below the UI's 15 s floor.
  await page.evaluate((fuse) => window.__blurt.useSettings.getState().setDefaultRules(fuse), FUSE_MS);

  // Initial load is over (bundle, fonts, sounds preloaded). From here on: airplane mode, and
  // every request the page still tries to make is recorded.
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1_000);
  const requests = [];
  page.on('request', (r) => requests.push({ type: r.resourceType(), method: r.method(), url: r.url() }));
  await page.context().setOffline(true);
  onPlayStart();

  // Quick Play: one tap to the first phrase.
  await tap('home-quick-play');
  await visible('round-screen');
  let g = await game();
  assert(g.phase === 'playing' && g.round === 1, 'quick play starts round 1');
  assert(g.settings.packIds.length === 1 && g.settings.packIds[0] === 'everything-mix', 'quick play uses the mix');
  assert(g.settings.targetScore === TARGET, 'quick play uses the saved target');
  const phrase1 = (await id('round-phrase').first().innerText()).trim();
  assert(phrase1.length > 0, 'a phrase is shown');
  log(`round 1, first phrase: "${phrase1}"`);

  // Pause right away: the phrase is hidden and the fuse stays frozen past its full length.
  await tap('round-pause');
  await visible('round-resume');
  assert((await game()).phase === 'paused', 'paused');
  assert(!(await id('round-phrase').first().innerText()).includes(phrase1), 'phrase hidden while paused');
  await page.waitForTimeout(FUSE_MS.fuseMaxMs + 500);
  assert((await game()).phase === 'paused', 'fuse frozen while paused');
  await tap('round-resume');
  await visible('round-got-it');

  // Got it, then an immediate double tap: one advance only.
  const holder0 = (await game()).holderTeamIndex;
  await id('round-got-it').first().dblclick();
  g = await game();
  assert(g.phase === 'playing', 'still playing after got it');
  assert(g.holderTeamIndex === (holder0 + 1) % 2, 'double tap advanced exactly one holder');
  assert(g.stats.gotIt[g.settings.teams[holder0].id] === 1, 'double tap counted once');
  const phrase2 = (await id('round-phrase').first().innerText()).trim();
  assert(phrase2 !== phrase1, 'new phrase after got it');
  await page.waitForTimeout(350);
  if (await shown('round-skip')) {
    await tap('round-skip');
    await page.waitForTimeout(350);
  }

  // Play rounds until someone wins. Every catch is the real fuse loop.
  let rounds = 0;
  for (;;) {
    await either('caught-screen', 'win-screen', 15_000);
    if (await shown('win-screen')) break;
    rounds++;
    const headline = await id('caught-headline').first().innerText();
    assert(/got caught!/.test(headline), `caught headline: ${headline}`);
    log(`round ${rounds}: ${headline.replace(/\s+/g, ' ')}`);
    await tap('caught-continue');
    await either('scoreboard-screen', 'win-screen', 10_000);
    if (await shown('win-screen')) break;
    await tap('scoreboard-next');
    await visible('round-screen');
    // A couple of passes per round so the holder varies.
    await page.waitForTimeout(300);
    if ((await game())?.phase === 'playing') await tap('round-got-it').catch(() => {});
    assert(rounds < 20, 'game ends');
  }

  g = await game();
  const winnerScore = g.scores[g.winnerTeamId];
  const others = Object.entries(g.scores).filter(([t]) => t !== g.winnerTeamId);
  assert(g.phase === 'won', 'phase won');
  assert(winnerScore === TARGET, `won exactly at the target (${winnerScore})`);
  assert(
    others.every(([, s]) => s < TARGET),
    'no other team reached the target',
  );
  const headline = await id('win-headline').first().innerText();
  log(`win: ${headline.replace(/\s+/g, ' ')} ${JSON.stringify(g.scores)}`);

  // Play Again keeps settings and starts round 1.
  const settingsBefore = JSON.stringify(g.settings);
  await tap('win-play-again');
  await visible('round-screen');
  g = await game();
  assert(g.phase === 'playing' && g.round === 1, 'play again starts round 1');
  assert(JSON.stringify(g.settings) === settingsBefore, 'play again keeps settings');
  assert(
    Object.values(g.scores).every((s) => s === 0),
    'play again resets scores',
  );

  // Leave via the host menu (long press on pause), back Home.
  await id('round-pause').first().click({ delay: 900 });
  await visible('round-host-menu');
  await tap('round-quit');
  await tap('round-quit-confirm');
  await visible('home-screen');
  assert((await game()) === null, 'quit clears the game');

  return { requests, rounds };
}

// ---- main -------------------------------------------------------------------------------------
const dir = exportWeb();
const server = await serve(dir);
const browser = await chromium.launch({ headless: !process.env.HEADED });
let failed = false;
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: false });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push({ text: `pageerror: ${e.message}`, url: '' }));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push({ text: `console.error: ${m.text()}`, url: m.location().url ?? '' });
  });

  let hitsBefore = 0;
  const { requests, rounds } = await run(page, server.url, () => (hitsBefore = server.hits.length));
  const serverHits = server.hits.slice(hitsBefore);
  log(`server hits during play: ${serverHits.length}`, serverHits);
  log(`played ${rounds} caught round(s) to the win`);

  // Network check. The page is offline during play, the static server must log zero hits, and
  // the page must not even try a network request. blob: URLs are in-memory (src/audio preloads
  // every sound into expo-audio's blob cache on web), so they are never network.
  // Without STRICT_NETWORK=1, one legacy exception is tolerated and reported: an <audio> element
  // re-reading a bundled sound file (same origin, under /assets/, resource type "media"). The
  // full web preload in src/audio removed those; STRICT_NETWORK=1 fails on any.
  const origin = new URL(server.url).origin;
  const bundledSound = (r) =>
    r.type === 'media' && r.method === 'GET' && r.url.startsWith(`${origin}/assets/`) && /\.(wav|m4a)$/.test(r.url);
  const inMemory = (r) => r.url.startsWith('blob:') || r.url.startsWith('data:');
  const allowed = (r) => inMemory(r) || (!process.env.STRICT_NETWORK && bundledSound(r));
  const offending = requests.filter((r) => !allowed(r));
  const tolerated = requests.filter(allowed);
  assert(serverHits.length === 0, `server saw no request during play, got:\n  ${serverHits.join('\n  ')}`);
  assert(
    offending.length === 0,
    `no network requests during play, got:\n  ${offending.map((r) => `${r.type} ${r.method} ${r.url}`).join('\n  ')}`,
  );
  const reReads = tolerated.filter((r) => !inMemory(r)).length;
  log(`network: 0 requests during play (offline; ${reReads} audio re-reads of bundled sounds tolerated)`);
  // Offline, Chromium logs "Failed to load resource" for the tolerated audio re-reads above.
  const toleratedUrls = new Set(tolerated.map((r) => r.url));
  const realErrors = errors.filter((e) => !(/Failed to load resource/.test(e.text) && toleratedUrls.has(e.url)));
  assert(
    realErrors.length === 0,
    `no page errors, got:\n  ${realErrors.map((e) => `${e.text} ${e.url}`).join('\n  ')}`,
  );
  log('PASS');
} catch (e) {
  failed = true;
  console.error('[e2e] FAIL', e);
} finally {
  await browser.close();
  server.stop();
  if (!process.env.BLURT_WEB_DIR && !process.env.KEEP_EXPORT) rmSync(dir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
