/* Евангельский синопсис — статический ридер (vanilla JS, hash-routing).
   Все данные берутся из data/synopsis.json во время загрузки. */
'use strict';

const GOSPELS = [
  ['mt', 'Мф', 'Матфей',  'Матфея'],
  ['mk', 'Мк', 'Марк',    'Марка'],
  ['lk', 'Лк', 'Лука',    'Луки'],
  ['jn', 'Ин', 'Иоанн',   'Иоанна'],
];
const ABBR = Object.fromEntries(GOSPELS.map(g => [g[0], g[1]]));
const NAME = Object.fromEntries(GOSPELS.map(g => [g[0], g[2]]));   // именительный
const GEN  = Object.fromEntries(GOSPELS.map(g => [g[0], g[3]]));   // родительный (от …)
const ABBR2KEY = {};
GOSPELS.forEach(([k, ab]) => { ABBR2KEY[ab.toLowerCase()] = k; });
// синонимы для разбора ссылок
Object.assign(ABBR2KEY, {
  'мф': 'mt', 'мат': 'mt', 'матфей': 'mt', 'матфея': 'mt',
  'мк': 'mk', 'мар': 'mk', 'марк': 'mk', 'марка': 'mk',
  'лк': 'lk', 'лук': 'lk', 'лука': 'lk', 'луки': 'lk',
  'ин': 'jn', 'иоанн': 'jn', 'иоанна': 'jn', 'ио': 'jn',
});

const LS = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('es.' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('es.' + k, JSON.stringify(v)); } catch {} },
};

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = s => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[^\wа-я0-9]+/gi, ' ').trim();

let DB = null;          // raw json
let BYID = {};          // id -> pericope
let TOP = [];           // top-level pericopes, ordered
let REF = {};           // "mt:3:13" -> {id, order}
let SEARCH = [];        // [{id,g,ch,v,t,title,order,nt}]
let main, gridSeq = 0;

/* ============================================================ boot */
fetch('data/synopsis.json')
  .then(r => r.json())
  .then(db => { DB = db; init(); })
  .catch(() => { $('#loading').textContent = 'Не удалось загрузить data/synopsis.json'; });

function init() {
  main = $('#main');
  BYID = {};
  DB.pericopes.forEach(p => { BYID[p.id] = p; });
  TOP = DB.pericopes
    .filter(p => !p.id.includes('.'))
    .sort((a, b) => a.order - b.order);
  buildIndexes();
  applySettings();
  wireChrome();
  window.addEventListener('hashchange', route);
  route();
}

function childrenOf(id) {
  return DB.pericopes
    .filter(p => p.id.startsWith(id + '.') && p.id.slice(id.length + 1).indexOf('.') === -1)
    .sort((a, b) => a.order - b.order);
}
function presentGospels(p) {
  return GOSPELS.map(g => g[0]).filter(k => p.columns[k]);
}

/* ============================================================ indexes */
function eachVerse(p, fn) {
  GOSPELS.forEach(([g]) => {
    const col = p.columns[g];
    if (!col) return;
    col.segments.forEach(seg => seg.items.forEach(it => {
      if ('v' in it) fn(g, seg.chapter, it, seg);
    }));
  });
}
function buildIndexes() {
  DB.pericopes.forEach(p => {
    eachVerse(p, (g, ch, it) => {
      const key = `${g}:${ch}:${it.v}`;
      if (!(key in REF)) REF[key] = { id: p.id, order: p.order };
      SEARCH.push({ id: p.id, g, ch, v: it.v, suf: it.suf || '', t: it.t,
                    title: p.title, order: p.order, nt: norm(it.t) });
    });
  });
}

