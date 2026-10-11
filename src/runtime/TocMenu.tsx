import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/runtime/Icon";
import { tocEntryAt, type DeckTocEntry } from "@/lib/deck-toc";
import { useFullscreenHost } from "./useFullscreenHost";

const MARGIN = 8;
const GAP = 8;

/**
 * 아래 막대의 `목차` 단추와 목차 창. 창에서 장을 누르면 그 장의 첫 쪽으로 넘어가고 창이 닫힌다.
 * 닫기 단추·Esc·창 바깥 누르기로도 닫힌다. 창은 단추 위에 뜨고(자리가 없으면 아래), 화면 밖으로
 * 나가지 않게 당기며, 길면 창 안에서 굴린다. 전체 화면일 때는 전체 화면 요소 안에 그려야 보인다.
 */
export function TocMenu({
  entries,
  index,
  max,
  onGo,
  className = "btn btn--sm",
  labelClassName,
  testId,
}: {
  entries: readonly DeckTocEntry[];
  /** 지금 자리(0부터). */
  index: number;
  /** 지금 넘어갈 수 있는 마지막 쪽(1부터). */
  max: number;
  onGo: (index: number) => void;
  className?: string;
  labelClassName?: string;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CSSProperties>({ visibility: "hidden" });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const host = useFullscreenHost(open);
  const current = tocEntryAt(entries, index + 1);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setPlace({ visibility: "hidden" });
    if (returnFocus) buttonRef.current?.focus({ preventScroll: true });
  }, []);

  // 단추 자리를 기준으로 창 위치를 잰다. 첫 그림은 숨겨 두고 크기를 잰 뒤 보인다.
  const measure = useCallback(() => {
    const button = buttonRef.current;
    const panel = panelRef.current;
    if (!button || !panel) return;
    const anchor = button.getBoundingClientRect();
    const width = Math.min(panel.offsetWidth, window.innerWidth - MARGIN * 2);
    // scrollHeight 에는 테두리가 빠져 있어 더한다.
    const natural = panel.scrollHeight + (panel.offsetHeight - panel.clientHeight);
    const above = anchor.top - GAP - MARGIN;
    const below = window.innerHeight - anchor.bottom - GAP - MARGIN;
    const up = natural <= above || above >= below;
    const room = Math.max(120, up ? above : below);
    const height = Math.min(natural, room);
    const top = up ? Math.max(MARGIN, anchor.top - GAP - height) : anchor.bottom + GAP;
    const left = Math.min(Math.max(MARGIN, anchor.left), window.innerWidth - width - MARGIN);
    setPlace({ top, left, maxHeight: room, visibility: "visible" });
  }, []);

  useLayoutEffect(() => {
    if (!open || !host) return;
    measure();
    const frame = requestAnimationFrame(measure);
    // 창 안을 굴릴 때는 자리가 그대로라 다시 재지 않는다.
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && panelRef.current?.contains(event.target)) return;
      measure();
    };
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, host, measure]);

  // 창이 보이게 된 뒤(숨긴 채로는 초점을 받지 못한다) 지금 장(없으면 첫 장)에 초점을 둔다. 열 때마다 한 번.
  const visible = place.visibility === "visible";
  const focused = useRef(false);
  useEffect(() => {
    if (!open) {
      focused.current = false;
      return;
    }
    if (!visible || focused.current) return;
    focused.current = true;
    const panel = panelRef.current;
    const target = panel?.querySelector<HTMLButtonElement>('[aria-current="true"]:not(:disabled)') ?? panel?.querySelector<HTMLButtonElement>(".toc-menu__item:not(:disabled)");
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "nearest" });
  }, [open, visible]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (panelRef.current?.contains(target) || buttonRef.current?.contains(target))) return;
      close(false);
    };
    // 창이 열려 있는 동안 Esc 는 창만 닫는다(전체 화면 끝내기 등 다른 Esc 처리보다 먼저 받는다).
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close(true);
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      // 초점이 창 안에 있을 때만 위아래 화살표로 장을 옮긴다(다른 입력칸의 화살표는 가로채지 않는다).
      if (!panelRef.current?.contains(document.activeElement)) return;
      const items = [...(panelRef.current?.querySelectorAll<HTMLButtonElement>(".toc-menu__item:not(:disabled)") ?? [])];
      if (!items.length) return;
      event.preventDefault();
      event.stopPropagation();
      const at = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "ArrowDown" ? (at + 1) % items.length : (at <= 0 ? items.length : at) - 1;
      items[next].focus();
    };
    // 도름스 글 속 틀에서는 바깥 글이나 슬라이드 안 영상 틀을 누르면 이 문서에 누름이 오지 않고 창 초점만 빠진다.
    const onBlur = () => close(false);
    document.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [open, close]);

  // 창이 열린 채 다른 방법(넘김 키·리모컨)으로 쪽이 바뀌면 가려진 채 넘어가지 않게 창을 닫는다.
  const openedAt = useRef(index);
  useEffect(() => {
    if (!open) {
      openedAt.current = index;
      return;
    }
    // 초점이 창 안에 있었으면 목차 단추로 돌려준다(키보드 사용자가 자리를 잃지 않게).
    if (index !== openedAt.current) close(!!panelRef.current?.contains(document.activeElement));
  }, [open, index, close]);

  const panel =
    open && host
      ? createPortal(
          // 창의 빈 곳을 눌러도 초점이 창 안에 남아 위아래 화살표가 계속 먹게 한다.
          <div ref={panelRef} className="toc-menu__panel" role="dialog" aria-label="목차" tabIndex={-1} data-test={`${testId}-panel`} style={place}>
            <div className="toc-menu__head">
              <strong>목차</strong>
              <button type="button" className="toc-menu__close" aria-label="목차 닫기" data-test={`${testId}-close`} onClick={() => close(true)}>
                <Icon name="close" size={14} />
              </button>
            </div>
            <ol className="toc-menu__list">
              {entries.map((entry, at) => (
                <li key={`${entry.from}:${at}`}>
                  <button
                    type="button"
                    className="toc-menu__item"
                    data-test={`${testId}-item`}
                    aria-current={at === current ? "true" : undefined}
                    disabled={entry.from > max}
                    onClick={(event) => {
                      // 키보드로 골랐으면(detail 0) 목차 단추로 초점을 돌려 자리를 잃지 않게 한다.
                      close(event.detail === 0);
                      if (entry.from - 1 !== index) onGo(entry.from - 1);
                    }}
                  >
                    <span className="toc-menu__mark">{entry.mark}</span>
                    <span className="toc-menu__text">
                      <span className="toc-menu__title">{entry.title}</span>
                      {entry.what ? <span className="toc-menu__what">{entry.what}</span> : null}
                    </span>
                    <span className="toc-menu__pages">
                      {entry.from === entry.to ? entry.from : `${entry.from}~${entry.to}`}쪽
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>,
          host,
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={className}
        data-test={testId}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="목차 열기"
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <Icon name="toc" size={13} />
        <span className={labelClassName}>목차</span>
      </button>
      {panel}
    </>
  );
}
