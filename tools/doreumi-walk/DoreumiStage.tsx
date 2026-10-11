import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AUTOFIT_EVENT } from "@/runtime/AutoFit";
import { DOREUMI_DANCES, DOREUMI_FALLBACK } from "./doreumi/assets";
import { DoreumiBrain, type Body, type Pose, type World } from "./doreumi/brain";
import { measureWorld } from "./doreumi/platforms";
import type { DoreumiRenderer } from "./doreumi/renderer";

/**
 * 3D 도름이 무대. 슬라이드 본문(.canvas) 위에 투명한 층을 하나 깔고, 그 위를 도름이가 걸어 다니고
 * 춤추고 발판 사이를 뛰어다닌다. 보는 사람이 눌러 들어 올려 다른 상자 위에 놓으면 떨어져 착지한다.
 *
 * - 층은 absolute 라서 AutoFit 이 재지 않고, 안의 모든 상자를 본문 안쪽에 가둬 잘림 검사에 걸리지 않는다.
 * - 캐릭터만 한 작은 WebGL 캔버스를 CSS transform 으로 옮긴다(본문 전체 캔버스를 쓰지 않는다).
 * - 누를 수 있는 곳은 몸통 크기의 투명 단추 하나뿐이고, 나머지는 클릭이 그대로 슬라이드로 간다.
 * - 움직임 줄이기·인쇄·PDF 캡처·WebGL 실패·불러오는 중에는 정지 그림(fallback.webp)만 세운다.
 */

/** 서 있을 때 키(무대 px). 무대는 1280x720 이다. */
const HEIGHT_PX = 150;
/** 렌더러가 몸 크기를 알려 주기 전의 어림값 */
const INITIAL_BODY: Body = { height: HEIGHT_PX, halfWidth: 54 };
const MEASURE_EVERY_MS = 250;
const DRAG_THRESHOLD_PX = 6;
/** 이보다 작게 줄어든 무대(목록 썸네일 등)에서는 WebGL 을 켜지 않는다. 휴대폰 참여 화면은 0.28 안팎이다. */
const MIN_LIVE_SCALE = 0.18;

export function DoreumiStage() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  // 자리표 하나로 자기가 들어 있는 슬라이드 본문을 찾는다. 자리표는 hidden 이라 배치에 끼지 않는다.
  const anchor = useCallback((node: HTMLSpanElement | null) => {
    setHost(node ? (node.closest<HTMLElement>(".canvas") ?? node.closest<HTMLElement>(".stage")) : null);
  }, []);
  return (
    <>
      <span ref={anchor} hidden data-doreumi-anchor="" />
      {host ? createPortal(<DoreumiLayer host={host} />, host) : null}
    </>
  );
}

function clamp(value: number, lo: number, hi: number) {
  return Math.min(Math.max(value, lo), Math.max(lo, hi));
}

/** 상자를 본문 안쪽으로 잘라 붙인다. 밖으로 나가는 부분이 있으면 잘림 검사가 본문을 넘친 것으로 본다. */
function placeInside(element: HTMLElement, world: World, left: number, top: number, right: number, bottom: number) {
  const l = clamp(left, 0, world.width);
  const t = clamp(top, 0, world.height);
  const r = clamp(right, 0, world.width);
  const b = clamp(bottom, 0, world.height);
  if (r - l < 1 || b - t < 1) {
    element.style.visibility = "hidden";
    return;
  }
  element.style.visibility = "visible";
  element.style.width = `${r - l}px`;
  element.style.height = `${b - t}px`;
  element.style.transform = `translate(${l}px, ${t}px)`;
}

type Box = { l: number; t: number; r: number; b: number };

/** 본문 안 글자가 차지한 상자들(무대 px). 정지 그림이 글자를 덮지 않게 자리를 고를 때 쓴다. */
function textBoxes(host: HTMLElement, overlay: HTMLElement, scale: number): Box[] {
  const origin = host.getBoundingClientRect();
  const k = scale > 0 ? scale : 1;
  const boxes: Box[] = [];
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    const parent = node.parentElement;
    if (!parent || overlay.contains(parent)) continue;
    range.selectNodeContents(node);
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.width < 1 || rect.height < 1) continue;
      boxes.push({
        l: (rect.left - origin.left) / k,
        t: (rect.top - origin.top) / k,
        r: (rect.right - origin.left) / k,
        b: (rect.bottom - origin.top) / k,
      });
    }
  }
  return boxes;
}

