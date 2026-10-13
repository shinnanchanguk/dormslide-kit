# 디자인 ③ 레트로 윈도우

md-design 의 retro-windows 템플릿(윈도우 95/98 데스크톱, 원본 `design.md`)을 옮긴 디자인.
장마다 회색 창에 남색 제목 줄(머리말 eyebrow = 창 파일 이름), 움푹 들어간 흰 칸, 튀어나온 단추 모서리, 청록 데스크톱 바탕, 옅은 주사선.

- 포인트 색(표식 색): `#000080`
- 글꼴: 물마루(제목) · VT323(영문·숫자 라벨) · Pretendard(본문) — 모두 OFL (`src/assets/fonts/OFL-*.txt`)
- 샘플: `samples/retro-windows/deck.json` (6장, 초등 과학 「계절의 변화」) · 화면 `/?sample=retro-windows&design=retro-windows`
- 배치: `rw-cover`(표지 전용) + 탄생비화 배치(`ch-*`)를 같은 옷으로. `ch-*` 배치의 칸 읽는 법은 `designs/dorms-story/README.md` 표를 본다.

| 배치 | 언제 쓰나 | 샘플 쪽 |
|---|---|---|
| `rw-cover` | 표지. title=단원 이름, columns[0]=[라벨, 학습 목표 줄…], columns[1]=[상태 표시줄], columns[2]=[영문 부제, 불러오는 중 글, 흘러가는 글], tables[0]=정보 상자 | 1 |
| `ch-flow` | 단계가 이어지는 과정 | 2 |
| `ch-numbers` | 큰 숫자 몇 개(값 칸은 숫자만) | 3 |
| `ch-chart` | 시각별 추이 | 4 |
| `ch-contrast` | 두 쪽을 견줄 때 | 5 |
| `ch-statement` | 한 문장을 크게 | 6 |
