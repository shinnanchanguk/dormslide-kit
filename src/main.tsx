import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./runtime/fonts.css";
import "./runtime/base.css";
import "./runtime/app.css";
import "@tools/tools.css";
import { DeckApp } from "./runtime/DeckApp";
import type { Deck } from "./lib/deck";
import content from "@slides/content.json";
import { DEMOS, SAMPLES, VISUALS } from "./previews";

/**
 * 시작점. 기본은 slides/content.json(내 슬라이드)을 그린다.
 *   ?sample=dorms-story          샘플 「도름스 탄생비화」
 *   &design=<디자인 id>           그 디자인으로 그리기
 *   ?demo=<도구 id>               그 도구의 작동 예시(tools/<id>/demo.json)
 *   ?visual=<시각화 id>           시각화 조각 예시(visuals/<id>/demo.json)
 *   &embed=1                      서재 미리보기 창처럼 작은 틀 안에서 볼 때(아래 띠를 줄인다)
 */
const pick = (files: Record<string, Deck>, dir: string, id: string | null) => (id && /^[a-z][a-z0-9-]{1,59}$/.test(id) ? files[`../${dir}/${id}/demo.json`] : undefined);

const params = new URLSearchParams(window.location.search);
const sample = params.get("sample");
const demo = pick(DEMOS, "tools", params.get("demo"));
const visual = pick(VISUALS, "visuals", params.get("visual"));
const deck: Deck = demo ?? visual ?? (sample ? SAMPLES[sample] : undefined) ?? (content as Deck);
const design = params.get("design") ?? undefined;
const embed = params.get("embed") === "1";
// 편집은 개발 서버에서만 저장한다. 저장할 파일은 지금 보고 있는 덱이다. '화면에서 바로 고치기' 예시는 저장 없이 화면에서만 고친다.
const editTarget = demo && params.get("demo") === "edit-mode" ? "memory" : import.meta.env.DEV && !demo && !visual ? (sample && SAMPLES[sample] ? `samples/${sample}/deck.json` : "slides/content.json") : undefined;

document.title = deck.meta.title;
if (embed) document.documentElement.classList.add("ds-embed");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DeckApp deck={deck} designOverride={design} editTarget={editTarget} />
  </StrictMode>,
);