/* ============================================================ settings */
function applySettings() {
  const root = document.documentElement;
  ['theme', 'size', 'family', 'align'].forEach(k => {
    const v = LS.get('set.' + k, root.getAttribute('data-' + k) || (k === 'align' ? 'on' : null));
    if (v) root.setAttribute('data-' + k, v);
  });
  syncSeg();
}
function syncSeg() {
  const root = document.documentElement;
  $$('.seg').forEach(seg => {
    const k = seg.dataset.setting;
    const cur = root.getAttribute('data-' + k);
    $$('button', seg).forEach(b => b.classList.toggle('active', b.dataset.value === cur));
  });
}
function wireChrome() {
  $('#openSettings').onclick = () => toggleDrawer(true);
  $('#closeSettings').onclick = () => toggleDrawer(false);
  $('#settingsScrim').onclick = () => toggleDrawer(false);
  $('#navHome').onclick = () => { location.hash = '#/'; };
  $$('.seg').forEach(seg => seg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const k = seg.dataset.setting;
    document.documentElement.setAttribute('data-' + k, b.dataset.value);
    LS.set('set.' + k, b.dataset.value);
    syncSeg();
  }));

  // search
  const inp = $('#searchInput'), hits = $('#searchHits');
  let t = null;
  inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => runSearch(inp.value), 140); });
  inp.addEventListener('focus', () => { if (inp.value.trim()) runSearch(inp.value); });
  $('#searchForm').addEventListener('submit', e => {
    e.preventDefault();
    const first = $('.hit', hits);
    if (first) first.click();
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.search')) { hits.hidden = true; }
  });

  // pager + keyboard
  $('#prevBtn').onclick = () => navRel(-1);
  $('#nextBtn').onclick = () => navRel(1);
  document.addEventListener('keydown', e => {
    if (/input|textarea/i.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') navRel(-1);
    if (e.key === 'ArrowRight') navRel(1);
    if (e.key === 'Escape') { toggleDrawer(false); $('#searchHits').hidden = true; }
  });
}
function toggleDrawer(open) {
  const d = $('#settings');
  d.hidden = !open;
  d.setAttribute('aria-hidden', String(!open));
}

/* ============================================================ router */
function route() {
  const raw = location.hash.replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean).map(decodeURIComponent);
  $('#searchHits').hidden = true;
  main.scrollIntoView({ block: 'start' });
  window.scrollTo(0, 0);

  if (parts.length === 0)            return viewHome();
  switch (parts[0]) {
    case 'p':         return viewPericope(parts[1], parts[2]);
    case 'read':      return viewReader(parts[1], parts[2]);
    case 'prefaces':  return viewPrefaces();
    case 'appendix':  return viewAppendix();
    case 'footnotes': return viewFootnotes();
    case 'bookmarks': return viewBookmarks();
    default:          return viewHome();
  }
}
function setPager(show) { $('#pager').hidden = !show; }
function setProgress(frac) { $('#progressBar span').style.width = (frac * 100).toFixed(1) + '%'; }

/* ============================================================ HOME / TOC */
function viewHome() {
  setPager(false); setProgress(0);
  const resume = LS.get('resume', null);
  const q = '';
  let html = `
    <div class="hometitle">
      <h1>${esc(DB.meta.title)}</h1>
      <p>${esc(DB.meta.subtitle || '')}</p>
    </div>
    <div class="tools">
      <a class="chip" href="#/read/mt">Читать Матфея</a>
      <a class="chip" href="#/read/mk">Читать Марка</a>
      <a class="chip" href="#/read/lk">Читать Луку</a>
      <a class="chip" href="#/read/jn">Читать Иоанна</a>
      <a class="chip" href="#/bookmarks">★ Закладки</a>
      <a class="chip" href="#/prefaces">Предисловия</a>
      <a class="chip" href="#/appendix">Хронология</a>
    </div>`;

  if (resume && BYID[resume.id]) {
    const p = BYID[resume.id];
    html += `<div class="resume">
      <span>Продолжить чтение: <a href="#/p/${esc(resume.id)}">${esc(numOf(p))}. ${esc(p.title)}</a></span>
      <button class="chip" onclick="(function(){es_clearResume()})()">Скрыть</button>
    </div>`;
  }

  html += `<div class="filterbar"><input id="tocFilter" type="search"
            placeholder="Фильтр: номер, название или ссылка (Мф 5:3)…" value="${esc(q)}"></div>
           <div id="tocList"></div>`;
  main.innerHTML = html;
  renderToc('');
  const f = $('#tocFilter');
  f.addEventListener('input', () => renderToc(f.value));
}
window.es_clearResume = () => { LS.set('resume', null); viewHome(); };

