import { CATS, GENDERS, GRADES, SORTS, KEY_MIN, KEY_MAX, fmtNum, fmtKey, missingHint, groupSongs, wishList, makeBackup, parseBackup } from './logic.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clampKey = (k) => Math.max(KEY_MIN, Math.min(KEY_MAX, k));
const ytUrl = (s) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(`${s.title} ${s.artist} 노래방`);
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
// 복원: 한 트랜잭션으로 비우고 다시 채운다. 중간에 실패하면 통째로 취소돼 기존 데이터가 남는다.
const dbReplaceAll = (list) => tx('readwrite', (s) => { s.clear(); list.forEach((x) => s.put(x)); return s.count(); });

// ── 상태 ──
// 곡 하나 = 레코드 하나. status: 'wish'(불러볼 곡) → 'mine'(내 곡). 옮겨도 id·메모 유지.
let songs = [];
// 열려 있는 시트. mode: 'add'(내 곡 추가) | 'edit'(내 곡 편집) | 'wedit'(불러볼 곡 편집) | 'move'(내 곡에 저장)
let draft = null;
// tab: 'mine' | 'wish', open: 상세로 연 곡 id, menu: ⋯ 메뉴 열림
const ui = { tab: 'mine', open: null, menu: false, settings: false, cat: pref.get('cat') || CATS[0], sort: pref.get('sort') || SORTS[0], query: '' };
if (!SORTS.includes(ui.sort)) ui.sort = SORTS[0];
const find = (id) => songs.find((s) => s.id === id);

const ICON = {
  gear: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F8CFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  sort: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F8CFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5"/></svg>',
  plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F8CFF" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA0A8" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  chev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5C6068" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  more: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  note: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
  heart: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/></svg>',
  yt: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor"/></svg>',
};
const GRADE_COLOR = { 잘함: 'var(--grade-good)', 보통: 'var(--grade-mid)', 별로: 'var(--grade-bad)' };

// ── 뼈대 ──
$('#app').innerHTML = `
<main class="page" id="mine">
  <header class="top">
    <h1>내 곡</h1>
    <div class="icons">
      <button class="icon-btn" data-act="settings" aria-label="설정">${ICON.gear}</button>
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
<main class="page" id="wish" hidden>
  <header class="top col"><h1>불러볼 곡</h1><p class="sub">어디서 듣고 꽂힌 노래, 일단 적어두기</p></header>
  <form class="quick" id="wform">
    <label class="sr" for="wt">제목</label>
    <input id="wt" placeholder="제목" autocomplete="off" enterkeyhint="next">
    <div class="quick-r">
      <label class="sr" for="wa">가수</label>
      <input id="wa" placeholder="가수 (선택)" autocomplete="off" enterkeyhint="done">
      <button id="wsave" disabled>저장</button>
    </div>
  </form>
  <div id="wlist"></div>
</main>
<main class="page" id="detail" hidden></main>
<nav class="tabbar">
  <button data-tab="mine">${ICON.note}내 곡</button>
  <button data-tab="wish">${ICON.heart}불러볼 곡</button>
</nav>
<div id="sheet"></div>
<div id="menu"></div>
<div id="toast" role="status" aria-live="polite"></div>`;

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ── 화면 그리기 ──
function renderView() {
  $('#mine').hidden = !(ui.tab === 'mine' && !ui.open);
  $('#wish').hidden = !(ui.tab === 'wish' && !ui.open);
  $('#detail').hidden = !ui.open;
  document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === ui.tab));
  if (ui.open) renderDetail();
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
      <div class="swipe">
        <button class="swipe-del" data-del="${s.id}">삭제</button>
        <div class="swipe-in">
          <button class="row" data-id="${s.id}">
            <div class="row-in">
              <div class="row-t"><b>${esc(s.title)}</b>${s.artist ? `<span>${esc(s.artist)}</span>` : ''}</div>
              <div class="key"><span>${s.gender}</span><b>${fmtNum(s.key)}</b></div>
            </div>
          </button>
        </div>
      </div>`).join('')}`).join('');
}

