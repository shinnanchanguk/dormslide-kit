/** 슬라이드 한 장이 담는 내용. kind 마다 모양이 다르다. */
/** 본체의 연수 흐름·설문 되돌려주기 설정. 공개판에서는 모양만 남겨 둔다. */
type TrainingWorkflowConfig = Record<string, unknown>;
type SurveyFeedbackConfig = Record<string, unknown>;

/**
 * 글 한 토막. `c`(색)·`s`(크기 배율)는 편집기에서 드래그해 지정했을 때만 붙는다.
 *
 * 크기는 절대 px 이 아니라 **배율**이다. 무대가 `AutoFit` 으로 글자 크기를 통째로
 * 맞추기 때문에(components/slide/AutoFit.tsx), 절대값을 박으면 자동 맞춤이 깨져
 * 슬라이드가 무대 밖으로 넘친다.
 */
export type InlineStyle = {
  /** `#rgb` 또는 `#rrggbb` 만 허용한다. 그 밖의 값은 저장할 때 버린다. */
  c?: string;
  /** 0.5 ~ 3 사이의 배율. 1 이면 안 붙인다. */
  s?: number;
};

export type Inline =
  | ({ t: "text"; v: string } & InlineStyle)
  | ({ t: "hl"; v: string } & InlineStyle);

export type Block =
  | { b: "p"; parts: Inline[] }
  | { b: "lead"; parts: Inline[] }
  | { b: "note"; parts: Inline[] }
  | { b: "rule" };

export type CoverPayload = {
  eyebrow: string;
  title: string;
};

export type BodyPayload = {
  eyebrow: string;
  title: string;
  columns: Block[][];
  /** 문장을 바꾸지 않고 발표용 정보 구조만 정하는 본문 표현 방식. */
  layout?: BodyLayout;
  /** 본문 옆에 두는 원본 그림. 그림도 내용 흐름 안에 있어 자동 맞춤 검사의 대상이다. */
  media?: BodyMedia;
  /** 사례 카드 안의 기존 미리보기 자리만 다른 보호 원본으로 바꾼다. 좌표는 카드의 백분율이다. */
  mediaOverlay?: BodyMediaOverlay;
  /** 정적 사례 카드의 통계 칸 위에 공식 사이트 집계값을 덧그린다. */
  liveStats?: { source: "dorms" | "salpeem" };
  /** 이미지에 고정된 사례 수치를 같은 큰 활자로 다시 그린다. */
  caseStats?: { items: CaseStatItem[] };
  /** 배치가 정해 둔 카드 머리 글을 무대에서 고친 값. 빈 칸은 배치의 기본 글을 쓴다. */
  cardLabels?: string[];
  /** 바이브코딩 두 방식의 이름을 발표장에서 크게 읽히게 한다. */
  emphasizeModeLabels?: true;
  /** 사례를 만든 사람. 이름 부분만 그 사람의 공개 프로필로 이어진다. */
  credit?: BodyCredit;
  /** 근거·사례처럼 제목 자체를 눌러 열어야 하는 외부 자료. */
  resources?: BodyResource[];
  agenda?: string[];
  /** 사례를 나란히 놓을 때 각 사례 옆에 두는 그림. 순서가 곧 사례(resources) 순서다. */
  gallery?: BodyMedia[];
  /** 연수 참가자가 환경·AI를 한 번 고르고 맞춤 안내·복붙 프롬프트를 쓰는 흐름. */
  training?: TrainingWorkflowConfig;
  /** 발표 화면에서 재생하는 신뢰할 수 있는 YouTube 영상. */
  video?: { url: string };
  /**
   * 무대 위를 돌아다니는 3D 마스코트. 보는 사람이 눌러 집어 올리고 내려놓을 수 있다.
   * 발표 흐름과 상관없는 장식이라 인쇄·PDF 에서는 멈춘 그림 한 장으로 남는다.
   */
  pet?: "doreumi";
  /** 본문 장에 덧붙이는 시계(도구 장을 따로 만들지 않고 글과 함께 쓸 때). doneMessage 는 0초가 되면 보이는 한 줄. */
  timer?: { seconds?: number; doneMessage?: string };
  /** 표로 보여 주는 것이 가장 빠른 내용. `tool-compare` 배치가 세로로 훑어 읽게 그린다. */
  tables?: BodyTable[];
};

