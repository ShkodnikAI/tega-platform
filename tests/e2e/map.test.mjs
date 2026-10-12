// Local e2e check of the portfolio map (needs: mlog serve on :8080 behind Caddy on :10000, playwright-core, chromium).
// Usage: BASE=http://localhost:10000 CHROMIUM=/path/to/chrome node tests/e2e/map.test.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:10000';
const sample = fs.readFileSync(new URL('../fixtures/objects.sample.json', import.meta.url), 'utf8');
let failed = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failed++; };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.route('**/tile.openstreetmap.org/**', r => r.abort());
await page.route('**/static/data/objects.json', r => r.fulfill({ contentType: 'application/json', body: sample }));
page.on('dialog', d => { ok(false, 'unexpected dialog (XSS?)'); d.dismiss(); });
await page.goto(BASE + '/portfolio');
await page.waitForSelector('.pin');
ok((await page.locator('.pin').count()) === 3, '3 markers rendered');
ok((await page.locator('#obj-list li').count()) === 3, '3 list rows');
ok((await page.textContent('#obj-count')).includes('3 из 3'), 'counter 3 of 3');
await page.fill('#obj-q', 'магазин');
ok((await page.locator('.pin').count()) === 1, 'search "магазин" -> 1 marker');
await page.fill('#obj-q', '');
await page.selectOption('#obj-type', 'Офисы');
ok((await page.locator('.pin').count()) === 1, 'type filter "Офисы" -> 1 marker');
await page.selectOption('#obj-type', '');
await page.locator('.pin').first().click();
ok(await page.locator('#obj-card').isVisible(), 'marker click opens object card');
ok((await page.textContent('#obj-card h3')).length > 0, 'card has title');
ok((await page.locator('.leaflet-popup').count()) === 1, 'popup opened');
await page.goto(BASE + '/portfolio#test-shop');
await page.waitForSelector('#obj-card:not([hidden])');
ok((await page.textContent('#obj-card h3')).includes('Магазин'), 'deep link #test-shop opens its card');
ok(await page.evaluate(() => window.__xss === undefined), 'no XSS from hostile data');
ok((await page.locator('#obj-card img[src^="javascript:"]').count()) === 0, 'javascript: photo URL ignored');
// empty dataset message
await page.unroute('**/static/data/objects.json');
await page.route('**/static/data/objects.json', r => r.fulfill({ contentType: 'application/json', body: '[]' }));
await page.goto(BASE + '/portfolio');
await page.waitForFunction(() => document.getElementById('obj-count').textContent.length > 0);
ok((await page.textContent('#obj-count')).includes('скоро появятся'), 'empty data -> friendly message');
await page.setViewportSize({ width: 390, height: 800 });
await page.goto(BASE + '/portfolio');
ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll on phone width');
await browser.close();
process.exit(failed ? 1 : 0);
