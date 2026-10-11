import type { Deck } from "@/lib/deck";
import type { BoardItem, RoomResults, SurveySnapshot } from "../live/types";

export type LocalResults = {
  surveys: Map<number, SurveySnapshot>;
  boards: Map<number, BoardItem[]>;
};

export const RESULT_HEADERS = ["쪽", "질문", "종류", "별명", "응답", "링크", "분류", "공감", "응답 수", "작성 시각"];
export const hasResultSlides = (deck: Deck) => deck.slides.some((slide) => slide.kind === "SURVEY" || (slide.kind === "TOOL" && ["link-board", "classify", "likes"].includes(slide.payload.tool)));
export const createLocalResults = (): LocalResults => ({ surveys: new Map(), boards: new Map() });

/** Export only the displayed answer fields. Account IDs and access tokens never enter the file. */
export function roomResultRows(deck: Deck, results: RoomResults): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [];
  for (const response of results.responses) {
    const slide = deck.slides[response.slide];
    if (slide?.kind !== "SURVEY") continue;
    const answer = response.kind === "choice" ? slide.payload.options?.[response.option ?? -1] ?? "" : response.text ?? "";
    rows.push([response.slide + 1, slide.payload.title, response.kind === "choice" ? "객관식" : "주관식", "", answer, "", "", "", 1, response.createdAt]);
  }
  for (const item of results.board) {
    const slide = deck.slides[item.slide];
    if (slide?.kind !== "TOOL") continue;
    rows.push([item.slide + 1, slide.payload.title, "게시물", item.nickname, item.text, item.url ?? "", item.bucket ?? "", item.likes, 1, item.createdAt]);
  }
  return rows.sort((left, right) => Number(left[0]) - Number(right[0]));
}

export function localResultRows(deck: Deck, results: LocalResults): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [];
  for (const [index, snapshot] of results.surveys) {
    const slide = deck.slides[index];
    if (slide?.kind !== "SURVEY") continue;
    snapshot.counts.forEach((count, option) => {
      if (count > 0) rows.push([index + 1, slide.payload.title, "객관식", "", slide.payload.options?.[option] ?? "", "", "", "", count, ""]);
    });
    snapshot.texts.forEach((text) => rows.push([index + 1, slide.payload.title, "주관식", "", text, "", "", "", 1, ""]));
  }
  const board = [...results.boards].flatMap(([slide, items]) => items.map((item) => ({ ...item, slide })));
  return [...rows, ...roomResultRows(deck, { responses: [], board })].sort((left, right) => Number(left[0]) - Number(right[0]));
}
