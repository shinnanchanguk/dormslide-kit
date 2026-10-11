# 도구 만들기

도구는 장에 붙는 기능이다. 세 가지로 붙는다.

| 붙는 곳 | 예 | 덱에 적는 법 |
|---|---|---|
| 본문 장에 덧붙임 | 유튜브, 링크 미리보기, 도름이 산책 | `payload.video` · `payload.linkPreview` · `payload.pet` |
| 설문 장 | 객관식, 주관식 | `kind: "SURVEY"` |
| 도구 장 | 링크 모으기, 타이머, QR | `kind: "TOOL"`, `payload.tool: "<도구 id>"`, `payload.config` |
| 발표 화면 | 처음으로, 목차, 발표자 따라오기 | 늘 들어 있음 |

## 파일

```
tools/<이름>/
  tool.json     { id, name, group, summary, needsServer, studentData, attach, how, maker, shelf, version }
  <이름>.tsx    화면 코드
  demo.json     작동 예시 덱(1~3장). /?demo=<이름> 으로 보이고, 서재 도구 상점의 작은 창에 이 예시가 재생된다
  README.md     (선택) 설정 설명
```

`tools/index.tsx` 의 `renderToolSlide` (도구 장) 또는 `renderBodyAddons` (덧붙임)에 이어 준다.

## 지킬 것

- **혼자 보는 판에서도 망가지지 않게.** 실시간이 필요한 도구는 수파베이스가 없을 때 '혼자 보는 판'으로 돌아야 한다(`tools/live/index.tsx` 의 useBoard 를 본보기로).
- 학생 기록을 다루면 `studentData: true`, 별명만 받고, 방 비우기(`ds_clear_room`)로 지워지게 한다.
- 실시간 표가 새로 필요하면 `supabase/schema.sql` 에 행 보안 규칙(RLS)과 함께 더한다. 쓰기는 익명 로그인 번호(auth.uid())로만.
- 바깥 주소는 https 만, 바깥 화면은 sandbox 액자 안에서만 띄운다.
