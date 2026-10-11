import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * 글자 크기를 새로 정할 때마다 .fit-wrap 에서 위로 올려 보내는 신호.
 * 글자를 피해 서는 장식(정지한 도름이 등)이 이 신호를 듣고 자리를 다시 잡는다.
 */
export const AUTOFIT_EVENT = "dormslide:autofit";

/**
 * 남는 여백만큼 글자를 키운다.
 * 내용이 적은 슬라이드가 가운데 작게 뜨지 않고 화면을 꽉 채우게 하는 장치다.
 *
 * 재는 방법이 중요하다. 자식들의 높이를 그냥 더하면 사이 간격과 바깥 여백이 빠져
 * 실제보다 작게 잡히고, 그만큼 글자를 더 키워 무대 밖으로 넘친다. 그래서 자식들이
 * 실제로 차지한 범위를 안쪽 상자와 견줘 넘친 만큼을 직접 잰다. 절대 위치로 놓은
 * 장식(구분선 같은 것)은 흐름에 없으므로 계산에서 뺀다.
 */
export function AutoFit({
  className,
  min = 15,
  max = 30,
  children,
}: {
  className: string;
  min?: number;
  max?: number;
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(min);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    let cancelled = false;
    let savedScrollTop = 0;

    const measure = (size: number) => {
      wrap.style.setProperty("--fs", `${size}px`);
      // 스크롤된 상태로 재면 자식 위치가 밀려 넘침이 잘못 잡힌다. 먼저 맨 위로.
      wrap.scrollTop = 0;

      const box = wrap.getBoundingClientRect();
      const styles = getComputedStyle(wrap);
      // getBoundingClientRect()는 무대 transform이 적용된 값이고 padding/margin은
      // 원본 CSS px이다. 둘을 그대로 섞으면 휴대폰처럼 무대가 작게 축소될수록
      // 여백을 과하게 빼서 글자를 최소 크기로 오판한다.
      const scaleX = wrap.offsetWidth > 0 ? box.width / wrap.offsetWidth : 1;
      const scaleY = wrap.offsetHeight > 0 ? box.height / wrap.offsetHeight : 1;
      const innerTop = box.top + parseFloat(styles.paddingTop) * scaleY;
      const innerBottom = box.bottom - parseFloat(styles.paddingBottom) * scaleY;
      const innerLeft = box.left + parseFloat(styles.paddingLeft) * scaleX;
      const innerRight = box.right - parseFloat(styles.paddingRight) * scaleX;

      let top = Number.POSITIVE_INFINITY;
      let bottom = Number.NEGATIVE_INFINITY;
      let left = Number.POSITIVE_INFINITY;
      let right = Number.NEGATIVE_INFINITY;

      for (const child of Array.from(wrap.children)) {
        const childStyle = getComputedStyle(child);
        if (childStyle.position === "absolute" || childStyle.position === "fixed") continue;
        const rect = child.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        top = Math.min(top, rect.top - parseFloat(childStyle.marginTop) * scaleY);
        bottom = Math.max(bottom, rect.bottom + parseFloat(childStyle.marginBottom) * scaleY);
        left = Math.min(left, rect.left);
        right = Math.max(right, rect.right);
      }

      if (!Number.isFinite(top)) return { overflowY: 0, overflowX: 0, filled: 0, scaleX, scaleY };

      const geometryOverflowY = Math.max(0, innerTop - top) + Math.max(0, bottom - innerBottom);
      const geometryOverflowX = Math.max(0, innerLeft - left) + Math.max(0, right - innerRight);
      // DOM 스크롤 크기는 transform 전 CSS px이라 실제로 2px가 잘려도 축소된
      // 무대에서는 0.5px 안팎으로 보일 수 있다. 자식 경계 계산과 함께 환산한
      // 스크롤 넘침도 검사해 휴대폰 무대의 미세 잘림까지 이진탐색에 반영한다.
      const scrollOverflowY = Math.max(0, wrap.scrollHeight - wrap.clientHeight) * scaleY;
      const scrollOverflowX = Math.max(0, wrap.scrollWidth - wrap.clientWidth) * scaleX;
      const overflowY = Math.max(geometryOverflowY, scrollOverflowY);
      const overflowX = Math.max(geometryOverflowX, scrollOverflowX);
      const filled = (bottom - top) / Math.max(1, innerBottom - innerTop);
      return { overflowY, overflowX, filled, scaleX, scaleY };
    };

    const updateMoreCue = () => {
      const canvas = wrap.parentElement;
      if (!canvas?.classList.contains("canvas")) return;
      const remaining = wrap.scrollHeight - wrap.clientHeight - wrap.scrollTop;
      if (remaining > 2) canvas.setAttribute("data-more", "");
      else canvas.removeAttribute("data-more");
    };

    const run = () => {
      if (cancelled) return;
      if (wrap.getBoundingClientRect().height === 0) return;
      savedScrollTop = wrap.scrollTop;
      /*
       * 슬라이드 안에 따로 스크롤하는 칸이 있으면(표를 훑어 읽는 장 등) 그 위치도 지킨다.
       * 글자 크기를 열네 번 바꿔 재는 동안 그 칸의 내용 높이가 함께 줄었다 늘어나는데,
       * 브라우저가 그때마다 스크롤 위치를 위로 당겨 붙여 버린다. 재기 전에 적어 두고
       * 끝난 뒤 되돌려 놓지 않으면, 내려서 보다가 자꾸 맨 위로 튀어 오른다.
       */
      const inner = Array.from(wrap.querySelectorAll<HTMLElement>("[data-scroll]"));
      const innerTops = inner.map((node) => node.scrollTop);

      /*
       * 넘치지 않는 가장 큰 글자 크기를 이진탐색으로 찾는다.
       * 넘침은 무대 원래 크기(px)로 따진다. 휴대폰처럼 무대가 0.3배로 줄면 화면의 0.5px 가
       * 원래 크기로 2px 가까이 되어, 기기마다 조금 다른 글꼴 그리기만으로 "아래로 더 있어요"
       * 가 뜨고 거의 굴릴 것도 없는 스크롤이 생긴다.
       */
      const fits = (size: number) => {
        const { overflowY, overflowX, scaleX, scaleY } = measure(size);
        return overflowY / Math.max(scaleY, 0.01) <= 0.5 && overflowX / Math.max(scaleX, 0.01) <= 0.5;
      };
      let settled = max;
      if (!fits(max)) {
        let low = min;
        let high = max;
        let best = min;
        for (let step = 0; step < 14; step += 1) {
          const mid = (low + high) / 2;
          if (fits(mid)) {
            best = mid;
            low = mid;
          } else {
            high = mid;
          }
        }
        // 딱 맞는 크기에서 조금(1.5%) 물린다. 눈에 띄지 않을 만큼이지만, 잰 뒤에 배치가 바뀌는
        // 경우(등장 움직임, 늦게 도착하는 글꼴 조각, 늦게 뜨는 그림)를 받아 주어 다 보이는 장에
        // 거의 굴릴 것 없는 스크롤이 생기지 않는다. 물린 크기도 넘치면 딱 맞는 크기로 돌아간다.
        settled = best > min ? Math.max(min, best * 0.985) : best;
        if (settled !== best && !fits(settled)) settled = best;
      }
      wrap.style.setProperty("--fs", `${settled}px`);
      setFontSize(settled);
      // 주기적으로 내용이 갱신돼도 보고 있던 위치를 빼앗지 않는다.
      wrap.scrollTop = Math.min(savedScrollTop, Math.max(0, wrap.scrollHeight - wrap.clientHeight));
      inner.forEach((node, index) => {
        const want = innerTops[index] ?? 0;
        const limit = Math.max(0, node.scrollHeight - node.clientHeight);
        const next = Math.min(want, limit);
        if (Math.abs(node.scrollTop - next) > 0.5) node.scrollTop = next;
      });

      // 줄일 만큼 줄여도 안 들어가면 잘라내지 않고 스크롤한다.
      // 무대 아래 옅은 띠로 "더 있어요" 를 알린다.
      updateMoreCue();
      wrap.dispatchEvent(new CustomEvent(AUTOFIT_EVENT, { bubbles: true }));
    };

    const start = () => {
      if (document.fonts?.ready) {
        document.fonts.ready.then(run).catch(run);
      } else {
        run();
      }
    };

    /*
     * 사람이 안쪽 칸을 굴리는 동안에는 다시 재지 않는다. ResizeObserver 가 소수점 오차로
     * 깨어나면 복원이 한 프레임 늦어 화면이 덜컥거리기 때문이다.
     */
    let scrolling = 0;
    const onScroll = () => {
      updateMoreCue();
      window.clearTimeout(scrolling);
      scrolling = window.setTimeout(() => {
        scrolling = 0;
      }, 300);
    };
    wrap.addEventListener("scroll", onScroll, { capture: true, passive: true });

    // 재는 일은 레이아웃을 열네 번 읽는다. 한 프레임에 한 번으로 묶는다.
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (scrolling) return;
        run();
      });
    };

    start();
    const observer = new ResizeObserver(schedule);
    observer.observe(wrap);
    // 도구 안에서 내용이 자라도(링크가 쌓이는 등) 다시 재야 한다.
    const grow = new MutationObserver(() => {
      // 관리자 무대에서 타이핑할 때마다 글자 크기를 재면 줄바꿈과 배치가 흔들려
      // 커서 감각이 나빠진다. 포커스를 벗어나 저장·렌더된 뒤에 한 번 다시 잰다.
      if (wrap.querySelector("[data-inline-editing='true']")) return;
      schedule();
    });
    grow.observe(wrap, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      grow.disconnect();
      wrap.removeEventListener("scroll", onScroll, { capture: true });
      window.clearTimeout(scrolling);
      // 다음 장이 이 표시를 물려받지 않게 떠날 때 지운다.
      wrap.parentElement?.removeAttribute("data-more");
    };
  }, [children, min, max]);

  return (
    <div ref={wrapRef} className={`fit-wrap ${className}`} style={{ ["--fs" as string]: `${fontSize}px` }}>
      {children}
    </div>
  );
}
