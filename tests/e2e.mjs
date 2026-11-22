// 헤드리스 크롬(macOS 기본 경로)을 DevTools 프로토콜로 조작하는 전체 흐름 테스트
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
const HERE = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
// 실행: (저장소 루트에서) python3 -m http.server 8766 --bind 127.0.0.1 & node tests/e2e.mjs
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new', '--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=9333', `--user-data-dir=${mkdtempSync(tmpdir() + '/mollaebang-e2e-')}`, 'about:blank']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, n = 0; const wait = {};
for (let i = 0; i < 40; i++) {
  try { const t = await (await fetch('http://127.0.0.1:9333/json')).json(); ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl); break; } catch { await sleep(250); }
}
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (wait[d.id]) wait[d.id](d); };
const send = (method, params = {}) => new Promise((r) => { const id = ++n; wait[id] = r; ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
const errors = [];
await send('Runtime.enable');
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description); });
await send('Page.navigate', { url: 'http://127.0.0.1:8766/' }); await sleep(1500);
const click = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).click()`);
const check = (name, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) process.exitCode = 1; };

await ev(`window.confirm = () => true; window.alert = (m) => { window.__alert = m; }`);
await click('[data-tab=wish]');
await ev(`{ const t=document.querySelector('#wt'); t.value='APT.'; t.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#wa').value='로제' }`);
check('저장 버튼 활성화', await ev(`!document.querySelector('#wsave').disabled`));
await click('#wsave'); await sleep(300);
check('불러볼 곡 목록에 추가', await ev(`document.querySelector('#wlist').textContent.includes('APT.')`));
await click('#wlist [data-id]'); await sleep(100);
check('불러볼 곡 상세 열림', await ev(`!document.querySelector('#detail').hidden && document.querySelector('#detail').textContent.includes('내 곡으로 옮기기')`));
// 메모 편집
await click('[data-act=menu]'); await click('[data-act=wedit]');
await ev(`{ const m=document.querySelector('#f-memo'); m.value='랩 파트 빠름'; m.dispatchEvent(new Event('input',{bubbles:true})) }`);
await click('#sheet [data-act=save]'); await sleep(300);
check('메모 저장됨', await ev(`document.querySelector('#detail').textContent.includes('랩 파트 빠름')`));
await click('[data-act=menu]'); await click('[data-act=wedit]');
check('편집 시트에 발음 추가 버튼', await ev(`document.querySelector('[data-act=show-pron]') !== null`));
await click('[data-act=show-pron]');
await ev(`{ const m=document.querySelector('#f-pron'); m.value='후렴\\n아파트 아파트'; m.dispatchEvent(new Event('input',{bubbles:true})) }`);
await click('#sheet [data-act=save]'); await sleep(300);
check('시트에서 넣은 발음 저장', await ev(`document.querySelector('.pron-row').textContent.includes('보기')`));
await click('[data-act=move]');
check('옮기기 시트에 발음 채워짐', await ev(`document.querySelector('#f-pron') && document.querySelector('#f-pron').value.includes('아파트')`));
await click('[data-act=close]');
check('메모 카드 폭 = 유튜브 카드 폭', await ev(`(() => { const d=document.querySelector('#detail'); return d.querySelector('.yt').offsetWidth === [...d.querySelectorAll('.card')].pop().offsetWidth; })()`));
await click('[data-act=memo-del]'); await sleep(300);
check('메모 삭제', await ev(`!document.querySelector('#detail').textContent.includes('랩 파트 빠름') && document.querySelector('#detail .empty-memo') !== null`));
check('빈 메모 카드도 꽉 참', await ev(`document.querySelector('#detail .empty-memo').closest('.card').offsetWidth === document.querySelector('#detail .yt').offsetWidth`));
await click('[data-act=memo]');
await ev(`{ const m=document.querySelector('#f-memo'); m.value='랩 파트 빠름'; m.dispatchEvent(new Event('input',{bubbles:true})) }`);
await click('#sheet [data-act=save]'); await sleep(300);
// 옮기기
await click('[data-act=move]');
check('옮기기 시트에 메모 채워짐', await ev(`document.querySelector('#f-memo').value === '랩 파트 빠름'`));
check('카테고리·등급 비어서 저장 불가', await ev(`document.querySelector('#sheet [data-act=save]').disabled && document.querySelector('#hint').textContent === '카테고리와 등급을 골라주세요'`));
await click('[data-pick=cat][data-v=팝송]');
check('등급만 안내', await ev(`document.querySelector('#hint').textContent === '등급을 골라주세요'`));
await click('[data-pick=grade][data-v=잘함]');
await click('[data-act=key][data-v="-1"]');
await click('#sheet [data-act=save]'); await sleep(300);
check('옮긴 뒤 불러볼 곡 목록에 머묾', await ev(`document.querySelector('#detail').hidden && !document.querySelector('#wish').hidden`));
check('추가 알림 뜸', await ev(`document.querySelector('#toast').classList.contains('show') && document.querySelector('#toast').textContent.includes('팝송')`));
check('불러볼 곡에서 빠짐', await ev(`!document.querySelector('#wlist').textContent.includes('APT.')`));
await click('[data-tab=mine]'); await click('[data-cat=팝송]'); await click('#list [data-id]');
check('내 곡에 키·메모 유지', await ev(`document.querySelector('#detail').textContent.includes('원키 -1') && document.querySelector('#detail').textContent.includes('랩 파트 빠름')`));
await click('[data-act=back]');
await ev(`window.confirm = () => true; window.alert = (m) => { window.__alert = m; }`);
check('새로고침 후 유지(팝송·메모)', await ev(`document.querySelector('#list').textContent.includes('APT.')`));
// 외국어 발음: 추가 → 보기 → 삭제
await click('#list [data-id]');
check('옮긴 곡에 발음 유지', await ev(`document.querySelector('.pron-row').textContent.includes('보기')`));
await click('.pron-row'); await click('[data-act=pron-edit]');
await ev(`{ const m=document.querySelector('#f-pron'); m.value='1절\\n헤이 굿모닝\\n\\n후렴\\n아이 필 소 굿'; m.dispatchEvent(new Event('input',{bubbles:true})) }`);
await click('#sheet [data-act=save]'); await sleep(300);
check('발음 화면 구간·줄', await ev(`(() => { const p=document.querySelector('.pron'); return p && [...p.querySelectorAll('h2')].map(x=>x.textContent).join() === '1절,후렴' && p.querySelectorAll('p').length === 2; })()`));
await click('[data-act=pron-back]');
check('발음 줄: 보기 상태', await ev(`document.querySelector('.pron-row').textContent.includes('보기')`));
await click('.pron-row'); await click('[data-act=pron-edit]');
await ev(`{ const m=document.querySelector('#f-pron'); m.value='  '; m.dispatchEvent(new Event('input',{bubbles:true})) }`);
await click('#sheet [data-act=save]'); await sleep(300);
check('발음 비우면 삭제', await ev(`document.querySelector('.pron') === null && document.querySelector('.pron-row').textContent.includes('추가')`));
await click('[data-act=back]');
// 녹음 2개 → 목록 ▶ → 대표 지정
await ev(`window.confirm = () => true; window.alert = (m) => { window.__alert = m; }`);
await click('#list [data-id]');
for (let k = 0; k < 2; k++) {
  await click('[data-act=rec-start]'); await sleep(2300);
  if (k === 0) check('녹음 중 표시', await ev(`document.querySelector('#rec-time') !== null`));
  await click('[data-act=rec-stop]'); await sleep(800);
}
check('녹음 2개 저장', await ev(`document.querySelector('.sec-h span').textContent === '2개' && !window.__alert`));
const mimeOk = await ev(`new Promise(r => { const q = indexedDB.open('karaoke'); q.onsuccess = () => { const g = q.result.transaction('recs').objectStore('recs').getAll(); g.onsuccess = () => r(g.result.every(x => x.buf instanceof ArrayBuffer && x.buf.byteLength > 0 && x.mime && !x.blob)); }; })`);
check('녹음 blob·형식 저장', mimeOk);
await click('.recs [data-play]'); await sleep(800);
const pdur = await ev(`document.querySelector('#player').duration`);
check(`녹음 길이만큼 재생됨 (${pdur?.toFixed?.(1)}초)`, pdur > 1.8 && pdur < 3.5);
await ev(`document.querySelector('#player').pause()`);
const oldest = await ev(`[...document.querySelectorAll('[data-recmenu]')].pop().dataset.recmenu`);
await ev(`document.querySelectorAll('[data-recmenu]')[1].click()`); await click('[data-act=pin]'); await sleep(300);
check('대표 표시', await ev(`document.querySelector('.recs').textContent.includes('대표')`));
await click('[data-act=back]');
await send('Page.reload'); await sleep(1500);
await ev(`window.confirm = () => true; window.alert = (m) => { window.__alert = m; }`);
await click('[data-cat=팝송]');
check('목록 ▶ 버튼', await ev(`document.querySelector('#list .cover.on') !== null`));
await click('#list .cover.on'); await sleep(500);
check('▶가 대표 녹음 재생', await ev(`document.querySelector('#player').dataset.rec === ${JSON.stringify(oldest)}`));
await ev(`document.querySelector('#player').pause()`);
await ev(`document.querySelector('#sort').value='최근 녹음순'; document.querySelector('#sort').dispatchEvent(new Event('change'))`);
check('최근 녹음순 정렬 동작', await ev(`document.querySelector('#list').textContent.includes('APT.')`));
await click('#list [data-id]');
await ev(`document.querySelectorAll('[data-recmenu]')[1].click()`); await click('[data-act=rec-del]'); await sleep(300);
check('대표 녹음 삭제 → 1개, 대표 해제', await ev(`document.querySelector('.sec-h span').textContent === '1개' && !document.querySelector('.recs').textContent.includes('대표')`));
await click('[data-act=back]');
// 삭제: 불러볼 곡 하나 더 만들고 메뉴로 지우기
await click('[data-tab=wish]');
await ev(`{ const t=document.querySelector('#wt'); t.value='삭제용'; t.dispatchEvent(new Event('input',{bubbles:true})) }`);
await click('#wsave'); await sleep(300);
await click('#wlist [data-id]'); await click('[data-act=menu]'); await click('[data-act=wdel]'); await sleep(300);
check('메뉴로 지우기', await ev(`!document.querySelector('#wlist').textContent.includes('삭제용') && document.querySelector('#detail').hidden`));
// 메모 칸: 비어 있어도 보이고 누르면 편집 시트
await click('[data-tab=wish]');
await ev(`{ const t=document.querySelector('#wt'); t.value='메모테스트'; t.dispatchEvent(new Event('input',{bubbles:true})) }`);
await click('#wsave'); await sleep(300);
await click('#wlist [data-id]');
check('빈 메모 칸 보임', await ev(`document.querySelector('#detail .empty-memo') !== null`));
await click('[data-act=memo]');
check('취소 버튼 왼쪽 여백 없음', await ev(`(() => { const h=document.querySelector('.sheet-h'), b=h.querySelector('[data-act=close]'); return Math.abs(b.getBoundingClientRect().left - h.getBoundingClientRect().left - 20) < 1 && b.offsetWidth < 60; })()`));
await click('[data-act=close]');
await click('[data-act=memo]');
check('메모 칸 누르면 편집 시트', await ev(`document.activeElement && document.activeElement.id === 'f-memo'`));
await click('[data-act=close]');
// 백업 복원: 잘못된 파일 → 그대로
const setFile = async (path) => {
  const doc = await send('DOM.getDocument');
  const q = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#importf' });
  await send('DOM.setFileInputFiles', { nodeId: q.result.nodeId, files: [path] });
  await sleep(500);
};
await click('[data-tab=mine]'); await click('[data-act=settings]');
const before = await ev(`document.querySelector('.set-info').textContent`);
await ev(`window.__alert = null`);
await setFile(`${HERE}/bad.json`);
check('잘못된 백업 거절', await ev(`(window.__alert||'').includes('손상') && document.querySelector('.set-info').textContent === ${JSON.stringify(before)}`));
await setFile(`${HERE}/good.json`);
await click('[data-cat=발라드]');
check('백업 복원', await ev(`(window.__alert||'').includes('곡 2개, 녹음 0개를 복원') && document.querySelector('#menu').innerHTML === '' && document.querySelector('#list').textContent.includes('좋은 날')`));
await click('[data-tab=mine]'); await click('[data-act=settings]');
await setFile(`${HERE}/good2.json`);
check('v2 백업 녹음 복원', await ev(`(window.__alert||'').includes('녹음 1개를 복원')`));
await click('[data-cat=발라드]');
check('복원된 녹음 ▶ 표시', await ev(`document.querySelector('#list .cover.on') !== null`));
await click('[data-act=settings]');
await setFile(`${HERE}/good.json`);
await click('[data-tab=wish]');
check('복원된 불러볼 곡', await ev(`document.querySelector('#wlist').textContent.includes('Supernova') && !document.querySelector('#wlist').textContent.includes('메모테스트')`));
await send('Page.reload'); await sleep(1500);
await click('[data-tab=mine]'); await click('[data-cat=발라드]');
check('복원 후 새로고침 유지', await ev(`document.querySelector('#list').textContent.includes('좋은 날')`));
await ev(`window.__alert = null`);
await ev(`window.confirm = () => true; window.alert = (m) => { window.__alert = m; }`);
await click('[data-tab=mine]'); await click('[data-cat=발라드]');
check('내 곡 행 왼쪽 정렬 유지', await ev(`Math.round(document.querySelector('#list .cover').getBoundingClientRect().left) === Math.round(document.querySelector('.search').getBoundingClientRect().left)`));
const hitDel = (list) => ev(`(() => { const w=document.querySelector('${list} .swipe-in'); w.classList.add('open'); return new Promise(r => setTimeout(() => { const d=w.parentElement.querySelector('.swipe-del').getBoundingClientRect(); const el=document.elementFromPoint(d.left + d.width/2, d.top + d.height/2); w.classList.remove('open'); r(!!el && el.classList.contains('swipe-del')); }, 400)); })()`);
check('내 곡: 밀었을 때 삭제 버튼이 가려지지 않음', await hitDel('#list'));
// 실제 터치 순서 재현: 연 상태에서 삭제 버튼에 touchstart → 줄이 열린 채 유지돼야 함
check('삭제 버튼 터치 시 줄 유지', await ev(`(() => { const w=document.querySelector('#list .swipe-in'); w.classList.add('open'); const d=w.parentElement.querySelector('.swipe-del'); d.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [new Touch({ identifier: 1, target: d, clientX: 1, clientY: 1 })] })); const ok = w.classList.contains('open'); w.classList.remove('open'); return ok; })()`));
await click('#list .swipe-del'); await sleep(300);
check('내 곡 밀어서 삭제', await ev(`!document.querySelector('#list').textContent.includes('좋은 날')`));
check('스크립트 오류 없음', errors.length === 0 && !(await ev('window.__alert')));
if (errors.length) console.log(errors);
ws.close(); chrome.kill();
