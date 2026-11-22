# 몰래방 (mollaebang) — 작업 안내

노래방에서 "내가 부를 수 있는 곡과 키"를 바로 확인하는 개인용 아이폰 웹앱(PWA).
배포: https://kim-suil.github.io/mollaebang/ (GitHub Pages, `main` 브랜치 루트). 사용자는 홈 화면 앱으로 실제 데이터를 쓰는 중.

## 구조 (빌드 도구 없음, 순수 HTML/CSS/JS 모듈)
- `index.html` — 뼈대
- `app.js` — 화면·이벤트·IndexedDB·녹음·재생·백업 전부
- `logic.js` — 화면과 무관한 순수 로직 (정렬·검증·백업 형식·WAV 인코딩·발음 파싱)
- `style.css` — 다크 테마. 폰트 Freesentation 500/700/900만 있음 (400 쓰지 말 것)
- `sw.js` — 오프라인 캐시. **파일을 바꾸면 `CACHE` 숫자를 반드시 올릴 것** (안 올리면 폰에 반영 안 됨). 새 버전은 앱을 두 번 껐다 켜야 보임
- `manifest.webmanifest`, `icons/`, `fonts/`

## 데이터 (IndexedDB `karaoke`, 버전 2) — 사용자 실데이터 있음, 스키마 바꿀 땐 업그레이드 경로 필수
- `songs`: `{ id, title, artist, status: 'wish'|'mine', memo, pron, createdAt }` + 내 곡이면 `{ cat, grade, gender, key, mineAt, pinRec }`
  - 곡 하나 = 레코드 하나. 불러볼 곡 → 내 곡은 status만 바뀜(id·메모·녹음 유지)
- `recs`: `{ id, songId, at, dur, mime, buf }` — **녹음은 ArrayBuffer(`buf`)로 저장** (iOS Safari가 IndexedDB에 Blob 저장 실패)
- 백업 JSON: `{ app:'mollaebang', version:2, songs, recs(data: URL) }`, v1(곡만)도 읽음

## 확정 규칙 (사용자가 정한 것, 바꾸지 말 것)
- 카테고리: 발라드 | 신나는 | 랩 | 팝송 (목록 상단 버튼), 하단 탭: 내 곡(음표) | 불러볼 곡(하트)
- 성별키: 남키 | 원키 | 여키 (기본값 원키). 키 표기 `원키 -2`, `남키 0`, `남키 +1` — "정키" 글자·가운데 점·타원 뱃지 금지
- 등급: 잘함/보통/별로, 선택 버튼 순서는 별로 | 보통 | 잘함, 목록 묶음은 잘함 → 보통 → 별로. 내 곡 저장 시 카테고리·등급 필수, 제목 필수, 가수 선택
- 정렬: 이름순 / 최근 추가순(mineAt) / 최근 녹음순 — 묶음 안에서만 정렬
- 불러볼 곡 → "내 곡으로 옮기기" → 시트에서 저장하면 **불러볼 곡 목록에 머물고** 알림만 띄움
- 삭제: 목록 왼쪽으로 밀기(내 곡·불러볼 곡) + 상세 ⋯ / 편집 시트
- 녹음: Web Audio로 받아 24kHz 모노 WAV로 직접 인코딩 (iOS MediaRecorder mp4는 1~2초만 재생되는 버그). 목록 왼쪽 네모 ▶는 대표 녹음, 없으면 최신
- 유튜브 버튼: `제목 가수 노래방 악보` 검색 링크 (API 안 씀)
- 외국어 발음: `song.pron` 텍스트. "1절", "후렴", "[아무거나]" 줄은 구간 제목. 상세의 메모 카드 안에 "외국어 발음 보기/추가 >"

## 디자인
디자인 시안(사용자 캔버스)을 따른다: 다크 배경 #0B0B0D, 포인트 #4F8CFF, 카드 #16171A 반경 20, 애플뮤직식 큰 제목·얇은 구분선 목록.
**UI를 바꾸면 보고 전에 반드시 `tests/shots.mjs`로 캡쳐해서 시안과 눈으로 비교할 것.** 숫자만 맞추고 끝내지 말 것.
입력칸 글자는 16px 이상 (iOS 자동 확대 방지).

## 테스트
```
node test.mjs                                   # logic.js 단위 테스트
python3 -m http.server 8766 --bind 127.0.0.1 &  # 저장소 루트에서
node tests/e2e.mjs                              # 헤드리스 크롬 전체 흐름 (macOS Chrome 경로)
node tests/shots.mjs shots                      # 화면 캡쳐
```

## 알려진 한계 (iOS)
- 홈 화면 앱은 화면을 잠그면 재생이 멈춤 (WebKit 198277, 해결 불가). 사파리 탭에서는 계속 재생됨
- iOS 26 홈 화면 앱 하단 빈칸 버그 → `app.js`의 `fixGap`(--gap)으로 대응 중

## 배포
`main`에 push하면 GitHub Pages가 자동 배포. 커밋 전 `sw.js`의 CACHE 숫자 올리기.