function DoreumiLayer({ host }: { host: HTMLElement }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const image = imageRef.current;
    const canvas = canvasRef.current;
    const hit = hitRef.current;
    const shadow = shadowRef.current;
    if (!root || !image || !canvas || !hit || !shadow) return;

    const inPrintDeck = host.closest(".deckPrint") !== null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const printMedia = window.matchMedia("print");
    const controller = new AbortController();
    let printing = printMedia.matches;
    let failed = false;
    let visible = false;
    let disposed = false;
    let loading = false;
    let renderer: DoreumiRenderer | null = null;
    let body = INITIAL_BODY;
    let pixelsPerUnit = 0;
    let frame = 0;
    let last = 0;
    let lastMeasure = 0;
    let press: { id: number; x: number; y: number } | null = null;
    let sized = { width: 0, height: 0, scale: 0 };
    const applied = { action: "", restart: -1, expression: "", facing: 9 };

    const measure = () => measureWorld(host, root, body.height * 0.92);
    let world = measure();
    const brain = new DoreumiBrain({
      duration: (action) => renderer?.duration(action) ?? 0,
      has: (action) => renderer?.hasAction(action) ?? false,
      dances: DOREUMI_DANCES,
    });
    brain.spawn(world, body);

    const staticOnly = () => inPrintDeck || printing || reducedMotion.matches || failed || world.scale < MIN_LIVE_SCALE;
    const running = () => !disposed && renderer !== null && visible && !document.hidden && !staticOnly();

    function placeShadow(x: number, feet: number, surface: number | null) {
      if (surface === null) {
        shadow!.style.visibility = "hidden";
        return;
      }
      const k = 1 - Math.min(0.65, Math.max(0, surface - feet) / 360);
      const halfWidth = body.halfWidth * 1.05 * k;
      const halfHeight = 8 * k;
      shadow!.style.opacity = String(k);
      placeInside(shadow!, world, x - halfWidth, surface - halfHeight - 2, x + halfWidth, surface + halfHeight - 2);
    }

    /**
     * 정지 그림을 발밑 면 위에 세운다. 불러오는 동안, 인쇄·PDF, 움직임 줄이기에서 이 모습이다.
     * 정지 그림은 비켜 주지 않으므로 글자를 덮지 않는 자리를 고른다. 같은 높이에서 지금 자리에
     * 가까운 곳부터 좌우로 옮겨 보고, 그래도 겹치면 조금씩 줄여 본다. 끝내 자리가 없으면 그리지 않는다.
     */
    function showStill() {
      cancelAnimationFrame(frame);
      frame = 0;
      brain.settle(world, body);
      canvas!.style.visibility = "hidden";
      hit!.style.display = "none";
      const texts = textBoxes(host, root!, world.scale);
      const fullHeight = (body.height * DOREUMI_FALLBACK.height) / (DOREUMI_FALLBACK.bottom - DOREUMI_FALLBACK.top);
      const feet = brain.y;
      let spot: { x: number; left: number; top: number; width: number; height: number; k: number } | null = null;
      for (const k of [1, 0.8, 0.65, 0.5]) {
        const height = fullHeight * k;
        const width = (height * DOREUMI_FALLBACK.width) / DOREUMI_FALLBACK.height;
        const top = clamp(feet - (height * DOREUMI_FALLBACK.bottom) / DOREUMI_FALLBACK.height, 0, world.height - height);
        // 바닥 전체를 24px 간격(양 끝 포함)으로 보되, 지금 서 있는 자리에서 가까운 곳부터 시험한다.
        const lo = width / 2;
        const hi = Math.max(lo, world.width - width / 2);
        const candidates: number[] = [];
        for (let x = lo; x < hi; x += 24) candidates.push(x);
        candidates.push(hi);
        const from = clamp(brain.x, lo, hi);
        candidates.sort((a, b) => Math.abs(a - from) - Math.abs(b - from));
        for (const x of candidates) {
          const left = x - width / 2;
          // 그림 파일의 투명한 가장자리는 빼고 캐릭터가 실제로 그려진 곳만 잰다.
          const figure: Box = {
            l: left + width * 0.15,
            r: left + width * 0.85,
            t: top + (height * DOREUMI_FALLBACK.top) / DOREUMI_FALLBACK.height,
            b: top + (height * DOREUMI_FALLBACK.bottom) / DOREUMI_FALLBACK.height,
          };
          const covers = texts.some((t) => t.l < figure.r + 4 && figure.l < t.r + 4 && t.t < figure.b + 4 && figure.t < t.b + 4);
          if (!covers) {
            spot = { x, left, top, width, height, k };
            break;
          }
        }
        if (spot) break;
      }
      root!.dataset.doreumiStill = spot ? String(spot.k) : "hidden";
      if (!spot) {
        image!.style.visibility = "hidden";
        shadow!.style.visibility = "hidden";
        return;
      }
      // 제 크기로 설 자리를 찾았으면 3D 도름이도 거기서 시작한다.
      if (spot.k === 1) brain.x = spot.x;
      image!.style.width = `${spot.width}px`;
      image!.style.height = `${spot.height}px`;
      image!.style.transform = `translate(${spot.left}px, ${spot.top}px)`;
      image!.style.visibility = "visible";
      if (spot.k === 1) placeShadow(spot.x, feet, feet);
      else shadow!.style.visibility = "hidden";
    }

    function sync() {
      if (disposed) return;
      world = measure();
      lastMeasure = performance.now();
      if (staticOnly() || !renderer) {
        root!.dataset.doreumiStage = staticOnly() ? (failed ? "fallback" : "still") : "loading";
        showStill();
        if (!staticOnly() && visible && !loading) void load();
        return;
      }
      root!.dataset.doreumiStage = "live";
      image!.style.visibility = "hidden";
      canvas!.style.visibility = "visible";
      hit!.style.display = "block";
      if (running() && !frame) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    }

    async function load() {
      loading = true;
      try {
        const { createDoreumiRenderer } = await import("./doreumi/renderer");
        if (disposed) return;
        const instance = await createDoreumiRenderer(canvas!, controller.signal);
        if (disposed) {
          instance.dispose();
          return;
        }
        renderer = instance;
        pixelsPerUnit = HEIGHT_PX / instance.metrics.height;
        body = { height: HEIGHT_PX, halfWidth: instance.metrics.halfWidth * pixelsPerUnit };
        sized = { width: 0, height: 0, scale: 0 };
      } catch (error) {
        if (disposed || controller.signal.aborted) return;
        failed = true;
        console.warn("도름이를 3D 로 그리지 못해 정지 그림으로 보여 줍니다.", error);
      } finally {
        loading = false;
      }
      sync();
    }

    function apply(pose: Pose) {
      const r = renderer!;
      const { box } = r.metrics;
      const width = (box.left + box.right) * pixelsPerUnit;
      const height = (box.top + box.bottom) * pixelsPerUnit;
      if (sized.width !== width || sized.height !== height || Math.abs(sized.scale - world.scale) > world.scale * 0.02) {
        canvas!.style.width = `${width}px`;
        canvas!.style.height = `${height}px`;
        r.resize(width, height, world.scale);
        sized = { width, height, scale: world.scale };
      }
      // 캔버스는 본문 안에 멈춰 서고, 모자란 만큼 카메라를 밀어 발은 제자리에 그린다.
      const wantLeft = pose.x - box.left * pixelsPerUnit;
      const wantTop = pose.y - box.top * pixelsPerUnit;
      const left = clamp(wantLeft, 0, world.width - width);
      const top = clamp(wantTop, 0, world.height - height);
      canvas!.style.transform = `translate(${left}px, ${top}px)`;
      r.setViewShift(wantLeft - left, wantTop - top, pixelsPerUnit);

      const halfWidth = body.halfWidth * 0.95;
      placeInside(hit!, world, pose.x - halfWidth, pose.y - body.height * 0.96, pose.x + halfWidth, pose.y + 2);
      placeShadow(pose.x, pose.y, pose.surface);

      if (pose.action !== applied.action || pose.restart !== applied.restart) {
        r.play(pose.action, { restart: pose.restart !== applied.restart, timeScale: pose.timeScale });
        applied.action = pose.action;
        applied.restart = pose.restart;
        root!.dataset.action = pose.action;
      }
      if (pose.expression !== applied.expression) {
        r.setExpression(pose.expression);
        applied.expression = pose.expression;
      }
      if (pose.facing !== applied.facing) {
        r.setFacing(pose.facing);
        applied.facing = pose.facing;
      }
    }

    function tick(now: number) {
      frame = 0;
      if (!running()) {
        last = 0;
        return;
      }
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      if (now - lastMeasure > MEASURE_EVERY_MS) {
        world = measure();
        lastMeasure = now;
        if (staticOnly()) return sync();
      }
      apply(brain.update(dt, world, body));
      renderer!.render(dt);
      frame = requestAnimationFrame(tick);
    }

    // ── 누르기·끌기·놓기 ──────────────────────────────────────────
    const toStage = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      return { x: (event.clientX - rect.left) / world.scale, y: (event.clientY - rect.top) / world.scale };
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!running() || press) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      hit.setPointerCapture(event.pointerId);
      world = measure();
      press = { id: event.pointerId, x: event.clientX, y: event.clientY };
      const point = toStage(event);
      brain.press(point.x, point.y);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!press || event.pointerId !== press.id) return;
      event.stopPropagation();
      if (!brain.isDragging() && Math.hypot(event.clientX - press.x, event.clientY - press.y) >= DRAG_THRESHOLD_PX) {
        brain.lift();
        hit.style.cursor = "grabbing";
      }
      if (brain.isDragging()) {
        const point = toStage(event);
        brain.dragTo(point.x, point.y);
      }
    };
    const finish = (event: PointerEvent, cancelled: boolean) => {
      if (!press || event.pointerId !== press.id) return;
      event.stopPropagation();
      press = null;
      if (hit.hasPointerCapture(event.pointerId)) hit.releasePointerCapture(event.pointerId);
      hit.style.cursor = "grab";
      world = measure();
      if (brain.isDragging()) brain.drop();
      else if (cancelled) brain.cancel();
      else brain.poke();
    };
    const onPointerUp = (event: PointerEvent) => finish(event, false);
    const onPointerCancel = (event: PointerEvent) => finish(event, true);
    const stop = (event: Event) => event.stopPropagation();
    const onKeyDown = (event: KeyboardEvent) => {
      // 화살표는 그대로 두어 슬라이드 넘기기를 막지 않는다.
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      if (running()) brain.poke();
    };
    const onFocus = () => {
      hit.style.outline = hit.matches(":focus-visible") ? "3px solid #ed5a14" : "none";
    };
    const onBlur = () => {
      hit.style.outline = "none";
    };
    hit.addEventListener("pointerdown", onPointerDown);
    hit.addEventListener("pointermove", onPointerMove);
    hit.addEventListener("pointerup", onPointerUp);
    hit.addEventListener("pointercancel", onPointerCancel);
    hit.addEventListener("lostpointercapture", onPointerCancel);
    hit.addEventListener("click", stop);
    hit.addEventListener("dblclick", stop);
    hit.addEventListener("keydown", onKeyDown);
    hit.addEventListener("focus", onFocus);
    hit.addEventListener("blur", onBlur);

    // ── 보일 때만 그린다 ─────────────────────────────────────────
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        sync();
      },
      { rootMargin: "120px" },
    );
    observer.observe(root);

    /*
     * 정지 그림은 글자를 피해 서므로, 자리를 정한 뒤 글자가 커지거나 바뀌면 다시 잰다.
     * 슬라이드 글자 크기는 AutoFit 이 나중에 정해 AUTOFIT_EVENT 로 알리고, 웹 글꼴도 늦게 도착한다.
     * 3D 로 움직이는 동안에는 따로 주기적으로 재므로 정지 그림일 때만 다시 세운다.
     */
    let remeasureFrame = 0;
    const remeasure = () => {
      if (disposed || remeasureFrame) return;
      remeasureFrame = requestAnimationFrame(() => {
        remeasureFrame = 0;
        if (!disposed && (staticOnly() || !renderer)) sync();
      });
    };
    const layoutWatch = new MutationObserver((records) => {
      // 도름이 층 안에서 일어난 변화(정지 그림·그림자 자리 옮김)는 무시한다.
      if (records.every((record) => root.contains(record.target))) return;
      // 무대에서 글을 고치는 동안에는 AutoFit 처럼 기다렸다가, 저장 뒤 글자 크기가 정해지면 다시 선다.
      if (host.querySelector("[data-inline-editing='true']")) return;
      remeasure();
    });
    layoutWatch.observe(host, { childList: true, subtree: true, characterData: true });
    host.addEventListener(AUTOFIT_EVENT, remeasure);
    void document.fonts?.ready.then(remeasure);

    const onPrintChange = () => {
      printing = printMedia.matches;
      sync();
    };
    const beforePrint = () => {
      printing = true;
      sync();
    };
    const afterPrint = () => {
      printing = printMedia.matches;
      sync();
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      const lost = renderer;
      renderer = null;
      failed = true;
      sync();
      try {
        lost?.dispose();
      } catch {
        // 이미 잃은 문맥이라 정리 중 오류는 무시한다.
      }
    };
    document.addEventListener("visibilitychange", sync);
    reducedMotion.addEventListener("change", sync);
    printMedia.addEventListener("change", onPrintChange);
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    canvas.addEventListener("webglcontextlost", onContextLost);
    sync();

    return () => {
      disposed = true;
      controller.abort();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(remeasureFrame);
      observer.disconnect();
      layoutWatch.disconnect();
      host.removeEventListener(AUTOFIT_EVENT, remeasure);
      document.removeEventListener("visibilitychange", sync);
      reducedMotion.removeEventListener("change", sync);
      printMedia.removeEventListener("change", onPrintChange);
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      hit.removeEventListener("pointerdown", onPointerDown);
      hit.removeEventListener("pointermove", onPointerMove);
      hit.removeEventListener("pointerup", onPointerUp);
      hit.removeEventListener("pointercancel", onPointerCancel);
      hit.removeEventListener("lostpointercapture", onPointerCancel);
      hit.removeEventListener("click", stop);
      hit.removeEventListener("dblclick", stop);
      hit.removeEventListener("keydown", onKeyDown);
      hit.removeEventListener("focus", onFocus);
      hit.removeEventListener("blur", onBlur);
      renderer?.dispose();
      renderer = null;
    };
  }, [host]);

  return (
    <div
      ref={rootRef}
      className="doreumi-stage"
      data-doreumi-stage="loading"
      style={{ position: "absolute", inset: 0, zIndex: 3, overflow: "hidden", pointerEvents: "none" }}
    >
      <div
        ref={shadowRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          visibility: "hidden",
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(70, 58, 44, 0.24), rgba(70, 58, 44, 0))",
          pointerEvents: "none",
        }}
      />
      {/* 정지 그림은 3D 와 같은 삼각형·같은 무표정으로 만든 승인본이다. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        src={DOREUMI_FALLBACK.src}
        alt=""
        aria-hidden="true"
        width={DOREUMI_FALLBACK.width}
        height={DOREUMI_FALLBACK.height}
        draggable={false}
        style={{ position: "absolute", top: 0, left: 0, maxWidth: "none", visibility: "hidden", pointerEvents: "none", userSelect: "none" }}
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: "absolute", top: 0, left: 0, display: "block", visibility: "hidden", pointerEvents: "none" }}
      />
      <div
        ref={hitRef}
        role="button"
        tabIndex={0}
        aria-label="도름이"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          display: "none",
          borderRadius: "44% 44% 36% 36%",
          cursor: "grab",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTapHighlightColor: "transparent",
          outline: "none",
          outlineOffset: 2,
          pointerEvents: "auto",
        }}
      />
    </div>
  );
}
