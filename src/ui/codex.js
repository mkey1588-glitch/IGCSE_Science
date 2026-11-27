import { h, clear, rich } from '../core/util.js';
import { audio } from '../core/audio.js';
import { state, subStats, tierOK, linkState, coverage, levelProgress, rankOf, ACHIEVEMENTS, sparkedCount } from '../core/state.js';
import { SUBJECTS, TOPICS, SUB, COUNTS, SYLLABUS, SECTION_NAMES } from '../data/curriculum.js';
import { LINKS, linksOf } from '../data/links.js';
import { POIS, ZONE } from '../data/world.js';
import { game } from '../game.js';

const covers = (id, subId) => id === subId || id.startsWith(subId + '.') || subId.startsWith(id + '.') || (id.length <= 3 && subId.split('.')[0] === id);

export function dots(level) {
  return h('span', { class: 'mdots' }, ...[1, 2, 3].map((k) => h('i', { class: level >= k ? `on${k}` : '' })));
}

export function whereToLearn(subId) {
  const exps = game.lab.registry.filter((e) => e.objectives.some((id) => covers(id, subId)));
  const quests = game.quests.all().filter((q) => q.objectives.some((id) => covers(id, subId)));
  const pois = POIS.filter((p) => p.ids.some((id) => covers(id, subId)));
  return { exps, quests, pois };
}