function renderWish() {
  const list = wishList(songs);
  $('#wlist').innerHTML = `<div class="group-h"><b>목록</b><span>${list.length}</span></div>` + (list.length
    ? list.map((s) => `
      <div class="swipe">
        <button class="swipe-del" data-del="${s.id}">삭제</button>
        <div class="swipe-in">
          <div class="row-in wrow">
            <button class="row-t" data-id="${s.id}"><b>${esc(s.title)}</b>${s.artist ? `<span>${esc(s.artist)}</span>` : ''}</button>
            <a class="ico" href="${ytUrl(s)}" target="_blank" rel="noopener" aria-label="유튜브에서 듣기">${ICON.yt}</a>
            <button class="ico chev" data-id="${s.id}" aria-label="상세 보기">${ICON.chev}</button>
          </div>
        </div>
      </div>`).join('')
    : '<div class="empty">아직 담은 곡이 없어요<br>위에 제목을 적고 저장해보세요</div>');
}

function renderDetail() {
  const s = find(ui.open);
  if (!s) { ui.open = null; return renderView(); }
  const head = (back, right) => `
  <div class="navbar">
    <button class="link back" data-act="back">${ICON.back}${back}</button>${right}
  </div>
  <div class="d-title"><h1>${esc(s.title)}</h1>${s.artist ? `<div>${esc(s.artist)}</div>` : ''}</div>`;
  const yt = `<a class="card yt" href="${ytUrl(s)}" target="_blank" rel="noopener">${ICON.yt}유튜브에서 노래방 영상 검색</a>`;
  const memo = s.memo
    ? `<section class="card"><div class="card-h"><span>메모</span><span class="card-acts"><button data-act="memo">편집</button><button class="red" data-act="memo-del">삭제</button></span></div><p class="memo">${esc(s.memo)}</p></section>`
    : `<button class="card memo-card empty-memo" data-act="memo"><div class="card-h"><span>메모</span></div><p class="memo">최고음, 주의할 구간 등을 적어두세요</p></button>`;

  if (s.status === 'wish') {
    $('#detail').innerHTML = head('불러볼 곡', `<button class="link more" data-act="menu" aria-label="더보기">${ICON.more}</button>`)
      + `<div class="d-gap"></div>${yt}${memo}
      <button class="primary" data-act="move">내 곡으로 옮기기</button>`;
    return;
  }
  const dpick = (field, vals, cls = '') => `<div class="seg ${cls}">${vals.map((v) =>
    `<button data-dpick="${field}" data-v="${v}" aria-pressed="${s[field] === v}">${v}</button>`).join('')}</div>`;
  $('#detail').innerHTML = head('내 곡', '<button class="link" data-act="edit">편집</button>') + `
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
  ${yt}${memo}`;
}

function renderMenu() {
  document.body.style.overflow = ui.settings || draft ? 'hidden' : '';
  if (ui.settings) {
    const last = pref.get('lastBackup');
    const mineN = songs.filter((s) => s.status === 'mine').length;
    $('#menu').innerHTML = `
  <div class="sheet-bg" data-act="set-close"></div>
  <section class="sheet" role="dialog" aria-modal="true" aria-label="설정">
    <div class="sheet-h"><span></span><h2>설정</h2><button class="link save" data-act="set-close">완료</button></div>
    <div class="sheet-b">
      <div class="label">백업</div>
      <div class="set-card">
        <p class="set-info">내 곡 ${mineN}개 · 불러볼 곡 ${songs.length - mineN}개<br>마지막 백업: ${last ? new Date(Number(last)).toLocaleDateString('ko-KR') : '없음'}</p>
        <button class="set-btn" data-act="export">백업 파일 내보내기</button>
        <label class="set-btn">백업에서 복원<input type="file" id="importf" accept=".json,application/json" hidden></label>
      </div>
      <p class="set-note">곡은 이 폰에만 저장돼요. 내보낸 백업 파일은 "파일에 저장"으로 파일 앱(iCloud Drive 등)에 보관하세요.<br>복원하면 지금 곡이 백업 파일 내용으로 바뀌어요.</p>
    </div>
  </section>`;
    return;
  }
  $('#menu').innerHTML = ui.menu ? `
  <div class="sheet-bg" data-act="menu-close"></div>
  <div class="action" role="dialog" aria-modal="true" aria-label="더보기">
    <div class="action-g">
      <button data-act="wedit">곡 편집</button>
      <button class="red" data-act="wdel">목록에서 지우기</button>
    </div>
    <button class="action-cancel" data-act="menu-close">취소</button>
  </div>` : '';
}