function numOf(p) { return p.id; }

function renderToc(query) {
  const list = $('#tocList');
  const qn = norm(query);
  const ref = parseRef(query);

  // секции
  let html = '';
  DB.sections.forEach(sec => {
    const ids = sec.pericopeIds.filter(id => BYID[id]);
    const rows = ids.map(id => tocRow(BYID[id], qn, ref)).filter(Boolean);
    if (!rows.length) return;
    html += `<section class="section"><h2 class="section__h">${esc(sec.title || 'Без названия')}</h2>
             <ul class="plist">${rows.join('')}</ul></section>`;
  });
  list.innerHTML = html || `<div class="empty">Ничего не найдено.</div>`;
  wireStars(list);
}

function tocRow(p, qn, ref) {
  const kids = childrenOf(p.id);
  // фильтр: по тексту названия/номера, либо по найденной ссылке
  let match = true;
  if (qn) {
    const hay = norm(p.id + ' ' + p.title + ' ' + (p.place || ''));
    match = hay.includes(qn) || kids.some(k => norm(k.id + ' ' + k.title).includes(qn));
  }
  if (ref && ref.found) match = (ref.found.id === p.id) || kids.some(k => k.id === ref.found.id);
  if (!match) return '';

  const present = new Set();
  [p, ...kids].forEach(x => presentGospels(x).forEach(g => present.add(g)));
  const flags = GOSPELS.map(([g]) =>
    `<span class="gflag ${present.has(g) ? 'on' : ''}" data-g="${g}" title="${NAME[g]}">${ABBR[g]}</span>`).join('');
  const fav = isBookmarked(p.id) ? 'on' : '';

  return `<li class="pitem">
    <span class="pitem__num">${esc(p.id)}</span>
    <span class="pitem__main">
      <a class="pitem__title" href="#/p/${esc(p.id)}">${esc(p.title)}</a>
      ${p.place ? `<span class="pitem__place">${esc(p.place)}</span>` : ''}
    </span>
    <span class="gflags">${flags}</span>
    <button class="star ${fav}" data-id="${esc(p.id)}" title="Закладка" aria-label="Закладка">★</button>
  </li>`;
}