export type CaseStatItem = { label: string; value: number; suffix: string };

export type BodyCredit = { prefix: string; label: string; url: string };

export type BodyLayout =
  | "training-cover"
  | "comparison"
  | "limit-cards"
  | "principle-pairs"
  | "question-answer"
  | "case-grid"
  | "vibe-modes"
  | "decision-matrix"
  | "starter-grid"
  | "step-cards"
  | "security-caution"
  | "tool-compare"
  | "setup-picker"
  | "context-stage"
  | "publishing-flow"
  | "homework-framework"
  | "case-feature"
  | "case-pair"
  | "video-embed"
  | "chapter-title"
  | "statement-pairs"
  | "terminal-cli"
  | "setup-picker"
  | "numbered-rows"
  | "check-grid"
  | "fix-loop"
  | "statement"
  | "ch-hero"
  | "ch-statement"
  | "ch-chapter"
  | "ch-timeline"
  | "ch-contrast"
  | "ch-flow"
  | "ch-stream"
  | "ch-vessel"
  | "ch-name"
  | "ch-network"
  | "ch-map"
  | "ch-chart"
  | "ch-numbers"
  | "ch-posts"
  | "ch-quote"
  | "ch-bars"
  | "ch-pillars"
  | "ch-matrix"
  | "ch-schools"
  | "ch-lifespan"
  | "ch-closing"
  | "ch-case"
  | "ch-actors"
  | "ch-apps"
  | "ch-collab"
  | "ch-evidence"
  | "ch-five"
  | "ch-toc"
  | "ch-remix"
  | "ch-divider"
  | "ch-product"
  | "ch-need"
  | "ch-reasons"
  | "ch-guard"
  | "ch-purpose";

/** 슬라이드에 그대로 얹는 표 하나. 머리줄과 본줄만 있고 서식은 배치가 정한다. */
export type BodyTable = {
  caption?: string;
  head: string[];
  rows: string[][];
  note?: string;
};

export type BodyMedia = {
  /** protected-assets/decks 아래 원본을 서명 URL로 바꿔 제공한다. */
  src: string;
  alt: string;
  side: "left" | "right";
};

