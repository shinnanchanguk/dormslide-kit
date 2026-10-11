/**
 * 크로마 배치 이름표. 그리는 코드(ChromaLayouts)와 떼어 두어, 서버 쪽 검사·시험에서도
 * 리액트 화면 코드를 불러오지 않고 이름만 확인할 수 있다.
 */
export const CHROMA_LAYOUTS = [
  "ch-hero",
  "ch-statement",
  "ch-chapter",
  "ch-timeline",
  "ch-contrast",
  "ch-flow",
  "ch-stream",
  "ch-vessel",
  "ch-name",
  "ch-network",
  "ch-map",
  "ch-chart",
  "ch-numbers",
  "ch-posts",
  "ch-quote",
  "ch-bars",
  "ch-pillars",
  "ch-matrix",
  "ch-schools",
  "ch-lifespan",
  "ch-closing",
  "ch-case",
  "ch-actors",
  "ch-apps",
  "ch-remix",
  "ch-collab",
  "ch-evidence",
  "ch-five",
  "ch-toc",
  "ch-divider",
  "ch-product",
  "ch-need",
  "ch-reasons",
  "ch-guard",
  "ch-purpose",
] as const;

export type ChromaLayout = (typeof CHROMA_LAYOUTS)[number];

export function isChromaLayout(layout: string | undefined): layout is ChromaLayout {
  return Boolean(layout) && (CHROMA_LAYOUTS as readonly string[]).includes(layout as string);
}