/* ============================================================ PERICOPE */
function viewPericope(id, target) {
  if (!id) return viewHome();
  const baseId = id.split('.')[0];
  const p = BYID[baseId];
  if (!p) { main.innerHTML = `<div class="empty">Перикопа ${esc(id)} не найдена. <a href="#/">К содержанию</a></div>`; setPager(false); return; }

  LS.set('resume', { id: baseId });
  const sec = sectionOf(baseId);
  const idx = TOP.findIndex(x => x.id === baseId);
  setProgress((idx + 1) / TOP.length);

  const kids = childrenOf(baseId);
  gridSeq = 0;
  let body = '';
  body += `<p class="crumbs"><a href="#/">Содержание</a> › ${sec ? esc(sec.title) + ' › ' : ''}<b>${esc(p.id)}. ${esc(p.title)}</b></p>`;
  body += `<header class="perihead">
    <h1>${esc(p.id)}. ${esc(p.title)}
      <button class="star ${isBookmarked(baseId) ? 'on' : ''}" data-id="${esc(baseId)}" title="Закладка">★</button></h1>
    ${p.place ? `<div class="place">${esc(p.place)}</div>` : ''}
  </header>`;
  if (p.headnote) body += `<div class="headnote">${esc(p.headnote)}</div>`;

  // собственный текст родителя (если есть)
  if (presentGospels(p).length) body += renderColumns(p);
  if (p.extra) body += renderExtra(p.extra);

  // подпункты
  kids.forEach(k => {
    body += `<div class="subdiv" id="sub-${esc(k.id.replace(/\./g, '-'))}">
      <h2>${esc(k.id)}. ${esc(k.title)}${k.place ? ` <span class="muted small">— ${esc(k.place)}</span>` : ''}</h2></div>`;
    if (k.headnote) body += `<div class="headnote">${esc(k.headnote)}</div>`;
    if (presentGospels(k).length) body += renderColumns(k);
    else body += `<p class="muted small">Текст отсутствует в источнике.</p>`;
    if (k.extra) body += renderExtra(k.extra);
  });

  main.innerHTML = body;
  wireStars(main);
  wirePericope();

  // пейджер
  setPager(true);
  const prev = TOP[idx - 1], next = TOP[idx + 1];
  $('#prevBtn').disabled = !prev;
  $('#nextBtn').disabled = !next;
  $('#pagerLabel').textContent = `Перикопа ${idx + 1} из ${TOP.length}`;

  // прокрутка к цели
  if (id.includes('.')) {
    const el = $('#sub-' + CSS.escape(id.replace(/\./g, '-')));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (target) scrollToVerse(target);
}

function renderColumns(p) {
  const present = presentGospels(p);
  const n = present.length;
  const gid = ++gridSeq;
  const alignMap = buildAlignMap(p);

  const tabs = n >= 2
    ? `<div class="gtabs" data-grid="${gid}">${present.map((g, i) =>
        `<button class="gtab ${i === 0 ? 'active' : ''}" data-g="${g}" data-grid="${gid}">${NAME[g]}</button>`).join('')}</div>`
    : '';

  const cols = present.map((g, i) => {
    const col = p.columns[g];
    const segHtml = col.segments.map(seg => renderSegment(g, seg, alignMap, gid)).join('');
    return `<section class="col ${i === 0 ? 'show' : ''}" data-g="${g}" data-grid="${gid}">
      <div class="col__h">${NAME[g]}${chapterLabel(col)}${refsHtml(col)}</div>
      ${segHtml}
    </section>`;
  }).join('');

  return tabs + `<div class="cols tabbed" data-n="${n}" data-grid="${gid}">${cols}</div>`;
}

function chapterLabel(col) {
  const chs = [...new Set(col.segments.map(s => s.chapter))];
  return ` <span class="muted small">гл. ${chs.join(', ')}</span>`;
}
function refsHtml(col) {
  const out = [];
  col.segments.forEach(seg => {
    if (seg.prev) out.push(refLink('ранее', seg.prev));
    if (seg.next) out.push(refLink('далее', seg.next));
  });
  return out.length ? `<div class="col__refs">${out.join(' · ')}</div>` : '';
}
function refLink(kind, r) {
  return `${kind}: <a href="#/p/${esc(r.p)}">${esc(r.ref || '')} (п. ${esc(r.p)})</a>`;
}

function renderSegment(g, seg, alignMap, gid) {
  return seg.items.map(it => {
    if ('note' in it) return `<p class="note">${esc(it.note)}</p>`;
    const vl = `${it.v}${it.suf || ''}`;
    const row = alignMap[`${g}|${seg.chapter}:${vl}`];
    const rowAttr = row != null ? ` data-grp="${gid}" data-row="${row}"` : '';
    return `<p class="verse" data-g="${g}" data-ch="${seg.chapter}" data-v="${it.v}"${rowAttr}>
      <span class="vn" title="${ABBR[g]} ${seg.chapter}:${vl}">${vl}</span>${esc(it.t)}</p>`;
  }).join('');
}
function renderExtra(ex) {
  const items = ex.items.map(it => `<p class="verse"><span class="vn">${it.v}${it.suf || ''}</span>${esc(it.t)}</p>`).join('');
  return `<div class="extra"><div class="col__h">${esc(ex.source)}</div>${items}</div>`;
}

function buildAlignMap(p) {
  const m = {};
  (p.alignment || []).forEach((row, i) => {
    for (const g in row) m[`${g}|${row[g]}`] = i;
  });
  return m;
}

function wirePericope() {
  const alignOn = () => document.documentElement.getAttribute('data-align') !== 'off';
  // подсветка параллелей
  main.addEventListener('click', onVerseClick);
  main.addEventListener('mouseover', e => {
    if (!alignOn()) return;
    const v = e.target.closest('.verse'); if (!v || v.dataset.row == null) return;
    highlightRow(v.dataset.grp, v.dataset.row, true);
  });
  main.addEventListener('mouseout', e => {
    const v = e.target.closest('.verse'); if (!v || v.dataset.row == null) return;
    if (!v.classList.contains('pinned')) highlightRow(v.dataset.grp, v.dataset.row, false);
  });
  // вкладки на мобильном
  $$('.gtab').forEach(tab => tab.addEventListener('click', () => {
    const gid = tab.dataset.grid, g = tab.dataset.g;
    $$(`.gtab[data-grid="${gid}"]`).forEach(t => t.classList.toggle('active', t === tab));
    $$(`.col[data-grid="${gid}"]`).forEach(c => c.classList.toggle('show', c.dataset.g === g));
  }));
}
function onVerseClick(e) {
  if (e.target.closest('a') || e.target.closest('.star')) return;
  const v = e.target.closest('.verse'); if (!v || v.dataset.row == null) return;
  const on = !v.classList.contains('pinned');
  $$('.verse.pinned').forEach(x => x.classList.remove('pinned'));
  highlightRow(v.dataset.grp, null, false, true);   // clear all
  if (on) {
    $$(`.verse[data-grp="${v.dataset.grp}"][data-row="${v.dataset.row}"]`).forEach(x => x.classList.add('pinned'));
    highlightRow(v.dataset.grp, v.dataset.row, true);
  }
}
function highlightRow(grp, row, on, clearAll) {
  if (clearAll) { $$('.verse.hl').forEach(x => x.classList.remove('hl')); return; }
  $$(`.verse[data-grp="${grp}"][data-row="${row}"]`).forEach(x => x.classList.toggle('hl', on));
}
function scrollToVerse(target) {
  // target формат "mt-3-13" или "mt:3:13"
  const m = target.split(/[-:]/);
  if (m.length < 3) return;
  const el = $(`.verse[data-g="${m[0]}"][data-ch="${m[1]}"][data-v="${m[2]}"]`);
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('target'); }
}

