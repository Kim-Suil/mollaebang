// 화면과 상관없는 순수 로직. test.mjs에서 node로 검사한다.
export const CATS = ['발라드', '신나는', '랩', '팝송'];
export const GENDERS = ['남키', '원키', '여키'];
export const GRADES = ['별로', '보통', '잘함'];       // 선택 버튼 순서
export const GROUP_ORDER = ['잘함', '보통', '별로'];  // 목록 묶음 순서
export const SORTS = ['이름순', '최근 추가순', '최근 녹음순'];
export const KEY_MIN = -12, KEY_MAX = 12;

export const fmtNum = (k) => (k > 0 ? '+' : '') + k;
export const fmtKey = (gender, key) => `${gender} ${fmtNum(key)}`;

// 저장 불가 사유. 저장 가능하면 ''. 불러볼 곡(wish)은 제목만 필수.
export function missingHint(d, kind = 'mine') {
  if (!d.title.trim()) return '제목을 적어주세요';
  if (kind === 'wish') return '';
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
  const cmp = sort === '최근 추가순' ? (a, b) => b.mineAt - a.mineAt
    : sort === '최근 녹음순' ? (a, b) => (b.lastRecAt || 0) - (a.lastRecAt || 0) // 녹음 없는 곡은 맨 아래
    : (a, b) => a.title.localeCompare(b.title, 'ko');
  return GROUP_ORDER
    .map((grade) => ({ grade, songs: picked.filter((s) => s.grade === grade).sort(cmp) }))
    .filter((g) => g.songs.length);
}

// 불러볼 곡: 최근에 담은 곡이 위로
export const wishList = (songs) =>
  songs.filter((s) => s.status === 'wish').sort((a, b) => b.createdAt - a.createdAt);

// ── 백업 ──
// 형식 버전: 녹음이 들어가면 2로 올리고, 1도 계속 읽을 수 있게 한다.
// v1: 곡만, v2: 곡 + 녹음(data: URL)
export const BACKUP_VERSION = 2;
export const makeBackup = (songs, recs = [], now = Date.now()) =>
  ({ app: 'mollaebang', version: BACKUP_VERSION, exportedAt: now, songs, recs });

// 백업 파일 텍스트 → { songs, recs }. 문제가 있으면 사용자에게 보여줄 문장을 담아 throw.
export function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('백업 파일을 읽을 수 없어요'); }
  if (!data || data.app !== 'mollaebang' || !Array.isArray(data.songs)) throw new Error('몰래방 백업 파일이 아니에요');
  if (!(data.version >= 1) || data.version > BACKUP_VERSION) throw new Error('앱을 업데이트한 뒤 다시 시도해주세요 (새 버전 백업)');
  const ids = new Set();
  data.songs.forEach((s, i) => {
    const bad = (why) => { throw new Error(`백업 파일이 손상됐어요 (${i + 1}번째 곡: ${why})`); };
    if (!s || typeof s.id !== 'string' || !s.id || ids.has(s.id)) bad('id');
    ids.add(s.id);
    if (typeof s.title !== 'string' || !s.title.trim()) bad('제목');
    if (s.status !== 'wish' && s.status !== 'mine') bad('상태');
    if (s.status === 'mine') {
      if (!CATS.includes(s.cat)) bad('카테고리');
      if (!GRADES.includes(s.grade)) bad('등급');
      if (!GENDERS.includes(s.gender) || !Number.isInteger(s.key)) bad('키');
    }
  });
  const recs = data.version >= 2 ? data.recs : [];
  if (!Array.isArray(recs)) throw new Error('백업 파일이 손상됐어요 (녹음 목록)');
  const recIds = new Set();
  recs.forEach((r, i) => {
    const ok = r && typeof r.id === 'string' && r.id && !recIds.has(r.id) && ids.has(r.songId)
      && Number.isFinite(r.at) && Number.isFinite(r.dur) && typeof r.mime === 'string'
      && typeof r.data === 'string' && r.data.startsWith('data:');
    if (!ok) throw new Error(`백업 파일이 손상됐어요 (${i + 1}번째 녹음)`);
    recIds.add(r.id);
  });
  return { songs: data.songs, recs };
}

// 목록 ▶가 재생할 녹음: 대표로 고른 녹음, 없으면(지웠으면) 가장 최근 녹음
export function pickRec(songRecs, pinId) {
  return songRecs.find((r) => r.id === pinId)
    || songRecs.reduce((a, b) => (!a || b.at > a.at ? b : a), null);
}

export const fmtDur = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
