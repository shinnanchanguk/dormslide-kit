# 배포하기 (인터넷 주소로 올리기)

> AI 에게: 선생님이 원할 때만 한다. 혼자 넘기는 발표라면 `npm run build:html` 로 만든 HTML 파일 하나로 충분하다고 먼저 알려 준다.
> 모든 배포는 **선생님 본인 계정**에 한다. 도름스 서버에는 아무것도 올리지 않는다.

## 어느 길로 갈까

| 상황 | 길 | 필요한 것 |
|---|---|---|
| 혼자 넘기며 발표 | HTML 파일 (`npm run build:html`) | 없음 |
| 학생이 주소로 같이 보기만 | 깃허브 페이지 | 깃허브 계정. 레포가 공개여야 무료 → 슬라이드 내용도 공개된다 |
| 내용을 공개하고 싶지 않음 | 버셀 | 깃허브 + 버셀 계정 (비공개 레포도 무료) |
| 설문·링크 모으기·발표자 따라오기 | 위 둘 중 하나 + 수파베이스 | 수파베이스 계정 (`docs/live.md`) |

가입이 아직이면 도름스 플랫폼 연결하기(https://dorms.school/vibe/followup)를 함께 따라가자고 안내한다.
깃허브 4~5장, 수파베이스 6~7장, 버셀 8장이다.

## 깃허브 페이지

1. 선생님 깃허브에 새 레포를 만든다: `gh repo create <이름> --public --source . --push`
2. `npm run build` → `dist/` 를 페이지로 올린다. 가장 쉬운 방법은 이 레포의 `.github/workflows/pages.yml` 을 그대로 두는 것이다(메인에 올리면 자동으로 배포).
3. 레포 Settings → Pages → Source 를 "GitHub Actions" 로 둔다: `gh api -X POST repos/<계정>/<이름>/pages -f build_type=workflow`
4. 주소는 `https://<계정>.github.io/<이름>/` 다. 화면 아래 [링크 공유] 를 누르면 그 주소의 QR 이 뜬다.

## 버셀

1. `npm i -g vercel` → `vercel login` (선생님이 브라우저에서 한 번 허락).
2. 레포 폴더에서 `vercel --prod`. 빌드 명령 `npm run build`, 출력 폴더 `dist` 로 묻는 대로 답한다.
3. 실시간 기능을 쓰면 버셀 프로젝트 Settings → Environment Variables 에 `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` 를 넣고 다시 배포한다.

## 올린 뒤 고치기

올린 사이트는 선생님 것이다. 언제든 `npm run dev` 로 고치고(화면 [편집]) 다시 올리면 된다.
깃허브 페이지는 메인에 올리면 자동으로, 버셀은 `vercel --prod` 를 다시 하면 바뀐다.
