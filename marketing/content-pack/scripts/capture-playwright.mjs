// Usage (after installing Playwright):
// 1) npm i -D playwright
// 2) node marketing/content-pack/scripts/capture-playwright.mjs

import { chromium, devices } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';

const desktopShots = [
  { path: '/', file: 'marketing/content-pack/screenshots/new-home-desktop.png' },
  { path: '/auth', file: 'marketing/content-pack/screenshots/new-auth-desktop.png' },
  { path: '/how-it-works', file: 'marketing/content-pack/screenshots/new-how-it-works-desktop.png' },
];

const mobileShots = [
  { path: '/', file: 'marketing/content-pack/screenshots/new-home-mobile.png' },
  { path: '/auth', file: 'marketing/content-pack/screenshots/new-auth-mobile.png' },
];

const browser = await chromium.launch({ headless: true });

const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const dpage = await desktop.newPage();
for (const s of desktopShots) {
  await dpage.goto(`${BASE_URL}${s.path}`, { waitUntil: 'networkidle' });
  await dpage.screenshot({ path: s.file, fullPage: true });
}

const mobile = await browser.newContext({ ...devices['iPhone 14'] });
const mpage = await mobile.newPage();
for (const s of mobileShots) {
  await mpage.goto(`${BASE_URL}${s.path}`, { waitUntil: 'networkidle' });
  await mpage.screenshot({ path: s.file, fullPage: true });
}

await browser.close();
console.log('Capture complete.');
