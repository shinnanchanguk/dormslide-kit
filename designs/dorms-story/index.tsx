import "./chroma.css";
import type { Design, LayoutInfo } from "@/runtime/design";
import { ChromaLayouts, isChromaLayout } from "./layouts/ChromaLayouts";

/**
 * 디자인 ① 도름스 탄생비화 (크로마).
 * 도름슬라이드 본체가 「도름스는 어떻게 탄생했고, 어떻게 성장하고 있을까요?」 덱에 쓴 모습이다.
 * 따뜻한 종이 바탕 · 필름 그레인 · 기하 산세리프 제목 · 모노 라벨 · 진입 움직임.
 */

export const DORMS_STORY_LAYOUTS: readonly LayoutInfo[] = [
  { id: "ch-hero", when: "표지. 제목·한 줄과 함께 성장 추이 그래프(tables[0]: 날짜 열 + 숫자 열)나 숫자 칸을 크게 보여 줄 때" },
  { id: "ch-toc", when: "목차. tables[0] 줄마다 쪽 범위·제목·설명, 누르면 그 장으로 넘어간다" },
  { id: "ch-divider", when: "장(章) 사이 구분 장. 큰 숫자와 장 제목" },
  { id: "ch-chapter", when: "장 시작. 그림(media)과 함께 이 장에서 할 이야기를 소개" },
  { id: "ch-statement", when: "한 문장을 크게 말할 때(강조 낱말은 hl)" },
  { id: "ch-need", when: "있었던 것 → 없던 것 → 그래서 만든 것, 세 단계 흐름" },
  { id: "ch-reasons", when: "이유 여러 개를 한 지도처럼 펼칠 때" },
  { id: "ch-timeline", when: "날짜 순서로 일어난 일(tables[0]: 날짜·일·설명)" },
  { id: "ch-flow", when: "단계가 화살표로 이어지는 과정" },
  { id: "ch-stream", when: "끊이지 않고 이어지는 흐름(글·활동이 흘러가는 모습)" },
  { id: "ch-contrast", when: "두 쪽을 맞대어 견줄 때(전/후, 이것/저것)" },
  { id: "ch-matrix", when: "두 기준으로 나눈 네 칸 표" },
  { id: "ch-bars", when: "막대그래프(tables[0]: 이름·값)" },
  { id: "ch-chart", when: "꺾은선·면 그래프로 추이를 보여 줄 때" },
  { id: "ch-numbers", when: "큰 숫자 몇 개를 나란히(tables[0]: 이름·숫자·단위·설명)" },
  { id: "ch-map", when: "지역별 분포(시·도 이름과 값)" },
  { id: "ch-schools", when: "학교·기관 이름이 많이 모인 모습" },
  { id: "ch-network", when: "사람·앱이 서로 이어진 연결망" },
  { id: "ch-vessel", when: "그릇에 무엇이 채워지는지 비유할 때" },
  { id: "ch-name", when: "이름의 뜻을 풀어 설명할 때" },
  { id: "ch-actors", when: "등장하는 사람·역할을 카드로" },
  { id: "ch-product", when: "만든 결과물(앱·영상)을 화면과 설명으로 보여 줄 때" },
  { id: "ch-case", when: "사례 한 건을 그림·숫자·인용과 함께" },
  { id: "ch-evidence", when: "실제 글·댓글을 인용 카드로 근거 삼을 때(tables[0]: 종류·제목·인용·누가·반응·주소·그림)" },
  { id: "ch-apps", when: "앱 여러 개를 갤러리로(tables[0]: 영역·앱·한 줄·만든 사람·도름·댓글·주소·그림)" },
  { id: "ch-remix", when: "한 앱을 고쳐 다시 만든 사슬" },
  { id: "ch-collab", when: "요청이 반영되기까지 걸린 시간을 대화처럼" },
  { id: "ch-five", when: "다섯 가지 요소를 하나씩 짚을 때(같은 덱 안에서 여러 장에 걸쳐 이어짐)" },
  { id: "ch-pillars", when: "기둥 몇 개로 원칙을 세울 때" },
  { id: "ch-guard", when: "지키는 단계·안전장치" },
  { id: "ch-lifespan", when: "시간이 흐르며 생기고 사라지는 수명" },
  { id: "ch-purpose", when: "목적·방향을 크게 정리" },
  { id: "ch-posts", when: "게시글 목록을 보여 줄 때" },
  { id: "ch-quote", when: "인용 한 마디를 크게" },
  { id: "ch-closing", when: "마무리 장. 고마움·연락처·QR" },
];

const WIDE_TEXT = new Set(["ch-bars", "ch-flow", "ch-contrast"]);

export const dormsStory: Design = {
  id: "dorms-story",
  name: "도름스 탄생비화",
  summary: "따뜻한 종이 바탕에 필름 그레인, 기하 산세리프 제목과 모노 라벨. 그래프·연표·인용 카드가 차례로 떠오르는 이야기형 디자인이에요.",
  className: "design-dorms-story",
  markColor: "#1e5fce",
  layouts: DORMS_STORY_LAYOUTS,
  renderBody: (props) => (isChromaLayout(props.payload.layout) ? <ChromaLayouts {...props} /> : null),
  fitMax: (layout) => (layout && WIDE_TEXT.has(layout) ? 42 : 34),
};

export default dormsStory;