const pick = (field, vals, cls = '') => `<div class="seg ${cls}">${vals.map((v) =>
  `<button data-pick="${field}" data-v="${v}" aria-pressed="${draft[field] === v}">${v}</button>`).join('')}</div>`;
const kindOf = (d) => (d.mode === 'wedit' ? 'wish' : 'mine');

function renderSheet() {
  document.body.style.overflow = draft ? 'hidden' : '';
  if (!draft) { $('#sheet').innerHTML = ''; return; }
  const hint = missingHint(draft, kindOf(draft));
  const name = { add: '곡 추가', edit: '곡 편집', wedit: '곡 편집', move: '내 곡에 저장' }[draft.mode];
  const isMove = draft.mode === 'move';
  const mineFields = draft.mode === 'wedit' ? '' : `
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
      ${isMove ? '' : `<div class="hint" id="hint" aria-live="polite">${hint}</div>`}`;
  $('#sheet').innerHTML = `
  <div class="sheet-bg" data-act="close"></div>
  <section class="sheet" role="dialog" aria-modal="true" aria-label="${name}">
    <div class="sheet-h">
      <button class="link" data-act="close">취소</button>
      <h2>${name}</h2>
      ${isMove ? '<span></span>' : `<button class="link save" data-act="save" ${hint ? 'disabled' : ''}>저장</button>`}
    </div>
    <div class="sheet-b">
      <div class="fields">
        <label class="sr" for="f-title">제목</label>
        <input id="f-title" data-f="title" placeholder="제목" value="${esc(draft.title)}" autocomplete="off">
        <label class="sr" for="f-artist">가수</label>
        <input id="f-artist" data-f="artist" placeholder="가수 (선택)" value="${esc(draft.artist)}" autocomplete="off">
      </div>${mineFields}
      ${draft.mode === 'wedit' ? `<div class="hint" id="hint" aria-live="polite">${hint}</div>` : ''}
      <div class="label"><label for="f-memo">메모</label></div>
      <textarea id="f-memo" data-f="memo" placeholder="최고음, 주의할 구간 등">${esc(draft.memo)}</textarea>
      ${draft.mode === 'edit' ? '<button class="danger" data-act="delete">곡 삭제</button>' : ''}
      ${isMove ? `
      <div class="move-foot">
        <div class="hint center" id="hint" aria-live="polite">${hint}</div>
        <button class="primary" data-act="save" ${hint ? 'disabled' : ''}>내 곡에 저장</button>
      </div>` : ''}
    </div>
  </section>`;
}

function updateHint() {
  const hint = missingHint(draft, kindOf(draft));
  $('#hint').textContent = hint;
  $('#sheet [data-act=save]').disabled = !!hint;
}

function openSheet(mode, song) {
  const base = { id: null, title: '', artist: '', cat: ui.cat, gender: '원키', key: 0, grade: '', memo: '' };
  if (mode === 'add') draft = { ...base, mode };
  else if (mode === 'move') draft = { ...base, ...song, cat: '', grade: '', gender: '원키', key: 0, mode }; // 분류 의도를 모르니 비워둔다
  else draft = { ...song, mode };
  renderSheet();
  if (mode === 'add') $('#f-title').focus();
}

