import { useLayoutEffect, useState } from "react";

type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null };

/** 영상·틀 같은 요소가 스스로 전체 화면이 된 것은 창을 담을 자리가 아니다. */
function canHost(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement && !(element instanceof HTMLMediaElement) && !(element instanceof HTMLIFrameElement);
}

/**
 * 화면 전체를 덮는 창(크게 보기·큰 화면 활동)을 그릴 자리.
 *
 * 브라우저는 전체 화면일 때 전체 화면 요소 안쪽만 그린다. 그래서 창을 늘 body 에 그리면 전체 화면에서는
 * 창이 열려 있는데도 보이지 않는다(열린 창이 넘기기 키를 막아 쪽도 안 넘어간다). 전체 화면이면 그 요소를,
 * 아니면 body 를 돌려주고, 창이 열려 있는 동안 전체 화면이 켜지거나 꺼지면 다시 고른다.
 * 창 안 영상을 전체 화면으로 키운 경우처럼 영상·틀이 전체 화면이면 자리를 바꾸지 않는다.
 */
export function useFullscreenHost(active: boolean): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  // 화면을 그리기 전에 자리를 정해 창이 한 박자 늦게 나타나거나 엉뚱한 자리에 번쩍이지 않게 한다.
  useLayoutEffect(() => {
    if (!active) return;
    const pick = () => {
      const documentObject = document as FullscreenDocument;
      const current = documentObject.fullscreenElement ?? documentObject.webkitFullscreenElement ?? null;
      // 문서 전체(<html>)가 전체 화면이면 body 에 그려야 글꼴·줄바꿈 규칙을 그대로 받는다.
      if (!current || current === document.documentElement) return setHost(document.body);
      if (canHost(current)) return setHost(current);
      setHost((previous) => previous ?? document.body);
    };
    pick();
    document.addEventListener("fullscreenchange", pick);
    document.addEventListener("webkitfullscreenchange", pick);
    return () => {
      document.removeEventListener("fullscreenchange", pick);
      document.removeEventListener("webkitfullscreenchange", pick);
      setHost(null);
    };
  }, [active]);
  return active ? host : null;
}
