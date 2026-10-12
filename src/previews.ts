import type { Deck } from "./lib/deck";
import sampleStory from "@samples/dorms-story/deck.json";
import sampleRetro from "@samples/retro-windows/deck.json";

/** 샘플 덱과 도구·시각화 예시. 개발 서버와 배포본(미리보기 사이트)에서만 싣는다. HTML 한 파일에는 넣지 않는다. */
export const SAMPLES: Record<string, Deck> = { "dorms-story": sampleStory as Deck, "retro-windows": sampleRetro as Deck };
export const DEMOS = import.meta.glob<Deck>("../tools/*/demo.json", { eager: true, import: "default" });
export const VISUALS = import.meta.glob<Deck>("../visuals/*/demo.json", { eager: true, import: "default" });