export type BodyMediaOverlay = {
  src: string;
  alt: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BodyResource = {
  label: string;
  url: string;
  /** 근거가 붙어야 하는 주장 카드의 식별자. 없으면 일반 자료로 렌더한다. */
  anchor?:
    | "ai-growth"
    | "hallucination"
    | "sentience"
    | "chatgpt-file"
    | "chatgpt-app-file"
    | "chatgpt-site"
    | "claude-file"
    | "claude-app-file"
    | "claude-site"
    | "gemini-file"
    | "gemini-app-file"
    | "gemini-site";
  /** 사례 카드의 제작 주체. 사례 외 일반 근거에는 넣지 않는다. */
  category?: "학생 제작" | "교사 제작";
  /** 단추 옆에 QR을 함께 그린다. 휴대폰으로 열 주소에만 쓴다. */
  qr?: true;
  /** QR 자료 바로 아래에 붙이는 한두 문장. */
  caption?: string;
  /** [주소 복사] 단추를 붙인다. */
  copy?: true;
  /** 슬라이드 폭을 나눠 쓰는 큰 타일로 그린다. */
  prominent?: true;
  /** `step-cards` 배치에서 이 주소를 넣을 단계 번호(1부터). 그 칸 안에 단추로 들어간다. */
  step?: number;
};

export type SurveyPayload = {
  eyebrow: string;
  title: string;
  /** 공개판: 객관식(CHOICE)·서술형(TEXT). 본체는 따로 표에 두었다. */
  kind?: "CHOICE" | "TEXT";
  /** 공개판: 객관식 보기. */
  options?: string[];
  hint?: string;
  /** 발표자 화면에서 응답을 샌드박스와 CLI 두 칸으로 나눌 활동만 명시한다. */
  responseMode?: "classify";
  /** 객관식 보기 중 하나를 고른 뒤 짧은 주관식을 함께 받는 경우에만 쓴다. */
  otherOption?: { index: number; placeholder: string };
  /** TEXT 응답 하나에 참여 날짜와 연수 후기를 함께 저장하는 마무리 설문. */
  feedback?: SurveyFeedbackConfig;
  /** 한 번에 여러 짧은 답을 받는 서술형 설문의 입력 항목. */
  fields?: string[];
  /** 질문 앞에 크게 두는 전제 문장. 질문(title)과 함께 원문 한 덩어리를 이룬다. */
  premise?: string;
  /** 서술형에서만: 같은 참여자가 여러 번 보낼 수 있다(궁금한 점 받기 등). */
  multiple?: true;
};

export type ToolPayload = {
  eyebrow: string;
  title: string;
  hint?: string;
  /** 조회할 때만 덱별 서명 URL로 붙는 배포 브랜드 그림. 저장 payload에는 넣지 않는다. */
  brandIcon?: string;
  /** 도구 위에 함께 두는 설명. 없으면 도구만 크게 놓는다. */
  intro?: Block[];
  /** 설명과 도구를 한 장 안에서 엮는 발표 전용 표현 방식. */
  layout?: ToolLayout;
};

export type ToolLayout = "moran-submit" | "submit-steps" | "arcade-submit";

/** 그림 한 장을 무대에 그대로 놓는 장. PDF 를 옮겨 온 자료가 이 모양이다. */
export type ImagePayload = {
  eyebrow: string;
  title: string;
  /** 앱이 서빙하는 경로. `/decks/...` 처럼 우리 도메인 안쪽만 쓴다. */
  src: string;
  alt: string;
  caption?: string;
  /** 그림 안에 그려 둔 버튼과 같은 자리에 얹는 실제 링크. 좌표는 그림의 백분율이다. */
  links?: ImageLink[];
};

export type ImageLink = {
  url: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SlidePayload =
  | CoverPayload
  | BodyPayload
  | SurveyPayload
  | ToolPayload
  | ImagePayload;

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** 편집기에서 온 색·크기를 다듬는다. 형식에 안 맞으면 통째로 버린다. */
export function cleanStyle(raw: { c?: unknown; s?: unknown }): InlineStyle {
  const out: InlineStyle = {};
  if (typeof raw.c === "string" && HEX.test(raw.c)) out.c = raw.c.toLowerCase();
  if (typeof raw.s === "number" && Number.isFinite(raw.s)) {
    const size = Math.round(Math.min(3, Math.max(0.5, raw.s)) * 100) / 100;
    if (size !== 1) out.s = size;
  }
  return out;
}

/** 같은 서식이 이어지면 하나로 합친다. 편집을 반복해도 토막이 잘게 부서지지 않는다. */
export function mergeInline(parts: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const part of parts) {
    if (part.v.length === 0) continue;
    const prev = out[out.length - 1];
    if (prev && prev.t === part.t && prev.c === part.c && prev.s === part.s) {
      out[out.length - 1] = { ...prev, v: prev.v + part.v };
      continue;
    }
    out.push({ ...part });
  }
  return out.length > 0 ? out : [{ t: "text", v: "" }];
}

/**
 * 본문 문장에 [[강조]] 표시를 넣으면 붉은 굵은 글씨가 된다.
 * 화면에는 React 노드로만 그리고 HTML 을 직접 넣지 않는다.
 */
export function parseInline(raw: string): Inline[] {
  const parts: Inline[] = [];
  const pattern = /\[\[(.+?)\]\]/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    if (match.index > cursor) {
      parts.push({ t: "text", v: raw.slice(cursor, match.index) });
    }
    parts.push({ t: "hl", v: match[1] });
    cursor = match.index + match[0].length;
  }

  if (cursor < raw.length) {
    parts.push({ t: "text", v: raw.slice(cursor) });
  }

  return parts.length > 0 ? parts : [{ t: "text", v: "" }];
}

export function p(raw: string): Block {
  return { b: "p", parts: parseInline(raw) };
}

export function lead(raw: string): Block {
  return { b: "lead", parts: parseInline(raw) };
}

export function note(raw: string): Block {
  return { b: "note", parts: parseInline(raw) };
}
