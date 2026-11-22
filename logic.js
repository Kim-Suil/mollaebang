// 화면과 상관없는 순수 로직. test.mjs에서 node로 검사한다.
export const CATS = ['발라드', '신나는', '랩', '팝송'];
export const GENDERS = ['남키', '원키', '여키'];
export const GRADES = ['별로', '보통', '잘함'];       // 선택 버튼 순서
export const GROUP_ORDER = ['잘함', '보통', '별로'];  // 목록 묶음 순서
export const SORTS = ['이름순', '최근 추가순'];        // 최근 녹음순은 5단계(녹음)에서 추가
export const KEY_MIN = -12, KEY_MAX = 12;

export const fmtNum = (k) => (k > 0 ? '+' : '') + k;
export const fmtKey = (gender, key) => `${gender} ${fmtNum(key)}`;

// 저장 불가 사유. 저장 가능하면 ''.
export function missingHint(d) {
  if (!d.title.trim()) return '제목을 적어주세요';
  if (!d.cat && !d.grade) return '카테고리와 등급을 골라주세요';
  if (!d.cat) return '카테고리를 골라주세요';
  if (!d.grade) return '등급을 골라주세요';
  return '';
}

const norm = (s) => s.toLowerCase().replace(/\s+/g, '');

// 내 곡 목록 → 등급 묶음. 검색어가 있으면 카테고리 무시하고 전체에서 찾는다.
export function groupSongs(songs, { cat, sort, query }) {
  const q = norm(query || '');
  const picked = songs.filter((s) =>
    s.status === 'mine' &&
    (q ? norm(s.title + s.artist).includes(q) : s.cat === cat));
  const cmp = sort === '최근 추가순'
    ? (a, b) => b.mineAt - a.mineAt
    : (a, b) => a.title.localeCompare(b.title, 'ko');
  return GROUP_ORDER
    .map((grade) => ({ grade, songs: picked.filter((s) => s.grade === grade).sort(cmp) }))
    .filter((g) => g.songs.length);
}
