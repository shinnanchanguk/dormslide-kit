# 도름슬라이드 본체 기능 대응표

도름슬라이드 본체(연수·수업 운영판)의 기능 24개가 이 공개판에서 어디로 갔는지 적는다. 빠진 것 없이 다 옮겼고, 운영 서버에만 의미가 있는 것은 공개판의 방식으로 바꿨다.

| 본체 기능 | 공개판 |
|---|---|
| deck.native-content (표지·글·그림·설문·도구 장) | `src/runtime/SlidePage.tsx` |
| deck.presentation-view (발표·참여 화면) | `src/runtime/DeckApp.tsx` (같은 화면, 실시간이면 발표자/학생) |
| presentation.live-follow (화면 따라오기) | 도구 `presenter-follow` (수파베이스 `ds_presenter`) |
| presentation.timer (함께 보는 시계) | 도구 `timer` (혼자 보는 판), 실시간 공유는 앞으로 |
| response.survey (설문과 짧은 답) | 도구 `survey` · `short-answer` |
| response.classification (의견 나누어 붙이기) | 도구 `classify` |
| response.likes (좋아요) | 도구 `likes` |
| participation.nickname-session (별명 입장) | 도구 `join` + 익명 로그인 |
| tool.link-board (링크 모으기) | 도구 `link-board` |
| tool.link-qr (링크와 QR) | 도구 `link-qr`, 발표 화면 `share-link` |
| tool.moran-access (모란 수업 열기) | 도구 `activity-frame` (모란 활동 주소를 액자로) |
| lesson.mathmath-runtime (매쓰매쓰 수업) | 도구 `activity-frame` (매쓰매쓰 수업 주소를 액자로) |
| editor.inline-content (글자 바로 고치기) | 도구 `edit-mode` (개발 서버 [편집] → 파일 저장) |
| editor.slide-structure (장 차례 바꾸기) | AI 에게 말로("3번과 4번 바꿔 줘"). 덱이 파일 하나라 바로 된다 |
| deck.link-entry (링크로 들어오기) | 무작위 방 이름 + [링크 공유] QR |
| deck.share-space (함께 쓰는 공간) | 수업 방(room) 단위로 응답·별명이 나뉜다 |
| deck.external-embed (다른 사이트 글에 싣기) | 배포 주소를 iframe 으로 싣는다(`docs/deploy.md`) |
| presentation.case-live-stats (사례 카드 실시간 숫자) | 원고 숫자로 그림(`designs/dorms-story/layouts/live-counters.tsx`). 실시간 값은 내 서버에서 받아 넣을 수 있다 |
| presentation.training-workflow (연수 단계 프롬프트) | 도름스 서재의 이용 흐름과 플랫폼 연결하기 슬라이드가 맡는다 |
| admin.pin-session (선생님 잠금번호) | 발표자 = 방을 처음 연 브라우저(익명 번호). 잠금번호 대신 무작위 방 이름 |
| admin.result-archive (수업 기록 보관) | 도구 `results-export` (표 파일로 내려받기) 뒤 `ds_clear_room` |
| admin.deck-lifecycle (덱 만들기·복사·지우기) | 덱 = 파일. 복사는 파일 복사, 지우기는 파일 지우기 |
| admin.folder-library (폴더 정리) | 레포 폴더·깃허브 레포로 정리 |
| admin.learner-password-reset (학생 비밀번호) | 학생 비밀번호를 받지 않으므로 필요 없음 |

본체 덱 디자인 가운데 「도름스 탄생비화」(크로마)는 `designs/dorms-story` 로, 도름이 산책은 도구 `doreumi-walk` 로 옮겼다.
