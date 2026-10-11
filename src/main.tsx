import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./runtime/fonts.css";
import "./runtime/base.css";
import "./runtime/app.css";
import "@tools/tools.css";
import { DeckApp } from "./runtime/DeckApp";
import type { Deck } from "./lib/deck";
import content from "@slides/content.json";
import sampleStory from "@samples/dorms-story/deck.json";

/**
 * 시작점. 기본은 slides/content.json(내 슬라이드)을 그린다.
 * 주소 끝에 ?sample=dorms-story 를 붙이면 샘플(도름스 탄생비화)을, &design=<디자인> 을 붙이면 그 디자인으로 그린다.
 */
const SAMPLES: Record<string, Deck> = { "dorms-story": sampleStory as Deck };

const params = new URLSearchParams(window.location.search);
const sample = params.get("sample");
const deck = (sample && SAMPLES[sample]) || (content as Deck);
const design = params.get("design") ?? undefined;
// 편집은 개발 서버에서만 켠다. 저장할 파일은 지금 보고 있는 덱이다.
const editTarget = import.meta.env.DEV ? (sample && SAMPLES[sample] ? `samples/${sample}/deck.json` : "slides/content.json") : undefined;

document.title = deck.meta.title;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DeckApp deck={deck} designOverride={design} editTarget={editTarget} />
  </StrictMode>,
);
