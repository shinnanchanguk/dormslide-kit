import "./retro-windows.css";
import type { Design } from "@/runtime/design";
import { ChromaLayouts, isChromaLayout } from "@designs/dorms-story/layouts/ChromaLayouts";
import { DORMS_STORY_LAYOUTS } from "@designs/dorms-story";

/**
 * 디자인 ③ 레트로 윈도우.
 * md-design 의 retro-windows 템플릿(윈도우 95/98 데스크톱)을 옮겼다. 배치(장의 구조)는 탄생비화 디자인과 같고
 * 옷(색 · 창 틀 · 단추 · 글꼴)만 다르다. 탄생비화의 규칙을 그대로 받은 뒤 retro-windows.css 가 덮어쓴다.
 */
export const retroWindows: Design = {
  id: "retro-windows",
  name: "레트로 윈도우",
  summary: "윈도우 95 데스크톱처럼, 장마다 회색 창과 남색 제목 줄, 튀어나온 단추와 움푹 들어간 칸으로 보여 줘요. 가볍고 장난스러운 수업에 어울려요.",
  className: "design-dorms-story design-retro-windows",
  markColor: "#000080",
  markSurface: "#d4d0c8",
  layouts: DORMS_STORY_LAYOUTS,
  renderBody: (props) => (isChromaLayout(props.payload.layout) ? <ChromaLayouts {...props} /> : null),
  fitMax: (layout) => (layout === "ch-numbers" ? 36 : layout === "ch-statement" ? 40 : 26),
};

export default retroWindows;
