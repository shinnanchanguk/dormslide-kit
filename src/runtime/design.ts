import type { ReactNode } from "react";
import type { Block, BodyPayload, BodyResource } from "@/lib/deck-content";
import type { SlideInlineEditor } from "./InlineEditableText";

/** 디자인이 본문 배치를 그릴 때 받는 것. 글 블록·자료 링크를 그리는 손은 무대가 넘겨준다. */
export type BodyLayoutProps = {
  payload: BodyPayload;
  renderBlocks: (columnIndex: number, blocks: Block[], blockIndexes: number[]) => ReactNode;
  renderResource: (resource: BodyResource, index: number, variant: "source" | "case" | "cover") => ReactNode;
  media?: ReactNode;
  /** 개발 서버의 [편집] 이 켜졌을 때만 온다. */
  editor?: SlideInlineEditor;
};

/** 배치 하나의 설명. AI 가 어떤 장에 어떤 배치를 쓸지 고를 때 읽는다(designs/<이름>/README.md 에도 같은 표가 있다). */
export type LayoutInfo = {
  id: string;
  /** 한 줄로: 언제 쓰나. */
  when: string;
};

/**
 * 디자인 한 벌. 같은 덱을 이 디자인의 모양으로 그린다.
 * 새 디자인을 만들 때는 designs/dorms-story 를 본보기로 이 모양을 채운다(CONTRIBUTING.md).
 */
export type Design = {
  id: string;
  name: string;
  summary: string;
  /** 무대 바깥을 감싸는 클래스. 이 디자인의 CSS 는 모두 이 클래스 안에서만 듣게 쓴다. */
  className: string;
  /** DoRmSlide 표식에 입힐 포인트 색. */
  markColor: string;
  /** 표식 글자·그림 뒤 바탕(밝은 바탕 위에서는 비워 둔다). */
  markSurface?: string;
  layouts: readonly LayoutInfo[];
  /** 이 디자인이 그리는 배치면 그림을, 모르는 배치면 null 을 돌려준다. */
  renderBody: (props: BodyLayoutProps) => ReactNode | null;
  /** 배치마다 글자를 키울 수 있는 최대 크기(px). 비우면 34. */
  fitMax?: (layout: string | undefined) => number;
};
