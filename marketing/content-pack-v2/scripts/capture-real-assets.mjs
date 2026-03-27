import { chromium, devices } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

const base = process.env.BASE_URL || 'http://127.0.0.1:3003';
const out = path.join(process.cwd(), 'marketing/content-pack-v2');

async function ensure(p) { await fs.mkdir(p, { recursive: true }); }

async function shot(page, route, file, fullPage = true) {
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(out, 'screenshots', file), fullPage });
}

async function recordDesktopClip(route, file, actions) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: path.join(out, 'videos'), size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  if (actions) await actions(page);
  await page.waitForTimeout(1200);
  const video = page.video();
  await context.close();
  if (video) {
    const src = await video.path();
    const dest = path.join(out, 'videos', file);
    await fs.rename(src, dest);
  }
}

await ensure(path.join(out, 'screenshots'));
await ensure(path.join(out, 'videos'));

const browser = await chromium.launch({ headless: true });

// Desktop screenshots
const d = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const dp = await d.newPage();
await shot(dp, '/', '01-home-desktop.png');
await shot(dp, '/how-it-works', '02-how-it-works-desktop.png');
await shot(dp, '/auth', '03-auth-desktop.png');
await shot(dp, '/privacy', '04-privacy-desktop.png');
await shot(dp, '/terms', '05-terms-desktop.png');
await d.close();

// Mobile screenshots
const m = await browser.newContext({ ...devices['iPhone 14'] });
const mp = await m.newPage();
await shot(mp, '/', '06-home-mobile.png');
await shot(mp, '/auth', '07-auth-mobile.png');
await shot(mp, '/how-it-works', '08-how-it-works-mobile.png');
await m.close();

// Videos
await recordDesktopClip('/', '01-home-scroll.webm', async (page) => {
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(800);
  await page.mouse.wheel(0, -600);
});

await recordDesktopClip('/how-it-works', '02-how-it-works-scroll.webm', async (page) => {
  await page.mouse.wheel(0, 1400);
  await page.waitForTimeout(800);
  await page.mouse.wheel(0, -500);
});

await recordDesktopClip('/auth', '03-auth-interaction.webm', async (page) => {
  await page.click('text=Create account').catch(() => {});
  await page.waitForTimeout(700);
  await page.fill('input[type="email"]', 'name@company.com').catch(() => {});
  await page.fill('input[type="password"]', 'password1234').catch(() => {});
});

await browser.close();

await fs.writeFile(path.join(out, 'README.md'), `# Content Pack v2 (Real Captures)\n\nCaptured from: ${base}\n\n- 8 fresh screenshots in ./screenshots\n- 3 fresh video clips in ./videos\n`);

console.log('CAPTURE_DONE');
