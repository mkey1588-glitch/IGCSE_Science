import { describe, it, expect, vi, afterEach } from 'vitest';
import { freshGame } from './helpers/harness.js';

async function realUI(opts) {
  const ctx = await freshGame(opts);
  const { UI } = await import('../../src/ui/ui.js');
  const ui = new UI(ctx.uiRoot);
  ctx.game.ui = ui;
  return { ctx, ui };
}
const textNodes = (root) => { const out = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) out.push(n.textContent); return out; };
const key = (target, code, k) => { const ev = new KeyboardEvent('keydown', { code, key: k, bubbles: true, cancelable: true }); target.dispatchEvent(ev); return ev; };

afterEach(() => vi.useRealTimers());

describe('dialogue choices with the keyboard', () => {
  it('Enter and Space on a focused choice are left to the button, and focus returns afterwards', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const { ui } = await realUI();
    const opener = document.createElement('button'); opener.textContent = 'opener'; document.body.append(opener); opener.focus();
    const done = ui.dialogue([{ who: 'okafor', text: 'Is the fig tree alive?' }], { choices: [{ label: 'Yes, it shows the life processes', ok: true }, { label: 'No', ok: false, fb: 'Think again.' }] });
    vi.advanceTimersByTime(2000); // finish typing; the choices appear
    const choices = [...document.querySelectorAll('.dialogue .choice')];
    expect(choices).toHaveLength(2);
    expect(choices.every((c) => c.tagName === 'BUTTON')).toBe(true);
    expect(document.activeElement).toBe(choices[0]); // focus moves to the first choice
    const wrong = choices.find((c) => c.textContent === 'No');
    wrong.focus();
    expect(key(wrong, 'Space', ' ').defaultPrevented).toBe(false);
    wrong.click(); // what the browser does for Space on a focused button
    expect(wrong.classList.contains('wrong')).toBe(true);
    const right = choices.find((c) => c.textContent.startsWith('Yes'));
    right.focus();
    expect(key(right, 'Enter', 'Enter').defaultPrevented).toBe(false);
    right.click();
    vi.advanceTimersByTime(2000);
    const res = await done;
    expect(res.ok).toBe(true);
    expect(document.activeElement).toBe(opener);
  });

  it('the dialogue advances with a native Continue button', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const { ui } = await realUI();
    const done = ui.dialogue([{ who: 'okafor', text: 'One.' }, { who: 'okafor', text: 'Two.' }]);
    vi.advanceTimersByTime(500);
    const next = document.querySelector('.dialogue button.next');
    expect(next).not.toBeNull();
    expect(document.activeElement).toBe(next);
    next.click(); vi.advanceTimersByTime(500);
    expect(document.querySelector('.dialogue .text').textContent).toBe('Two.');
    document.querySelector('.dialogue button.next').click();
    expect(await done).toBeNull();
  });
});

describe('quiz number answers with the keyboard', () => {
  it('Enter submits the answer and the feedback stays on screen: the same key press does not also press Next', async () => {
    const { ctx, ui } = await realUI({ tier: 'extended' });
    const { runQuiz } = await import('../../src/ui/quiz.js');
    for (let i = 0; i < 200; i++) { // draw until a question with a typed answer comes up
      runQuiz(ui, { title: 'Practice · P1.4 Density', subs: ['P1.4'], n: 1 });
      if (document.querySelector('.quiz input')) break;
      ui.closeAllModals();
    }
    const card = document.querySelector('.quiz');
    const inp = card.querySelector('input');
    const m = card.querySelector('.q').textContent.match(/mass of (\d+) g and displaces (\d+) cm³/);
    inp.value = String(+m[1] / +m[2]);
    const ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
    inp.dispatchEvent(ev);
    // a cancelled keydown stops the browser sending this key's keypress on to the Next button focused meanwhile
    expect(ev.defaultPrevented).toBe(true);
    expect(card.querySelector('.expl').classList.contains('hidden')).toBe(false);
    expect(card.querySelector('.expl').textContent).toMatch(/Correct/);
    expect(document.activeElement.textContent).toMatch(/See results/);
    void ctx;
  });
});

describe('overlays restore focus', () => {
  it('a modal takes focus and gives it back when closed', async () => {
    const { ui } = await realUI();
    const opener = document.createElement('button'); document.body.append(opener); opener.focus();
    const m = ui.modal({ title: 'Test', body: document.createElement('div') });
    expect(m.panel.contains(document.activeElement)).toBe(true);
    m.close();
    expect(document.activeElement).toBe(opener);
  });
});

describe('the quest card keeps keyboard focus', () => {
  it('the once-a-second refresh does not destroy the focused button; a real change refocuses the same control', async () => {
    const { ctx, ui } = await realUI();
    ctx.game.quests.start('q_first_day');
    ctx.game.onScanned(ctx.world.POIS.find((p) => p.id === 'lab_fig'));
    await ctx.advance(1);
    ui.updateQuestTracker();
    const action = [...ui.quest.querySelectorAll('button')].find((b) => /Open Cell Explorer/.test(b.textContent));
    action.focus();
    for (let i = 0; i < 5; i++) ui.tick(1.1); // what the HUD does every frame in the world
    expect(document.activeElement).toBe(action);
    expect(action.isConnected).toBe(true);
    ctx.game.quests.advance('q_first_day'); // the step changes, so the card is rebuilt
    ui.updateQuestTracker();
    expect(document.activeElement.dataset.key).toBe('action');
    expect(document.activeElement.textContent).toMatch(/Answer the questions/);
  });
});

describe('new game: tier choice uses native radio buttons', () => {
  it('Core can be chosen with the radio group and starts a Core game', async () => {
    const { ctx, ui } = await realUI();
    const title = document.createElement('div'); document.body.append(title);
    let started = false;
    ui._newGameDialog(title, () => { started = true; });
    const radios = [...document.querySelectorAll('input[type=radio][name=tier]')];
    expect(radios.map((r) => r.value)).toEqual(['core', 'extended']);
    const core = radios[0];
    core.checked = true; core.dispatchEvent(new Event('change', { bubbles: true }));
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Begin adventure')).click();
    expect(started).toBe(true);
    expect(ctx.state.settings.tier).toBe('core');
  });
});

describe('no literal "null" text', () => {
  it('practice quiz cards (e.g. Osmosis) show no stray null', async () => {
    const { ui } = await realUI();
    const { runQuiz } = await import('../../src/ui/quiz.js');
    for (let i = 0; i < 5; i++) {
      runQuiz(ui, { title: 'Practice · B3.2 Osmosis', subs: ['B3.2'], n: 3 });
      const card = document.querySelector('.quiz');
      expect(textNodes(card).join('|')).not.toMatch(/\bnull\b/);
      ui.closeAllModals();
    }
  });

  it('the quest log shows no stray null for an available quest in an unvisited district', async () => {
    const { ctx, ui } = await realUI();
    ctx.state.quests.q_first_day = { status: 'done', step: 4 };
    ctx.state.visited = {};
    ui.openQuestLog('q_measure');
    expect(textNodes(document.querySelector('.modal-back')).join('|')).not.toMatch(/\bnull\b/);
  });
});
