import { LINKS } from '../src/data/links.js';
import { SUBTOPICS, SUB } from '../src/data/curriculum.js';
const deg = {}; let bad = 0; const seen = new Set();
for (const l of LINKS) { for (const e of [l.a, l.b]) { if (!SUB[e]) { console.log('UNKNOWN', e, l.id); bad++; } deg[e] = (deg[e] || 0) + 1; } if (seen.has(l.id)) { console.log('DUP', l.id); bad++; } seen.add(l.id); }
const missing = SUBTOPICS.filter((s) => !deg[s.id]).map((s) => s.id);
const cross = LINKS.filter((l) => l.cross).length;
console.log('links', LINKS.length, 'cross-subject', cross, 'unknown', bad, 'subtopics without links:', missing.join(' ') || 'none');
