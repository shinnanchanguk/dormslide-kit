import type { BodyPayload, CoverPayload, ImagePayload, SurveyPayload } from "./deck-content";

/**
 * 도름슬라이드 공개판의 덱 모양. 한 파일(slides/content.json)에 덱 정보와 장 목록이 다 들어 있다.
 *
 * - 장 하나는 { kind, payload } 다. 무엇을 그릴지는 kind 와 payload.layout 이 정한다.
 * - 디자인은 같은 장 목록을 제 모양으로 그린다. 그래서 디자인만 바꿔도 같은 내용이 다른 옷을 입는다.
 * - 도구(설문·링크 모으기·타이머·도름이 산책 등)는 장에 붙는다. 무엇을 붙일 수 있는지는 catalog.json 과 tools/ 를 본다.
 */

export type SlideKind = "COVER" | "BODY" | "IMAGE" | "SURVEY" | "TOOL";

/** TOOL 장의 도구 설정. tool 은 tools/<이름>/tool.json 의 id 다. */
export type ToolPayload = {
  eyebrow: string;
  title: string;
  hint?: string;
  tool: string;
  /** 도구마다 필요한 설정. 모양은 tools/<이름>/README.md 에 적혀 있다. */
  config?: Record<string, unknown>;
};

export type DeckSlide =
  | { kind: "COVER"; payload: CoverPayload }
  | { kind: "BODY"; payload: BodyPayload }
  | { kind: "IMAGE"; payload: ImagePayload }
  | { kind: "SURVEY"; payload: SurveyPayload }
  | { kind: "TOOL"; payload: ToolPayload };

export type DeckMeta = {
  title: string;
  brand: string;
  railLabel: string;
  footLabel: string;
  issueLabel: string;
  /** designs/<이름> 의 id. 비우면 dorms-story. */
  design?: string;
  /** 실시간 기능(발표자 따라오기·설문 모으기 등)을 켤 때만 쓴다. 비우면 혼자 넘기는 판이다. */
  live?: boolean;
  /** 사람을 위한 메모(어디서 왔는지 등). 화면에는 그리지 않는다. */
  source?: string;
};

export type Deck = { meta: DeckMeta; slides: DeckSlide[] };

/** 글 장인지(제목·머리말이 있는 장). */
export function slideTitle(slide: DeckSlide): string {
  const payload = slide.payload as { title?: string };
  return typeof payload.title === "string" ? payload.title : "";
}