function sectionOf(id) {
  return DB.sections.find(s => s.pericopeIds.includes(id));
}
function navRel(dir) {
  const raw = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (raw[0] !== 'p') return;
  const baseId = (raw[1] || '').split('.')[0];
  const idx = TOP.findIndex(x => x.id === baseId);
  const nx = TOP[idx + dir];
  if (nx) location.hash = '#/p/' + nx.id;
}

/* ============================================================ READER (один Евангелист) */
function viewReader(g, chParam) {
  if (!ABBR[g]) return viewHome();
  setPager(false);
  // собрать все стихи евангелиста по порядку
  const rows = [];
  DB.pericopes.forEach(p => {
    const col = p.columns[g]; if (!col) return;
    col.segments.forEach(seg => seg.items.forEach(it => {
      if ('v' in it) rows.push({ ch: seg.chapter, v: it.v, suf: it.suf || '', t: it.t, pid: p.id, title: p.title });
    }));
  });
  rows.sort((a, b) => a.ch - b.ch || a.v - b.v || (a.suf < b.suf ? -1 : 1));
  // удалить точные дубли (стих может встречаться в нескольких перикопах)
  const seen = new Set(), uniq = [];
  rows.forEach(r => { const k = `${r.ch}:${r.v}${r.suf}`; if (!seen.has(k)) { seen.add(k); uniq.push(r); } });

  let html = `<p class="crumbs"><a href="#/">Содержание</a> › <b>Евангелие от ${GEN[g]}</b></p>
    <div class="tools">${GOSPELS.map(([k]) =>
      `<a class="chip" href="#/read/${k}" ${k === g ? 'style="background:var(--accent-soft)"' : ''}>от ${GEN[k]}</a>`).join('')}</div>
    <div class="reader prose">`;
  let curCh = null, curPid = null;
  uniq.forEach(r => {
    if (r.ch !== curCh) { html += `<div class="chap">Глава ${r.ch}</div>`; curCh = r.ch; }
    if (r.pid !== curPid) { html += `<div class="pmark">→ <a href="#/p/${esc(r.pid)}">п. ${esc(r.pid)}. ${esc(r.title)}</a></div>`; curPid = r.pid; }
    html += `<span class="vp"><span class="vn">${r.v}${r.suf}</span>${esc(r.t)} </span>`;
  });
  html += `</div>`;
  main.innerHTML = html;
  setProgress(0);
}

