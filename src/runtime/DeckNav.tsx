import { createContext, useContext } from "react";

/**
 * 슬라이드 안에서 다른 쪽으로 넘기는 통로. 보기 화면(도름스 글 속 보기·도름슬라이드 보기)이 넣어 주고,
 * 목차 장처럼 누르면 넘어가는 자리가 쓴다. PDF·인쇄·편집 화면에는 넣지 않으므로 그곳에서는 글자로만 남는다.
 */
export type DeckNav = {
  /** 0부터 센 자리로 넘긴다. */
  go: (index: number) => void;
  /** 지금 넘어갈 수 있는 마지막 쪽(1부터). 참여자가 발표자를 따라가는 동안은 발표자가 연 쪽까지다. */
  max: number;
};

export const DeckNavContext = createContext<DeckNav | undefined>(undefined);

export function useDeckNav(): DeckNav | undefined {
  return useContext(DeckNavContext);
}
