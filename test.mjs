// 실행: node test.mjs
import assert from 'node:assert/strict';
import { fmtKey, missingHint, groupSongs } from './logic.js';

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

console.log('ok');
