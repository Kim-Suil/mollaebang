import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
// 실행: 서버 8766 켠 뒤 node tests/shots.mjs <저장폴더>  → 390×844 @2x 화면 캡쳐 (디자인 시안 비교용)
const OUT = process.argv[2] || 'shots'; mkdirSync(OUT, { recursive: true });
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=9336', `--user-data-dir=${mkdtempSync(tmpdir() + '/mollaebang-shots-')}`, 'about:blank']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, n = 0; const wait = {};
for (let i = 0; i < 40; i++) { try { const t = await (await fetch('http://127.0.0.1:9336/json')).json(); ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl); break; } catch { await sleep(250); } }
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (wait[d.id]) wait[d.id](d); };
const send = (method, params = {}) => new Promise((r) => { const id = ++n; wait[id] = r; ws.send(JSON.stringify({ id, method, params })); });
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: 'http://127.0.0.1:8766/' }); await sleep(1500);
const song = (id, title, artist, grade, gender, key, extra = {}) => ({ id, title, artist, status: 'mine', cat: '발라드', grade, gender, key, memo: '', createdAt: 1, mineAt: 1, ...extra });
const data = [
  song('a', '좋은 날', '아이유', '잘함', '원키', -2, { memo: '마지막 3단 고음 3옥 미 · 숨 미리 쉬기', pron: '' }),
  song('b', '밤양갱', '비비', '잘함', '남키', 0), song('c', '사건의 지평선', '윤하', '잘함', '남키', 1),
  song('d', '너의 모든 순간', '성시경', '잘함', '원키', 0), song('e', '취중고백', '김민석', '보통', '원키', -3),
  song('f', '나에게 그대만이', '탑현', '보통', '원키', -1), song('g', '소나기', '이클립스', '별로', '원키', -2),
  { id: 'w1', title: 'Supernova', artist: 'aespa', status: 'wish', memo: '', createdAt: 4 },
  { id: 'w2', title: 'APT.', artist: '로제', status: 'wish', memo: '카페에서 듣고 꽂힘 · 랩 파트 빠름', createdAt: 3 },
  { id: 'w3', title: '한 페이지가 될 수 있게', artist: 'DAY6', status: 'wish', memo: '', createdAt: 2 },
];
await ev(`new Promise(r => { const q = indexedDB.open('karaoke', 2); q.onupgradeneeded = () => { q.result.createObjectStore('songs', {keyPath:'id'}); q.result.createObjectStore('recs', {keyPath:'id'}); }; q.onsuccess = () => { const t = q.result.transaction(['songs','recs'],'readwrite'); ${JSON.stringify(data)}.forEach(x => t.objectStore('songs').put(x)); const b = new ArrayBuffer(8); t.objectStore('recs').put({ id:'r1', songId:'a', at: Date.now()-86400000*2, dur: 222, mime:'audio/wav', buf: b }); t.objectStore('recs').put({ id:'r2', songId:'a', at: Date.now()-86400000*19, dur: 231, mime:'audio/wav', buf: b }); t.oncomplete = () => r(1); }; })`);
await send('Page.reload'); await sleep(1800);
const shot = async (name) => { await sleep(400); const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64')); };
const click = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).click()`);
await ev(`localStorage.setItem('cat','발라드')`); await click('[data-cat=발라드]');
await shot('1-list');
await click('#list [data-id=a]'); await shot('2-detail');
await ev(`window.scrollTo(0, 9999)`); await shot('2b-detail-bottom'); await ev(`window.scrollTo(0,0)`);
await click('[data-act=back]'); await click('#add'); await ev(`document.activeElement.blur()`); await shot('4-add');
await click('[data-act=close]'); await click('[data-tab=wish]'); await shot('5-wish');
await click('#wlist [data-id=w2]'); await shot('6-wishdetail');
await click('[data-act=move]'); await shot('7-move');
ws.close(); chrome.kill(); process.exit(0);