// ── 저장·삭제 ──
async function save() {
  const kind = kindOf(draft);
  if (missingHint(draft, kind)) return;
  const now = Date.now();
  const { mode, ...rest } = draft;
  const song = {
    ...rest,
    id: rest.id || newId(),
    title: rest.title.trim(),
    artist: rest.artist.trim(),
    status: kind,
    createdAt: rest.createdAt || now,
  };
  if (kind === 'mine') song.mineAt = mode === 'move' ? now : (rest.mineAt || now); // 최근 추가순 기준
  try {
    await dbPut(song);
  } catch {
    alert('저장하지 못했어요. 다시 시도해주세요.'); // 원본·입력값은 그대로 남는다
    return;
  }
  songs = songs.filter((s) => s.id !== song.id).concat(song);
  draft = null;
  if (kind === 'mine' && mode !== 'edit') { ui.cat = song.cat; pref.set('cat', ui.cat); }
  if (mode === 'move') { ui.open = null; toast(`'${song.title}' 곡을 내 곡 › ${song.cat}에 추가했어요`); } // 불러볼 곡 목록에 그대로 머문다
  renderSheet(); renderAll();
}

async function remove(id) {
  const s = find(id);
  if (!confirm(`'${s.title}' 곡을 지울까요?`)) return false;
  try { await dbDel(id); } catch { alert('지우지 못했어요.'); return false; }
  songs = songs.filter((x) => x.id !== id);
  if (ui.open === id) ui.open = null;
  draft = null; ui.menu = false;
  renderSheet(); renderMenu(); renderAll();
  return true;
}

// ── 백업 ──
async function exportBackup() {
  const name = `몰래방-백업-${new Date().toLocaleDateString('sv-SE')}.json`;
  const file = new File([JSON.stringify(makeBackup(songs))], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
    else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
  } catch (e) {
    if (e.name !== 'AbortError') alert('내보내지 못했어요.');
    return;
  }
  pref.set('lastBackup', String(Date.now()));
  renderMenu();
}

async function importBackup(file) {
  let list;
  try { list = parseBackup(await file.text()); } catch (e) { alert(`${e.message}\n지금 곡은 그대로예요.`); return; }
  if (!confirm(`지금 곡 ${songs.length}개가 백업의 곡 ${list.length}개로 바뀌어요.\n복원할까요?`)) return;
  try { await dbReplaceAll(list); } catch { alert('복원하지 못했어요. 지금 곡은 그대로예요.'); return; }
  songs = list;
  ui.open = null; ui.settings = false;
  renderMenu(); renderAll();
  alert(`곡 ${list.length}개를 복원했어요.`);
}

async function quickAdd() {
  const title = $('#wt').value.trim();
  if (!title) return;
  const now = Date.now();
  const song = { id: newId(), title, artist: $('#wa').value.trim(), memo: '', status: 'wish', createdAt: now };
  try { await dbPut(song); } catch { alert('저장하지 못했어요. 다시 시도해주세요.'); return; }
  songs.push(song);
  $('#wt').value = ''; $('#wa').value = ''; $('#wsave').disabled = true;
  renderWish();
}

// 상세에서 바로 바꾼 값 저장 (내 곡의 키·등급)
async function patchOpen(change) {
  const next = { ...find(ui.open), ...change };
  try { await dbPut(next); } catch { alert('저장하지 못했어요.'); return; }
  songs = songs.map((x) => (x.id === next.id ? next : x));
  renderDetail(); renderList();
}

function renderAll() { renderList(); renderWish(); renderView(); }

// ── 왼쪽으로 밀어서 삭제 ──
const SWIPE = 88;
let sw = null, lastSwipe = 0;
const closeSwipes = (except) => document.querySelectorAll('.swipe-in.open').forEach((el) => el !== except && el.classList.remove('open'));
document.addEventListener('touchstart', (e) => {
  const el = e.target.closest('.swipe-in');
  closeSwipes(el);
  if (el) sw = { el, x: e.touches[0].clientX, y: e.touches[0].clientY, base: el.classList.contains('open') ? -SWIPE : 0, dx: 0, lock: null };
}, { passive: true });
document.addEventListener('touchmove', (e) => {
  if (!sw) return;
  const dx = e.touches[0].clientX - sw.x, dy = e.touches[0].clientY - sw.y;
  if (sw.lock === null && Math.abs(dx) + Math.abs(dy) > 8) sw.lock = Math.abs(dx) > Math.abs(dy);
  if (!sw.lock) return;
  sw.dx = dx;
  sw.el.style.transition = 'none';
  sw.el.style.transform = `translateX(${Math.min(0, Math.max(-SWIPE, sw.base + dx))}px)`;
}, { passive: true });
document.addEventListener('touchend', () => {
  if (!sw) return;
  if (sw.lock) {
    sw.el.classList.toggle('open', sw.base + sw.dx < -SWIPE / 2);
    lastSwipe = Date.now();
  }
  sw.el.style.transition = ''; sw.el.style.transform = '';
  sw = null;
});

