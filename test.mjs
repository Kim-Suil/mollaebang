// 실행: node test.mjs
import assert from 'node:assert/strict';
import { fmtKey, missingHint, groupSongs, wishList, makeBackup, parseBackup, pickRec, fmtDur } from './logic.js';

assert.equal(fmtKey('원키', -2), '원키 -2');
assert.equal(fmtKey('남키', 0), '남키 0');
assert.equal(fmtKey('남키', 1), '남키 +1');

const d = { title: '', cat: '', grade: '' };
assert.equal(missingHint(d), '제목을 적어주세요');
assert.equal(missingHint({ ...d, title: 'a' }), '카테고리와 등급을 골라주세요');
assert.equal(missingHint({ ...d, title: 'a', cat: '랩' }), '등급을 골라주세요');
assert.equal(missingHint({ ...d, title: 'a', grade: '잘함' }), '카테고리를 골라주세요');
assert.equal(missingHint({ title: ' a ', cat: '랩', grade: '잘함' }), '');

const s = (title, artist, cat, grade, mineAt, status = 'mine') => ({ title, artist, cat, grade, mineAt, status });
const songs = [
  s('좋은 날', '아이유', '발라드', '잘함', 9),
  s('밤양갱', '비비', '발라드', '잘함', 3),
  s('소나기', '이클립스', '발라드', '별로', 2),
  s('APT.', '로제', '팝송', '보통', 4),
  s('Supernova', 'aespa', '', '', 5, 'wish'),
];
// 등급 묶음 순서 + 이름순
let g = groupSongs(songs, { cat: '발라드', sort: '이름순', query: '' });
assert.deepEqual(g.map((x) => x.grade), ['잘함', '별로']);
assert.deepEqual(g[0].songs.map((x) => x.title), ['밤양갱', '좋은 날']);
// 최근 추가순
g = groupSongs(songs, { cat: '발라드', sort: '최근 추가순', query: '' });
assert.deepEqual(g[0].songs.map((x) => x.title), ['좋은 날', '밤양갱']);
// 검색은 카테고리 무시, 불러볼 곡 제외, 공백·대소문자 무시
g = groupSongs(songs, { cat: '발라드', sort: '이름순', query: '로 제' });
assert.deepEqual(g.flatMap((x) => x.songs.map((y) => y.title)), ['APT.']);
assert.equal(groupSongs(songs, { cat: '랩', sort: '이름순', query: 'supernova' }).length, 0);

// 불러볼 곡은 제목만 필수
assert.equal(missingHint({ title: 'a', cat: '', grade: '' }, 'wish'), '');
assert.equal(missingHint({ title: ' ', cat: '', grade: '' }, 'wish'), '제목을 적어주세요');
// 불러볼 곡 목록: wish만, 최근 담은 순
const w = (title, createdAt, status = 'wish') => ({ title, createdAt, status });
assert.deepEqual(wishList([w('a', 1), w('b', 3), w('c', 2, 'mine')]).map((x) => x.title), ['b', 'a']);

// 백업: 내보낸 걸 그대로 다시 읽을 수 있다
const mine = { id: 'a', title: '좋은 날', artist: '', status: 'mine', cat: '발라드', grade: '잘함', gender: '원키', key: -2, memo: '' };
const wish = { id: 'b', title: 'APT.', artist: '로제', status: 'wish', memo: '' };
const rec = { id: 'r1', songId: 'a', at: 5, dur: 3, mime: 'audio/mp4', data: 'data:audio/mp4;base64,AAAA' };
assert.deepEqual(parseBackup(JSON.stringify(makeBackup([mine, wish], [rec], 1))), { songs: [mine, wish], recs: [rec] });
// v1 백업(녹음 없음)도 읽는다
assert.deepEqual(parseBackup(JSON.stringify({ app: 'mollaebang', version: 1, songs: [wish] })), { songs: [wish], recs: [] });
assert.throws(() => parseBackup(JSON.stringify(makeBackup([mine], [{ ...rec, songId: 'nope' }]))), /1번째 녹음/);
const bad = (text, msg) => assert.throws(() => parseBackup(text), (e) => e.message.includes(msg));
bad('not json', '읽을 수 없어요');
bad('{"app":"other","songs":[]}', '몰래방 백업 파일이 아니에요');
bad(JSON.stringify({ ...makeBackup([]), version: 99 }), '업데이트');
bad(JSON.stringify(makeBackup([{ ...mine, grade: '' }])), '등급');
bad(JSON.stringify(makeBackup([mine, mine])), 'id');
bad(JSON.stringify(makeBackup([{ ...wish, title: ' ' }])), '제목');

// 최근 녹음순: 녹음 없는 곡은 맨 아래
const r = (title, lastRecAt) => ({ title, artist: '', cat: '랩', grade: '보통', status: 'mine', mineAt: 0, lastRecAt });
assert.deepEqual(groupSongs([r('a', 0), r('b', 5), r('c', 9)], { cat: '랩', sort: '최근 녹음순', query: '' })[0].songs.map((x) => x.title), ['c', 'b', 'a']);
// 대표 녹음 > 최신 녹음
const recs = [{ id: 'x', at: 1 }, { id: 'y', at: 3 }, { id: 'z', at: 2 }];
assert.equal(pickRec(recs, 'x').id, 'x');
assert.equal(pickRec(recs, 'gone').id, 'y');
assert.equal(pickRec([], undefined), null);
assert.equal(fmtDur(222), '3:42');
assert.equal(fmtDur(5), '0:05');

console.log('ok');
