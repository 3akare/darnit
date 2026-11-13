// Turns dist/preview/index.html into page content for a claude.ai Artifact, which wraps the
// file in its own <html>/<head>/<body>. Usage: node tools/make-test-page.mjs <output.html>
// Run `npm run preview:build` first.

import { readFileSync, writeFileSync } from 'node:fs';

const [, , target] = process.argv;
if (!target) throw new Error('usage: node tools/make-test-page.mjs <output.html>');

const html = readFileSync(new URL('../dist/preview/index.html', import.meta.url), 'utf8');
const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'));
const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));
const title = head.match(/<title>[^<]*<\/title>/)?.[0] ?? '<title>DarnIt! Test Build</title>';
const rest = head.replace(/<title>[^<]*<\/title>/, '').replace(/<meta[^>]*>/g, '').trim();
writeFileSync(target, `${title}\n<meta name="claude:viewport-fit-sides" content="cover">\n${rest}\n${body.trim()}\n`);
console.log(`wrote ${target}`);
