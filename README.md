# CATALYST — Mysteries of Brightwater Island

A 3D browser science adventure covering the full **Cambridge IGCSE Co-ordinated Sciences (Double Award) 0654, 2025–2027** syllabus (a superset of Combined Science 0653): Biology, Chemistry and Physics, Core and Supplement.

## Play it

Live at **https://igcse-science.vercel.app**. Progress is saved in each player's own browser (localStorage), so every player keeps their own save.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

Requires Node 20.19+ or 22.12+ (for Vite 8) and a WebGL2 browser. Headphones recommended (all audio is synthesised).

## Deploy

Vercel deploys the site from this repository on every push to `main`. `vercel.json` sets the build (`npm run build`, output `dist/`) and caches the hashed files in `dist/assets/` for a year. The build uses relative paths, so `dist/` also works as it is on any other static host.

```bash
npm run build:artifact   # also writes dist/catalyst.html: the page as a body fragment for claude.ai Artifacts
```

For a claude.ai Artifact, publish `dist/catalyst.html` as the page with every file in `dist/assets/` alongside it at `assets/<name>`.

## What's in it

| Part | Count | Where |
|---|---|---|
| Syllabus objectives (Core 411 + Supplement 239) | 650 in 142 sub-topics | `src/data/curriculum_*.js` |
| Real-life quests (talk, scan, visit, labs, quizzes, cause-and-effect chains, choices) | 51 quests, 229 steps | `src/data/quests.js` |
| Hands-on virtual experiments (many with several benches) | 41 | `src/lab/experiments/` |
| Interactive 3D holo-models with hotspots and step-through stories | 16 | `src/lab/holos/` |
| Exam-style questions + randomised calculation generators | 376 + 27 | `src/data/questions.js` |
| Concept links between sub-topics (94 cross-subject) | 215 | `src/data/links.js` |

**Interconnections:** every sub-topic is a star in the *Constellation of Knowledge*; links glow as you master both ends or solve chain puzzles (e.g. particle motion ↔ diffusion ↔ gas exchange).

## Checks

```bash
node tools/verify-curriculum.mjs <outline.txt>   # 650/650 objectives, tiers match the official syllabus
node tools/check-links.mjs                       # 215 links, every sub-topic linked
npm test                                         # component tests: the real game modules in a simulated page (Vitest + happy-dom)
npm run test:browser                             # builds, then browser tests in Google Chrome (Playwright)
```

The browser tests use the installed Google Chrome. To use Playwright's own browser instead, run `npx playwright install chromium` once and set `PW_CHANNEL=chromium`.

## How progress is credited

- **● discovered:** seen in a scan, quest, 3D model or lab.
- **●● practised:** the experiment work for that objective, or one question on it answered right first time.
- **●●● mastered:** a second, different question answered right, or a right answer backed by the experiment work.

On the **Core** tier, Supplement steps, questions, lab tabs and quest steps are optional extras (the syllabus data decides which), and credit never spreads to Supplement objectives the learner did not do. Saves from earlier versions keep their quests, XP, links and achievements; an objective that was "mastered" after a single answer shows as practised until a second answer or lab work confirms it.

Coverage at the time of writing: all 142 sub-topics appear in quests, in at least one lab or holo-model, and in at least two quiz questions.

## Controls

WASD / click to move, drag to look, E to interact, Q quest log, C codex, K constellation. In labs: drag to orbit, click apparatus, use the side panel.
