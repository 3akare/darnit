// Renders the brand page in headless Chromium and saves each image to assets/brand.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const html = fs.readFileSync(path.join(__dirname, '../../dist/brand/index.html'), 'utf8');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForFunction(() => Array.isArray(window.brandNames));
  const names = await page.evaluate(() => window.brandNames);
  const out = path.join(__dirname, '../../assets/brand');
  fs.mkdirSync(out, { recursive: true });
  for (const name of names) {
    const url = await page.evaluate((n) => window.renderBrand(n), name);
    const file = path.join(out, name);
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    console.log(`${name}: ${Math.round(fs.statSync(file).size / 1024)} KB`);
  }
  if (errors.length) console.log('errors', errors);
  await browser.close();
})();
