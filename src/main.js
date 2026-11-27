import { Engine } from './core/engine.js';
import { audio } from './core/audio.js';
import { state, load, save, raise, addXP, checkAchievements } from './core/state.js';
import { bus } from './core/events.js';
import { UI, restoreFocus } from './ui/ui.js';
import { World } from './world/world.js';
import { LabView } from './lab/lab.js';
import { ConstellationView } from './constellation/constellation.js';
import { QuestSystem } from './quests/questSystem.js';
import { game } from './game.js';
document.documentElement.lang ||= 'en'; // hosts that wrap the page in their own <html> may not set it
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

const $ = (id) => document.getElementById(id);
const nextFrame = () => new Promise((r) => setTimeout(r, 16));
function setLoad(p, msg) { $('load-fill').style.width = p + '%'; if (msg) $('load-msg').textContent = msg; }

async function boot() {
  try {
    setLoad(6, 'Mixing reagents…');
    load();
    document.documentElement.style.setProperty('--ts', state.settings.textScale || 1);
    await nextFrame();
    const engine = (game.engine = new Engine($('viewport')));
    engine.setQuality(state.settings.quality);
    audio.setVolumes({ sfx: state.settings.sfx, music: state.settings.music });
    setLoad(18, 'Raising the island from the sea…');
    await nextFrame();
    const uiRoot = $('ui');
    const ui = (game.ui = new UI(uiRoot));
    game.quests = new QuestSystem();
    const world = (game.world = new World(engine));
    engine.register(world);
    setLoad(72, 'Setting up the Lumen Lab…');
    await nextFrame();
    const lab = (game.lab = new LabView(engine, uiRoot));
    engine.register(lab);
    setLoad(88, 'Aligning the constellation…');
    await nextFrame();
    const cons = (game.constellation = new ConstellationView(engine, uiRoot));
    engine.register(cons);
    engine.setView(world);
    world.setMode('title');
    engine.onFrame = (dt) => { if (game.mode === 'world') ui.tick(dt); if (game.mode !== 'title') state.playTime += dt; };
    engine.start();
    setLoad(100, 'Ready.');
    await wait(0.25);
    $('loading').classList.add('done');
    setTimeout(() => $('loading').remove(), 800);
    game.mode = 'title';
    ui.showTitle({ onContinue: () => enterWorld(false), onNew: () => enterWorld(true) });
    setInterval(() => { if (game.mode !== 'title') save(); }, 20000);
    // save when the tab closes, reloads or goes to the background (phones rarely fire beforeunload)
    const saveNow = () => { if (game.mode !== 'title') save(); };
    window.addEventListener('beforeunload', saveNow);
    window.addEventListener('pagehide', saveNow);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
  } catch (e) {
    console.error(e);
    setLoad(100, 'Something went wrong starting the game: ' + (e.message || e) + '. WebGL 2 is required.');
  }
}

game.fade = async (fn) => {
  const f = $('fade');
  f.classList.add('on');
  await wait(0.36);
  try { await fn(); } catch (e) { console.error(e); }
  await wait(0.05);
  f.classList.remove('on');
};

async function enterWorld(isNew) {
  audio.init();
  await game.fade(async () => {
    game.mode = 'world';
    game.world.setMode('play');
    if (isNew) game.world.teleport(game.world.zoneSpawn('lab'));
    game.ui.showHUD(true);
    audio.startMusic(); audio.setMood('world');
  });
  if (isNew) {
    await game.ui.story([
      'Brightwater is a small island with a big tradition. Every year the islanders hold the **Festival of Light**, when the old Lumen Beacon on Observatory Hill shines out across the sea.',
      'This year, everything is going wrong. Bread won’t rise, the pier is rusting, the grid is failing and the beacon has been dark for years. The islanders have forgotten how their world works.',
      'You are the new apprentice at the **Lumen Lab**. Your tools: field scans, a virtual laboratory, 3D holo-models — and your curiosity. Every idea you master becomes a star in the **Constellation of Knowledge**. Connect enough of them, and the beacon will shine again.',
    ]);
  }
  if (!state.quests.q_first_day) await game.quests.kickoff();
  game.ui.updateHUD();
}

game.onInteract = (t) => {
  switch (t.kind) {
    case 'npc': game.quests.talkTo(t.id); break;
    case 'poi': game.ui.scan(t.id); break;
    case 'lab': game.ui.openCatalog('exp'); break;
    case 'holo': game.ui.openCatalog('holo'); break;
    case 'codex': game.ui.openCodex(); break;
    case 'constellation': game.openConstellation(); break;
    default: break;
  }
};

game.onScanned = (poi, first) => {
  state.scanned[poi.id] = true;
  if (first) { state.stats.scans++; addXP(15, 'scan'); }
  raise(poi.ids, 1, 'scan');
  bus.emit('scan', poi.id);
  checkAchievements();
  save();
};

// Leaving a lab or the constellation puts keyboard focus back on what opened it, or on the
// quest tracker's next action (or the 3D view) when that control has gone.
let opener = null;
const backToIsland = () => restoreFocus(opener, document.querySelector('.hud-quest .btn.primary') || document.querySelector('.hud-quest button'));

game.openLab = (id, opts = {}) => {
  if (game.mode === 'world') opener = document.activeElement;
  return game.fade(async () => {
    game.ui.closeAllModals();
    game.engine.setView(game.lab);
    game.mode = 'lab';
    game.ui.showHUD(false);
    const ok = await game.lab.open(id, opts);
    if (!ok) { game.engine.setView(game.world); game.mode = 'world'; game.ui.showHUD(true); backToIsland(); }
  });
};

game.closeLab = () => game.fade(async () => {
  game.lab.close();
  game.engine.setView(game.world);
  game.mode = 'world';
  game.ui.showHUD(true);
  game.ui.updateHUD();
  game.world.refreshSky();
  save();
}).then(backToIsland);

game.openConstellation = () => {
  if (game.mode === 'world') opener = document.activeElement;
  return game.fade(async () => {
    game.ui.closeAllModals();
    game.engine.setView(game.constellation);
    game.mode = 'constellation';
    game.ui.showHUD(false);
    game.constellation.enter();
  });
};

game.closeConstellation = () => game.fade(async () => {
  game.constellation.leave();
  game.engine.setView(game.world);
  game.mode = 'world';
  game.ui.showHUD(true);
  audio.setMood('world');
}).then(backToIsland);

// Expose for debugging in the console.
window.CATALYST = game;
boot();
