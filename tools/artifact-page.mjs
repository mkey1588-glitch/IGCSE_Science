// Turns the Vite build (dist/index.html) into dist/catalyst.html: the same page as a body
// fragment, for hosts that wrap the page in their own <!doctype>/<head>/<body> skeleton
// (claude.ai Artifacts). The skeleton supplies the charset and viewport tags.
// Usage: npm run build:artifact
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const src = readFileSync('dist/index.html', 'utf8');
const head = src.match(/<head>([\s\S]*?)<\/head>/i)?.[1];
const body = src.match(/<body>([\s\S]*?)<\/body>/i)?.[1];
if (!head || !body) throw new Error('dist/index.html has no <head> or <body> — run vite build first');

const tags = head.match(/<(title|script)\b[\s\S]*?<\/\1>|<(meta|link)\b[^>]*>/gi) || [];
const title = tags.find((t) => /^<title/i.test(t));
const keep = tags.filter((t) => t !== title && !/^<meta\b/i.test(t)); // drop charset/viewport/theme-color
const page = [title, ...keep].join('\n') + '\n' + body.trim() + '\n';

if (/(src|href)="\/(?!\/)/.test(page)) throw new Error('absolute asset path left in page — set base: "./" in vite.config.js');
writeFileSync('dist/catalyst.html', page);
const assets = readdirSync('dist/assets');
console.log(`dist/catalyst.html written (${page.length} bytes); ${assets.length} files in dist/assets`);