/* ============================================================ PREFACES / APPENDIX / FOOTNOTES */
function viewPrefaces() {
  setPager(false); setProgress(0);
  let html = `<p class="crumbs"><a href="#/">Содержание</a> › <b>Предисловия</b></p><div class="prose">`;
  (DB.prefaces || []).forEach(pr => {
    html += `<h1>${esc(pr.title)}</h1>`;
    pr.paragraphs.forEach(par => html += `<p>${esc(par)}</p>`);
  });
  if (!(DB.prefaces || []).length) html += `<p class="empty">Предисловия не извлечены.</p>`;
  html += `</div>`;
  main.innerHTML = html;
}
function viewFootnotes() {
  setPager(false); setProgress(0);
  let html = `<p class="crumbs"><a href="#/">Содержание</a> › <b>Примечания</b></p><div class="prose"><h1>Примечания</h1>`;
  (DB.footnotes || []).forEach(f => html += `<p><b>${esc(f.n)}.</b> ${esc(f.text)}</p>`);
  html += `</div>`;
  main.innerHTML = html;
}
function viewAppendix() {
  setPager(false); setProgress(0);
  const a = DB.appendix2 || {};
  let html = `<p class="crumbs"><a href="#/">Содержание</a> › <b>Хронология</b></p>
    <div class="prose appendix"><h1>${esc(a.title || 'Сравнительная таблица хронологий')}</h1>`;
  (a.intro || []).forEach(t => html += `<p class="small muted">${esc(t)}</p>`);
  if (a.rows && a.rows.length) {
    html += `<div class="tablewrap"><table><thead><tr>${(a.columns || []).map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>`;
    a.rows.forEach(r => html += `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`);
    html += `</tbody></table></div>`;
  }
  html += `</div>`;
  main.innerHTML = html;
}

/* ============================================================ BOOKMARKS */
function bookmarks() { return LS.get('bookmarks', []); }
function isBookmarked(id) { return bookmarks().includes(id); }
function toggleBookmark(id) {
  const b = bookmarks();
  const i = b.indexOf(id);
  if (i >= 0) b.splice(i, 1); else b.push(id);
  LS.set('bookmarks', b);
  return i < 0;
}
function wireStars(root) {
  $$('.star', root).forEach(s => s.onclick = e => {
    e.preventDefault(); e.stopPropagation();
    const on = toggleBookmark(s.dataset.id);
    s.classList.toggle('on', on);
  });
}
function viewBookmarks() {
  setPager(false); setProgress(0);
  const b = bookmarks().filter(id => BYID[id]);
  let html = `<p class="crumbs"><a href="#/">Содержание</a> › <b>Закладки</b></p><h1 style="text-align:center">★ Закладки</h1>`;
  if (!b.length) { html += `<p class="empty">Пока нет закладок. Нажмите ★ рядом с перикопой.</p>`; main.innerHTML = html; return; }
  html += `<ul class="plist">`;
  b.map(id => BYID[id]).sort((a, c) => a.order - c.order).forEach(p => {
    html += `<li class="pitem"><span class="pitem__num">${esc(p.id)}</span>
      <span class="pitem__main"><a class="pitem__title" href="#/p/${esc(p.id)}">${esc(p.title)}</a></span>
      <button class="star on" data-id="${esc(p.id)}">★</button></li>`;
  });
  html += `</ul>`;
  main.innerHTML = html;
  wireStars(main);
}