// ── 이벤트 ──
document.addEventListener('click', (e) => {
  if (Date.now() - lastSwipe < 350) { e.preventDefault(); return; } // 밀던 손가락이 누르기로 처리되지 않게
  const opened = e.target.closest('.swipe-in.open');
  if (opened && !e.target.closest('.swipe-del')) { e.preventDefault(); opened.classList.remove('open'); return; }
  const t = e.target.closest('button, [data-act]');
  if (!t) return;
  if (t.id === 'add') return openSheet('add');
  if (t.id === 'wsave') { e.preventDefault(); return quickAdd(); }
  if (t.dataset.tab) { ui.tab = t.dataset.tab; ui.open = null; window.scrollTo(0, 0); return renderView(); }
  if (t.dataset.id) { ui.open = t.dataset.id; window.scrollTo(0, 0); return renderView(); }
  if (t.dataset.del) return remove(t.dataset.del);
  if (t.dataset.dpick) return patchOpen({ [t.dataset.dpick]: t.dataset.v });
  if (t.dataset.cat) { ui.cat = t.dataset.cat; pref.set('cat', ui.cat); ui.query = ''; $('#q').value = ''; return renderList(); }
  if (t.dataset.pick) { draft[t.dataset.pick] = t.dataset.v; return renderSheet(); }
  const act = t.dataset.act;
  if (act === 'key') { draft.key = clampKey(draft.key + Number(t.dataset.v)); return renderSheet(); }
  if (act === 'dkey') return patchOpen({ key: clampKey(find(ui.open).key + Number(t.dataset.v)) });
  if (act === 'back') { ui.open = null; return renderView(); }
  if (act === 'edit') return openSheet('edit', find(ui.open));
  if (act === 'move') return openSheet('move', find(ui.open));
  if (act === 'memo-del') { if (confirm('메모를 지울까요?')) patchOpen({ memo: '' }); return; }
  if (act === 'memo') { const s = find(ui.open); openSheet(s.status === 'wish' ? 'wedit' : 'edit', s); return $('#f-memo').focus(); }
  if (act === 'menu') { ui.menu = true; return renderMenu(); }
  if (act === 'settings') { ui.settings = true; return renderMenu(); }
  if (act === 'set-close') { ui.settings = false; return renderMenu(); }
  if (act === 'export') return exportBackup();
  if (act === 'menu-close') { ui.menu = false; return renderMenu(); }
  if (act === 'wedit') { ui.menu = false; renderMenu(); return openSheet('wedit', find(ui.open)); }
  if (act === 'wdel') return remove(ui.open);
  if (act === 'close') { draft = null; return renderSheet(); }
  if (act === 'save') return save();
  if (act === 'delete') return remove(draft.id);
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'q') { ui.query = e.target.value; return renderList(); }
  if (e.target.id === 'wt') { $('#wsave').disabled = !e.target.value.trim(); return; }
  if (e.target.dataset.f) { draft[e.target.dataset.f] = e.target.value; updateHint(); }
});
$('#wform').addEventListener('submit', (e) => {
  e.preventDefault();
  if (document.activeElement === $('#wt') && !$('#wa').value) return $('#wa').focus(); // 제목에서 엔터 → 가수 칸으로
  quickAdd();
});
document.addEventListener('change', (e) => {
  if (e.target.id !== 'importf' || !e.target.files[0]) return;
  importBackup(e.target.files[0]);
  e.target.value = '';
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
navigator.serviceWorker?.register('sw.js').catch(() => {}); // https에서만 동작
songs = await dbAll().catch(() => { alert('저장된 곡을 불러오지 못했어요.'); return []; });
renderAll();
