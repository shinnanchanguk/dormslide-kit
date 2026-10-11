import { useEffect, useRef, useState, type ReactNode } from "react";

const STAGE_W = 1280;
const STAGE_H = 720;

/**
 * 고정 무대(1280x720)를 화면에 맞춰 통째로 축소한다.
 * 창 크기가 달라도 슬라이드 안의 배치는 늘 같아서 발표와 인쇄가 흔들리지 않는다.
 */
export function Stage({
  rail,
  page,
  pageNo,
  brand,
  issue,
  footDeck,
  children,
  live,
  zoom = 1,
  onScaleChange,
  allowUpscale = false,
  mark,
  backdrop,
}: {
  rail: string;
  page: string;
  pageNo: string;
  brand: string;
  issue: string;
  footDeck: string;
  children: ReactNode;
  live?: boolean;
  zoom?: number;
  onScaleChange?: (scale: number) => void;
  /** 다른 사이트 글 안에 싣는 보기 화면처럼 무대가 틀을 가득 채워야 하는 곳에서만 켠다. */
  allowUpscale?: boolean;
  /** DoRmSlide 표식. 꼬리 띠(DECK · SLIDE 줄) 오른쪽 끝에, 그 디자인의 꼬리 글꼴로 들어간다. */
  mark?: ReactNode;
  /** 디자인의 바탕 그림. */
  backdrop?: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    let appliedScale = 1;
    let frame: number | null = null;
    const fit = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = null;
        const { width, height } = box.getBoundingClientRect();
        if (width === 0 || height === 0) return;
        // 화면을 축소했을 때 무대만 다시 커져 브라우저 축소를 상쇄하지 않도록
        // 원본 크기(1)를 상한으로 둔다. 뷰어 조작부도 이 값을 함께 쓴다.
        const fitScale = Math.min(width / STAGE_W, height / STAGE_H);
        const nextScale = allowUpscale ? fitScale : Math.min(1, fitScale);
        // 조작부 zoom이 flex 높이에 반영되며 생기는 미세 재측정을 한 프레임에
        // 합치고, 눈에 보이지 않는 차이는 다시 상태로 올리지 않는다.
        if (Math.abs(nextScale - appliedScale) < 0.001) return;
        appliedScale = nextScale;
        setScale(nextScale);
        onScaleChange?.(nextScale);
      });
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    window.addEventListener("orientationchange", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", fit);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [allowUpscale, onScaleChange]);

  const renderScale = scale * zoom;

  return (
    <div
      ref={boxRef}
      className="stage-box"
      data-stage-base-scale={scale.toFixed(4)}
      data-stage-render-scale={renderScale.toFixed(4)}
      data-stage-zoom={zoom.toFixed(3)}
    >
      <div className="stage-box__content">
        <div
          className="stage-frame"
          data-stage-frame
          style={{ width: STAGE_W * renderScale, height: STAGE_H * renderScale }}
        >
          <div className="stage" style={{ transform: `scale(${renderScale})` }}>
            {backdrop}
            <aside className="rail">
              <div className="rail__mark">DS</div>
              <div className="rail__vt">{rail}</div>
              <div className="rail__pg">{pageNo}</div>
            </aside>
            <header className="top">
              <div className="top__brand">{brand}</div>
              <div className="top__right">{issue}</div>
            </header>
            <div className="canvas">
              {children}
              <div className="canvas__fade" aria-hidden="true">
                아래로 더 있어요
              </div>
            </div>
            <footer className="foot">
              <span>
                <span className="foot__key">DECK</span>{" "}
                <span className="foot__value">{footDeck}</span>
              </span>
              <span>
                <span className="foot__key">SLIDE</span>{" "}
                <span className="foot__value">{page}</span>
              </span>
              {live ? <span className="foot__rec">LIVE</span> : null}
              {mark ? <span className="foot__mark">{mark}</span> : null}
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
