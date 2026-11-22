import { CATS, GENDERS, GRADES, SORTS, KEY_MIN, KEY_MAX, fmtNum, fmtKey, missingHint, groupSongs } from './logic.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// ponytail: crypto.randomUUID는 https에서만 돼서(폰에서 http로 테스트할 때) 직접 만든다
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pref = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

// ── IndexedDB ──
const dbp = new Promise((res, rej) => {
  const r = indexedDB.open('karaoke', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('songs', { keyPath: 'id' });
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
async function tx(mode, fn) {
  const db = await dbp;
  return new Promise((res, rej) => {
    const t = db.transaction('songs', mode);
    const req = fn(t.objectStore('songs'));
    t.oncomplete = () => res(req.result);
    t.onerror = t.onabort = () => rej(t.error);
  });
}
const dbAll = () => tx('readonly', (s) => s.getAll());
const dbPut = (song) => tx('readwrite', (s) => s.put(song));
const dbDel = (id) => tx('readwrite', (s) => s.delete(id));

// ── 상태 ──
let songs = [];
let draft = null; // 열려 있는 시트의 입력값
// tab: 'mine' | 'wish', open: 상세로 연 곡 id
const ui = { tab: 'mine', open: null, cat: pref.get('cat') || CATS[0], sort: pref.get('sort') || SORTS[0], query: '' };
if (!SORTS.includes(ui.sort)) ui.sort = SORTS[0];

const ICON = {
  sort: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F8CFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5"/></svg>',
  plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F8CFF" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA0A8" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  note: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
  heart: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/></svg>',
  yt: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor"/></svg>',
};
const GRADE_COLOR = { 잘함: 'var(--grade-good)', 보통: 'var(--grade-mid)', 별로: 'var(--grade-bad)' };

// ── 화면 ──
$('#app').innerHTML = `
<main class="page" id="mine">
  <header class="top">
    <h1>내 곡</h1>
    <div class="icons">
      <label class="icon-btn" aria-label="정렬">${ICON.sort}
        <select id="sort">${SORTS.map((o) => `<option ${o === ui.sort ? 'selected' : ''}>${o}</option>`).join('')}</select>
      </label>
      <button class="icon-btn" id="add" aria-label="곡 추가">${ICON.plus}</button>
    </div>
  </header>
  <div class="search">${ICON.search}
    <label class="sr" for="q">검색</label>
    <input id="q" type="search" placeholder="제목, 가수 검색" autocomplete="off">
  </div>
  <div class="seg cats" id="cats"></div>
  <div id="list"></div>
</main>
<main class="page" id="detail" hidden></main>
<main class="page" id="wish" hidden>
  <header class="top"><h1>불러볼 곡</h1></header>
  <div class="empty">불러볼 곡은 3단계에서 만들어요</div>
</main>
<nav class="tabbar">
  <button data-tab="mine">${ICON.note}내 곡</button>
  <button data-tab="wish">${ICON.heart}불러볼 곡</button>
</nav>
<div id="sheet"></div>`;

function renderView() {
  $('#mine').hidden = ui.tab !== 'mine' || !!ui.open;
  $('#detail').hidden = ui.tab !== 'mine' || !ui.open;
  $('#wish').hidden = ui.tab !== 'wish';
  document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === ui.tab));
  if (ui.open) renderDetail();
}

function renderDetail() {
  const s = songs.find((x) => x.id === ui.open);
  if (!s) { ui.open = null; return renderView(); }
  const q = encodeURIComponent(`${s.title} ${s.artist} 노래방`);
  const dpick = (field, vals, cls = '') => `<div class="seg ${cls}">${vals.map((v) =>
    `<button data-dpick="${field}" data-v="${v}" aria-pressed="${s[field] === v}">${v}</button>`).join('')}</div>`;
  $('#detail').innerHTML = `
  <div class="navbar">
    <button class="link back" data-act="back">${ICON.back}내 곡</button>
    <button class="link" data-act="edit">편집</button>
  </div>
  <div class="d-title"><h1>${esc(s.title)}</h1>${s.artist ? `<div>${esc(s.artist)}</div>` : ''}</div>
  <section class="card">
    <div class="card-h"><span>예약할 키</span><b>${fmtKey(s.gender, s.key)}</b></div>
    ${dpick('gender', GENDERS)}
    <div class="big-step">
      <button data-act="dkey" data-v="-1" aria-label="키 내리기">−</button>
      <b aria-live="polite">${fmtNum(s.key)}</b>
      <button data-act="dkey" data-v="1" aria-label="키 올리기">+</button>
    </div>
  </section>
  <section class="card card-row"><span>등급</span>${dpick('grade', GRADES, 'grades')}</section>
  <a class="card yt" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">${ICON.yt}유튜브에서 노래방 영상 검색</a>
  ${s.memo ? `<section class="card"><div class="card-h"><span>메모</span></div><p class="memo">${esc(s.memo)}</p></section>` : ''}`;
}

// 상세에서 바로 바꾼 값 저장
async function patchOpen(change) {
  const s = songs.find((x) => x.id === ui.open);
  const next = { ...s, ...change };
  try { await dbPut(next); } catch { alert('저장하지 못했어요.'); return; }
  songs = songs.map((x) => (x.id === next.id ? next : x));
  renderDetail(); renderList();
}

function renderList() {
  $('#cats').innerHTML = CATS.map((c) =>
    `<button data-cat="${c}" aria-pressed="${!ui.query && c === ui.cat}">${c}</button>`).join('');
  const groups = groupSongs(songs, ui);
  const scope = ui.query ? '<div class="scope">내 곡 전체 검색 결과</div>' : '';
  if (!groups.length) {
    $('#list').innerHTML = scope + `<div class="empty">${ui.query ? '찾는 곡이 없어요' : `${ui.cat} 곡이 아직 없어요<br>오른쪽 위 + 로 추가해보세요`}</div>`;
    return;
  }
  $('#list').innerHTML = scope + groups.map((g) => `
    <div class="group-h"><span class="dot" style="background:${GRADE_COLOR[g.grade]}"></span><b>${g.grade}</b><span>${g.songs.length}</span></div>
    ${g.songs.map((s) => `
      <button class="row" data-id="${s.id}">
        <div class="row-in">
          <div class="row-t"><b>${esc(s.title)}</b>${s.artist ? `<span>${esc(s.artist)}</span>` : ''}</div>
          <div class="key"><span>${s.gender}</span><b>${fmtNum(s.key)}</b></div>
        </div>
      </button>`).join('')}`).join('');
}

const pick = (field, vals, cls = '') => `<div class="seg ${cls}">${vals.map((v) =>
  `<button data-pick="${field}" data-v="${v}" aria-pressed="${draft[field] === v}">${v}</button>`).join('')}</div>`;

function renderSheet() {
  document.body.style.overflow = draft ? 'hidden' : '';
  if (!draft) { $('#sheet').innerHTML = ''; return; }
  const hint = missingHint(draft);
  const name = draft.id ? '곡 편집' : '곡 추가';
  $('#sheet').innerHTML = `
  <div class="sheet-bg" data-act="close"></div>
  <section class="sheet" role="dialog" aria-modal="true" aria-label="${name}">
    <div class="sheet-h">
      <button class="link" data-act="close">취소</button>
      <h2>${name}</h2>
      <button class="link save" data-act="save" ${hint ? 'disabled' : ''}>저장</button>
    </div>
    <div class="sheet-b">
      <div class="fields">
        <label class="sr" for="f-title">제목</label>
        <input id="f-title" data-f="title" placeholder="제목" value="${esc(draft.title)}" autocomplete="off">
        <label class="sr" for="f-artist">가수</label>
        <input id="f-artist" data-f="artist" placeholder="가수 (선택)" value="${esc(draft.artist)}" autocomplete="off">
      </div>
      <div class="label">카테고리 <i>*</i></div>${pick('cat', CATS)}
      <div class="label">키</div>
      <div class="keyrow">${pick('gender', GENDERS)}
        <div class="stepper">
          <button data-act="key" data-v="-1" aria-label="키 내리기">−</button>
          <b aria-live="polite">${fmtNum(draft.key)}</b>
          <button data-act="key" data-v="1" aria-label="키 올리기">+</button>
        </div>
      </div>
      <div class="label">등급 <i>*</i></div>${pick('grade', GRADES, 'grades')}
      <div class="hint" id="hint" aria-live="polite">${hint}</div>
      <div class="label"><label for="f-memo">메모</label></div>
      <textarea id="f-memo" data-f="memo" placeholder="최고음, 주의할 구간 등">${esc(draft.memo)}</textarea>
      ${draft.id ? '<button class="danger" data-act="delete">곡 삭제</button>' : ''}
    </div>
  </section>`;
}

function updateHint() {
  const hint = missingHint(draft);
  $('#hint').textContent = hint;
  $('[data-act=save]').disabled = !!hint;
}

function openSheet(song) {
  draft = song ? { ...song }
    : { id: null, title: '', artist: '', cat: ui.cat, gender: '원키', key: 0, grade: '', memo: '' };
  renderSheet();
  if (!song) $('#f-title').focus();
}

async function save() {
  if (missingHint(draft)) return;
  const now = Date.now();
  const song = {
    ...draft,
    id: draft.id || newId(),
    title: draft.title.trim(),
    artist: draft.artist.trim(),
    status: 'mine',
    createdAt: draft.createdAt || now,
    mineAt: draft.mineAt || now, // 내 곡에 추가한 날짜 (최근 추가순 기준)
  };
  try {
    await dbPut(song);
  } catch {
    alert('저장하지 못했어요. 다시 시도해주세요.'); // 입력값은 시트에 그대로 남는다
    return;
  }
  songs = songs.filter((s) => s.id !== song.id).concat(song);
  draft = null;
  ui.cat = song.cat; pref.set('cat', ui.cat);
  renderSheet(); renderList(); renderView();
}

async function remove() {
  if (!confirm(`'${draft.title}' 곡을 삭제할까요?`)) return;
  try { await dbDel(draft.id); } catch { alert('삭제하지 못했어요.'); return; }
  songs = songs.filter((s) => s.id !== draft.id);
  draft = null; ui.open = null;
  renderSheet(); renderList(); renderView();
}

// ── 이벤트 ──
document.addEventListener('click', (e) => {
  const t = e.target.closest('button, [data-act]');
  if (!t) return;
  if (t.id === 'add') return openSheet(null);
  if (t.dataset.tab) { ui.tab = t.dataset.tab; ui.open = null; window.scrollTo(0, 0); return renderView(); }
  if (t.dataset.id) { ui.open = t.dataset.id; window.scrollTo(0, 0); return renderView(); }
  if (t.dataset.dpick) return patchOpen({ [t.dataset.dpick]: t.dataset.v });
  if (t.dataset.cat) { ui.cat = t.dataset.cat; pref.set('cat', ui.cat); ui.query = ''; $('#q').value = ''; return renderList(); }
  if (t.dataset.pick) { draft[t.dataset.pick] = t.dataset.v; return renderSheet(); }
  const act = t.dataset.act;
  if (act === 'key') { draft.key = Math.max(KEY_MIN, Math.min(KEY_MAX, draft.key + Number(t.dataset.v))); return renderSheet(); }
  if (act === 'dkey') {
    const s = songs.find((x) => x.id === ui.open);
    return patchOpen({ key: Math.max(KEY_MIN, Math.min(KEY_MAX, s.key + Number(t.dataset.v))) });
  }
  if (act === 'back') { ui.open = null; return renderView(); }
  if (act === 'edit') return openSheet(songs.find((x) => x.id === ui.open));
  if (act === 'close') { draft = null; return renderSheet(); }
  if (act === 'save') return save();
  if (act === 'delete') return remove();
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'q') { ui.query = e.target.value; return renderList(); }
  if (e.target.dataset.f) { draft[e.target.dataset.f] = e.target.value; updateHint(); }
});
$('#sort').addEventListener('change', (e) => { ui.sort = e.target.value; pref.set('sort', ui.sort); renderList(); });

// ── 시작 ──
// ponytail: iOS 26 홈 화면 앱에서 viewport가 화면보다 짧게 잡히는 버그 → 모자란 높이만큼 아래 요소를 내린다
const fixGap = () => {
  const g = navigator.standalone && innerWidth < innerHeight ? Math.max(0, Math.max(screen.width, screen.height) - innerHeight) : 0;
  document.documentElement.style.setProperty('--gap', g + 'px');
};
fixGap(); addEventListener('resize', fixGap);
navigator.storage?.persist?.(); // 저장 공간 유지 요청 (거절돼도 동작은 같음)
navigator.serviceWorker?.register('sw.js').catch(() => {}); // https에서만 동작 (로컬 http 테스트에선 조용히 건너뜀)
songs = await dbAll().catch(() => { alert('저장된 곡을 불러오지 못했어요.'); return []; });
songs.forEach((s) => { if (s.gender === '기본') s.gender = '원키'; }); // ponytail: 테스트 중 저장한 옛 이름 보정, 배포 전 삭제해도 됨
renderList(); renderView();
