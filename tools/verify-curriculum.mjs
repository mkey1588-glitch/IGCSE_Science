// Verifies src/data curriculum against an outline file produced from the official syllabus PDF.
// Usage: node tools/verify-curriculum.mjs <outline.txt>
import fs from 'node:fs';
import { OBJECTIVES, COUNTS } from '../src/data/curriculum.js';
const outline = fs.readFileSync(process.argv[2], 'utf8').split('\n');
const official = new Map();
for (const line of outline) {
  const m = line.match(/^\s+(\[S\] )?([BCP][\d.]+)\s/);
  if (m) official.set(m[2], m[1] ? 'S' : 'C');
}
const mine = new Map(OBJECTIVES.map((o) => [o.id, o.tier]));
let errs = 0;
for (const [id, tier] of official) {
  if (!mine.has(id)) { console.log('MISSING', id, tier); errs++; }
  else if (mine.get(id) !== tier) { console.log('TIER MISMATCH', id, 'official', tier, 'mine', mine.get(id)); errs++; }
}
for (const id of mine.keys()) if (!official.has(id)) { console.log('EXTRA', id); errs++; }
console.log(`official ${official.size} | mine ${mine.size} | core ${COUNTS.core} | supplement ${COUNTS.supplement} | subtopics ${COUNTS.subtopics} | errors ${errs}`);
process.exit(errs ? 1 : 0);