export function openCodex(ui, subId = null, tab = null) {
  let current = tab || 'syllabus';
  let sel = subId || null;
  let filter = '';
  const openTopics = new Set(sel ? [SUB[sel]?.topic] : []);
  const tabsEl = h('div', { class: 'tabs' });
  const body = h('div', { class: 'panel-body', style: { padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' } });
  const tabs = [['syllabus', '📖 Syllabus & lessons'], ['links', '✨ Connections'], ['progress', '📊 Progress'], ['practice', '🎯 Practice']];
  const renderTabs = () => { clear(tabsEl); tabs.forEach(([id, l]) => tabsEl.append(h('div', { class: `tab ${current === id ? 'on' : ''}`, onClick: () => { audio.click(); current = id; renderTabs(); render(); } }, l))); };

  const render = () => {
    clear(body);
    if (current === 'syllabus') renderSyllabus();
    else if (current === 'links') renderLinks();
    else if (current === 'progress') renderProgress();
    else renderPractice();
  };

  // ---------------------------------------------------------------- syllabus
  const renderSyllabus = () => {
    const wrap = h('div', { class: 'panel-body split', style: { flex: 1, height: '100%' } });
    const left = h('div'), right = h('div', { class: 'lesson' });
    wrap.append(left, right); body.append(wrap);
    const search = h('input', { type: 'text', placeholder: 'Search topics, e.g. "osmosis" or "P4.2"', value: filter });
    left.append(h('div', { class: 'search', style: { marginBottom: '12px' } }, search));
    const tree = h('div'); left.append(tree);
    const drawTree = () => {
      clear(tree);
      const f = filter.toLowerCase();
      for (const s of ['B', 'C', 'P']) {
        const c = coverage(s);
        const pct = Math.round(((c.seen + c.practised + c.mastered) / (3 * c.total)) * 100);
        const sec = h('div', { class: 'cx-subject' }, h('div', { class: 'hd' }, h('h3', { style: { color: SUBJECTS[s].color } }, `${SUBJECTS[s].icon} ${SUBJECTS[s].name}`), h('div', { class: 'grow' }), h('span', { class: 'faint' }, `${pct}%`)));
        for (const t of TOPICS.filter((x) => x.subject === s)) {
          const subs = t.subs.filter((st) => !f || st.id.toLowerCase().includes(f) || st.title.toLowerCase().includes(f) || t.title.toLowerCase().includes(f) || st.objectives.some((o) => o.text.toLowerCase().includes(f)));
          if (!subs.length) continue;
          const tm = t.subs.reduce((a, st) => a + subStats(st.id).frac, 0) / t.subs.length;
          const open = f || openTopics.has(t.id);
          const box = h('div', { class: 'cx-topic' }, h('div', { class: 'hd', onClick: () => { if (openTopics.has(t.id)) openTopics.delete(t.id); else openTopics.add(t.id); drawTree(); } },
            h('span', { class: 'code' }, t.id), h('span', { class: 'grow' }, t.title), h('div', { class: 'bar' }, h('i', { style: { width: `${tm * 100}%`, background: SUBJECTS[s].color } })), h('span', { class: 'faint' }, open ? '▾' : '▸')));
          if (open) for (const st of subs) {
            const ss = subStats(st.id);
            const sectionLbl = st.section && SECTION_NAMES[st.section] ? h('span', { class: 'faint', style: { fontSize: '.8em' } }, SECTION_NAMES[st.section] + ' · ') : null;
            box.append(h('div', { class: `cx-sub ${sel === st.id ? 'on' : ''}`, onClick: () => { sel = st.id; drawTree(); drawLesson(); } },
              h('span', { class: 'code', style: { width: '58px' } }, st.id), h('span', { class: 'grow' }, sectionLbl, st.title), dots(Math.round(ss.frac * 3 + (ss.any ? 0.5 : 0)))));
          }
          sec.append(box);
        }
        tree.append(sec);
      }
    };
    search.addEventListener('input', () => { filter = search.value; drawTree(); });
    const drawLesson = () => {
      clear(right);
      if (!sel) {
        right.append(h('div', { class: 'eyebrow' }, SYLLABUS.name), h('h3', null, 'The Codex'),
          h('p', { class: 'summary' }, `Every one of the ${COUNTS.total} learning objectives (${COUNTS.core} Core and ${COUNTS.supplement} Supplement) lives here, grouped into ${COUNTS.subtopics} lessons. Pick a topic on the left to read the lesson, see where to learn it on the island, and explore how it connects to other ideas.`),
          h('div', { class: 'life' }, '💡 ', h('b', null, 'Mastery dots: '), '● discovered (seen in a scan, quest, model or lab) · ●● practised (the experiment work for it, or one question answered right first time) · ●●● mastered (a second, different question right, or a right answer backed by the experiment work).'));
        right.append(h('div', { class: 'stat-grid', style: { marginTop: '16px' } }, ...['B', 'C', 'P'].map((s) => { const c = coverage(s); return h('div', { class: 'stat' }, h('div', { class: 'v', style: { color: SUBJECTS[s].color } }, `${c.seen}/${c.total}`), h('div', { class: 'l' }, `${SUBJECTS[s].name} objectives discovered`)); })));
        return;
      }
      const st = SUB[sel];
      const s = st.subject;
      const t = TOPICS.find((x) => x.id === st.topic);
      right.append(h('div', { class: 'eyebrow', style: { color: SUBJECTS[s].color } }, `${SUBJECTS[s].icon} ${SUBJECTS[s].name} · ${t.id} ${t.title}${st.section ? ' · ' + (SECTION_NAMES[st.section] || '') : ''}`),
        h('h3', null, `${st.id} ${st.title}`),
        h('div', { class: 'summary', html: rich(st.summary) }),
        h('div', { class: 'life', html: '🌍 <b>In real life:</b> ' + rich(st.life) }));
      const W = whereToLearn(sel);
      const where = h('div', { class: 'where' });
      W.exps.forEach((e) => where.append(h('button', { class: 'btn small', onClick: () => { if (!game.lab.isUnlocked(e.id)) { ui.toast('🔒', `Unlock <b>${e.title}</b> through its quest, or turn on Teacher mode.`); return; } ui.closeAllModals(); game.openLab(e.id); } }, `${e.kind === 'exp' ? '🧪' : '🧬'} ${e.title}${game.lab.isUnlocked(e.id) ? '' : ' 🔒'}`)));
      W.quests.slice(0, 4).forEach((q) => where.append(h('button', { class: 'btn small', onClick: () => { ui.closeAllModals(); ui.openQuestLog(q.id); } }, `📜 ${q.title}`)));
      W.pois.slice(0, 4).forEach((p) => where.append(h('span', { class: 'chip' }, `◈ ${p.title} · ${ZONE[p.zone].name}`)));
      right.append(h('div', { class: 'eyebrow', style: { marginTop: '18px' } }, 'Learn it on Brightwater'), where);
      right.append(h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn small primary', onClick: () => ui.quiz({ title: `Practice · ${st.id} ${st.title}`, subs: [st.id], n: 3 }).then(() => drawLesson()) }, '🎯 Practise this topic')));
      const list = h('div', { class: 'obj-list' });
      for (const o of st.objectives) {
        const ok = tierOK(o.id);
        list.append(h('div', { class: `obj ${ok ? '' : 'dimmed'}` }, h('span', { class: 'oid' }, o.id), h('span', { class: 'grow' }, o.text, ' ', o.tier === 'S' ? h('span', { class: 'chip S' }, 'S') : null), dots(state.mastery[o.id] || 0)));
      }
      right.append(h('div', { class: 'eyebrow', style: { marginTop: '18px' } }, `Learning objectives · ${st.objectives.length}`), list);
      const ls = linksOf(sel);
      const lw = h('div', { class: 'links-list' });
      for (const l of ls) {
        const other = l.a === sel ? l.b : l.a;
        const stt = linkState(l);
        const o = SUB[other];
        lw.append(h('div', { class: `link-card ${stt === 0 ? 'locked' : ''}`, onClick: () => { sel = other; openTopics.add(SUB[other].topic); drawTree(); drawLesson(); } },
          h('div', { class: 'row' }, h('span', { class: `chip ${other[0]}` }, other), h('b', null, o.title), h('div', { class: 'grow' }), stt === 2 ? h('span', { class: 'chip gold' }, '✨ sparked') : stt === 1 ? h('span', { class: 'chip' }, 'visible') : h('span', { class: 'chip' }, '🔒')),
          h('div', { style: { marginTop: '6px' }, class: stt ? '' : 'faint' }, stt ? l.text : 'Discover both ideas to reveal this connection.')));
      }
      right.append(h('div', { class: 'eyebrow', style: { marginTop: '18px' } }, `Connections · ${ls.length}`), lw);
      right.scrollTop = 0;
    };
    drawTree(); drawLesson();
  };

  // ---------------------------------------------------------------- links
  const renderLinks = () => {
    const pane = h('div', { class: 'panel-body' });
    body.append(pane);
    let onlyCross = true;
    const list = h('div', { class: 'links-list' });
    const draw = () => {
      clear(list);
      const ls = LINKS.filter((l) => !onlyCross || l.cross);
      const sp = ls.filter((l) => linkState(l) === 2).length;
      list.append(h('div', { class: 'muted', style: { marginBottom: '6px' } }, `${sp} of ${ls.length} ${onlyCross ? 'cross-subject ' : ''}connections sparked. Connections spark when you have practised both ideas, or solve a cause-and-effect chain that joins them.`));
      for (const l of ls) {
        const stt = linkState(l);
        list.append(h('div', { class: `link-card ${stt === 0 ? 'locked' : ''}` },
          h('div', { class: 'row wrap' }, h('span', { class: `chip ${l.a[0]}` }, `${l.a} ${SUB[l.a].title}`), h('span', { class: 'faint' }, '↔'), h('span', { class: `chip ${l.b[0]}` }, `${l.b} ${SUB[l.b].title}`), h('div', { class: 'grow' }), stt === 2 ? h('span', { class: 'chip gold' }, '✨') : null),
          h('div', { style: { marginTop: '6px' }, class: stt ? '' : 'faint' }, stt ? l.text : 'Hidden — discover both ideas to reveal.')));
      }
    };
    const toggle = h('div', { class: 'seg', style: { marginBottom: '12px' } });
    const mk = (v, l) => h('span', { class: onlyCross === v ? 'on' : '', onClick: () => { onlyCross = v; toggle.querySelectorAll('span').forEach((x) => x.classList.toggle('on', x.textContent === l)); draw(); } }, l);
    toggle.append(mk(true, 'Cross-subject'), mk(false, 'All connections'));
    pane.append(h('div', { class: 'row' }, toggle, h('div', { class: 'grow' }), h('button', { class: 'btn small', onClick: () => { ui.closeAllModals(); game.openConstellation(); } }, '✨ Open Constellation view')), list);
    draw();
  };

  // ---------------------------------------------------------------- progress
  const renderProgress = () => {
    const pane = h('div', { class: 'panel-body' }); body.append(pane);
    const lp = levelProgress();
    const qd = Object.values(state.quests).filter((q) => q.status === 'done').length;
    const ed = Object.values(state.exps).filter((e) => e.done).length + Object.values(state.holos).filter((e) => e.done).length;
    const acc = state.stats.answered ? Math.round((state.stats.correct / state.stats.answered) * 100) : 0;
    const stat = (v, l) => h('div', { class: 'stat' }, h('div', { class: 'v' }, String(v)), h('div', { class: 'l' }, l));
    pane.append(h('div', { class: 'stat-grid' },
      stat(lp.level, `Level · ${rankOf(lp.level)}`), stat(state.xp, 'Total XP'), stat(`${qd}/${game.quests.all().length}`, 'Quests complete'),
      stat(`${ed}/${game.lab.registry.length}`, 'Labs & models complete'), stat(Object.keys(state.scanned).length + '/' + POIS.length, 'Field scans'),
      stat(`${sparkedCount()}/${LINKS.length}`, 'Connections sparked'), stat(`${acc}%`, `Accuracy (${state.stats.answered} answers)`), stat(state.stats.best, 'Best answer streak')));
    pane.append(h('h3', { style: { margin: '22px 0 8px' } }, 'Syllabus coverage'));
    for (const s of ['B', 'C', 'P']) {
      const c = coverage(s);
      const row = (l, n, col) => h('div', { class: 'cov-row' }, h('span', { class: 'muted' }, l), h('div', { class: 'bar' }, h('i', { style: { width: `${(n / c.total) * 100}%`, background: col } })), h('span', { class: 'faint' }, `${n}/${c.total}`));
      pane.append(h('div', { style: { margin: '8px 0 14px' } }, h('b', { style: { color: SUBJECTS[s].color } }, `${SUBJECTS[s].icon} ${SUBJECTS[s].name}`),
        row('Discovered', c.seen, '#94a3b8'), row('Practised', c.practised, 'var(--accent-2)'), row('Mastered', c.mastered, 'var(--gold)')));
    }
    pane.append(h('h3', { style: { margin: '22px 0 8px' } }, 'Achievements'));
    pane.append(h('div', { class: 'stat-grid' }, ...ACHIEVEMENTS.map((a) => h('div', { class: `ach ${state.achievements[a.id] ? '' : 'locked'}` }, h('div', { class: 'i' }, a.icon), h('div', null, h('b', null, a.name), h('div', { class: 'faint', style: { fontSize: '.85em' } }, a.desc))))));
  };

  // ---------------------------------------------------------------- practice
  const renderPractice = () => {
    const pane = h('div', { class: 'panel-body' }); body.append(pane);
    pane.append(h('p', { class: 'muted', style: { lineHeight: 1.6 } }, 'Exam-style practice with instant feedback. A right first answer counts as practice; a second, different question answered right masters the objective. Calculation questions are freshly generated each time.'));
    const weak = TOPICS.flatMap((t) => t.subs).filter((st) => subStats(st.id).any).sort((a, b) => subStats(a.id).frac - subStats(b.id).frac).slice(0, 5);
    if (weak.length) pane.append(h('div', { class: 'row', style: { margin: '8px 0 18px' } }, h('button', { class: 'btn primary', onClick: () => ui.quiz({ title: 'Review: your weakest topics', subs: weak.map((w) => w.id), n: 5 }) }, '🎯 Review my weakest topics'), h('span', { class: 'faint' }, weak.map((w) => w.id).join(' · '))));
    for (const s of ['B', 'C', 'P']) {
      pane.append(h('h3', { style: { color: SUBJECTS[s].color, margin: '14px 0 8px' } }, `${SUBJECTS[s].icon} ${SUBJECTS[s].name}`));
      const grid = h('div', { class: 'row wrap', style: { gap: '6px' } });
      for (const t of TOPICS.filter((x) => x.subject === s)) grid.append(h('button', { class: 'btn small', onClick: () => ui.quiz({ title: `${t.id} ${t.title}`, subs: t.subs.map((x) => x.id), n: 5 }) }, `${t.id} ${t.title}`));
      pane.append(grid);
    }
  };

  renderTabs(); render();
  return ui.modal({ title: '📚 Codex', body, head: tabsEl });
}
