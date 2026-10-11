import "./blueprint-base.css";
import "./blueprint.css";
import type { Design } from "@/runtime/design";
import { ChromaLayouts, isChromaLayout } from "@designs/dorms-story/layouts/ChromaLayouts";
import { DORMS_STORY_LAYOUTS } from "@designs/dorms-story";
import { BlueprintBackdrop } from "./Backdrop";

/**
 * 디자인 ② 시뮬레이션 계기판.
 * 도름스 서재 「시뮬레이션 교육」 책의 검은 계기판 디자인을 슬라이드에 옮겼다. 배치(장의 구조)는 탄생비화 디자인과 같고
 * 옷(색·글꼴·바탕 그림·패널)만 다르다. 배치 코드를 다시 짜지 않고 옷을 바꾸는 본보기다(docs/design-guide.md).
 */
export const simulationBlueprint: Design = {
  id: "simulation-blueprint",
  name: "시뮬레이션 계기판",
  summary: "검은 바탕에 단색 선, 원형 뷰포트와 눈금 고리, 모서리 꺾쇠 유리 패널. 과학·기술·데이터 이야기를 조종석 계기판처럼 보여 줘요.",
  className: "design-simulation-blueprint",
  markColor: "#e2e8f0",
  layouts: DORMS_STORY_LAYOUTS,
  renderBody: (props) => (isChromaLayout(props.payload.layout) ? <ChromaLayouts {...props} /> : null),
  fitMax: (layout) => (layout && ["ch-bars", "ch-flow", "ch-contrast"].includes(layout) ? 42 : 34),
  Backdrop: BlueprintBackdrop,
};

export default simulationBlueprint;