/* ============================================================ SEARCH + REF LOOKUP */
function parseRef(s) {
  // "Мф 5:3", "Мф.5:3", "Ин 1:29"
  const m = String(s).trim().match(/^([А-Яа-яA-Za-z]{2,8})\.?\s*(\d{1,3})\s*[:.,]\s*(\d{1,3})/);
  if (!m) return null;
  const g = ABBR2KEY[m[1].toLowerCase()];
  if (!g) return null;
  const ch = +m[2], v = +m[3];
  const found = REF[`${g}:${ch}:${v}`] || null;
  return { g, ch, v, found };
}
function runSearch(qRaw) {
  const hits = $('#searchHits');
  const q = qRaw.trim();
  if (q.length < 2) { hits.hidden = true; return; }
  let html = '';

  // 1) ссылка
  const ref = parseRef(q);
  if (ref) {
    if (ref.found) {
      html += `<a class="hit" href="#/p/${ref.found.id}/${ref.g}-${ref.ch}-${ref.v}">
        <span class="hit__kind">ссылка</span>
        <span class="hit__ref">${ABBR[ref.g]} ${ref.ch}:${ref.v}</span>
        Перейти к перикопе ${ref.found.id}</a>`;
    } else {
      html += `<div class="hit"><span class="hit__ref">${ABBR[ref.g]} ${ref.ch}:${ref.v}</span>
        <span class="muted">— нет в этом издании</span></div>`;
    }
  }

  // 2) полнотекстовый поиск
  const qn = norm(q);
  if (qn.length >= 2) {
    const out = [];
    for (const r of SEARCH) {
      const i = r.nt.indexOf(qn);
      if (i >= 0) { out.push({ r, i }); if (out.length >= 40) break; }
    }
    out.sort((a, b) => a.r.order - b.r.order);
    out.slice(0, 25).forEach(({ r, i }) => {
      const start = Math.max(0, i - 30);
      const raw = r.t;
      // отрисовать сниппет с подсветкой по нормализованной позиции — приблизительно
      const snip = makeSnippet(r.t, r.nt, qn);
      html += `<a class="hit" href="#/p/${r.id}/${r.g}-${r.ch}-${r.v}">
        <span class="hit__kind">${ABBR[r.g]} ${r.ch}:${r.v}</span>
        <span class="hit__ref">${esc(r.id)}</span>${snip}</a>`;
    });
    if (!out.length && !ref) html += `<div class="hit muted">Ничего не найдено.</div>`;
  }

  hits.innerHTML = html;
  hits.hidden = false;
  $$('.hit', hits).forEach(h => h.addEventListener('click', () => { hits.hidden = true; $('#searchInput').blur(); }));
}
function makeSnippet(text, ntext, qn) {
  const i = ntext.indexOf(qn);
  if (i < 0) return esc(text.slice(0, 80));
  // ntext и text не выровнены по длине; используем приблизительное окно по словам
  const words = text.split(/\s+/);
  const nwords = ntext.split(/\s+/);
  let acc = 0, wi = 0;
  for (; wi < nwords.length; wi++) { if (acc + nwords[wi].length >= i) break; acc += nwords[wi].length + 1; }
  const from = Math.max(0, wi - 6), to = Math.min(words.length, wi + 10);
  let seg = words.slice(from, to).join(' ');
  const re = new RegExp('(' + qn.split(' ').map(escRe).join('|') + ')', 'gi');
  seg = esc(seg).replace(re, '<mark>$1</mark>');
  return (from > 0 ? '…' : '') + seg + (to < words.length ? '…' : '');
}
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
