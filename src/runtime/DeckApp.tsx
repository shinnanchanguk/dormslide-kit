import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Deck, DeckSlide } from "@/lib/deck";
import { deckToc } from "@/lib/deck-toc";
import { applyInlineEditToSlide } from "@/lib/inline-edit-client";
import { designOf } from "@designs/index";
import { liveClient, liveRoom, newRoomName, setLiveEnabled, setLiveRoom } from "@tools/live/client";
import { Stage } from "./Stage";
import { SlidePage } from "./SlidePage";
import { DeckNavContext } from "./DeckNav";
import { FirstPageButton, PageJump } from "./PageJump";
import { TocMenu } from "./TocMenu";
import { Icon } from "./Icon";
import { Mark } from "./Mark";
import { QrCode } from "./QrCode";
import { startMarkGuard } from "./markGuard";
import type { SlideInlineEdit, SlideInlineEditor } from "./InlineEditableText";
import { LocalResultsContext } from "@tools/results-export/context";
import { createLocalResults, hasResultSlides, localResultRows, roomResultRows, RESULT_HEADERS } from "@tools/results-export/roomResults";
import { downloadCsv } from "@tools/results-export/exportCsv";

/**
 * 발표 화면 하나. 덱을 받아 장을 넘기고, 아래 띠에 기본 기능을 둔다.
 *   처음으로 · 이전 · 쪽 번호 · 다음 · 목차 · 전체 화면 · 링크 공유 · (개발 서버) 편집 · (실시간) 발표자 따라오기
 */

type Props = {
  deck: Deck;
  /** 디자인을 덱과 다르게 보여 줄 때(디자인 미리보기). */
  designOverride?: string;
  /** 개발 서버에서 편집을 저장할 파일. 비우면 편집 단추가 없다. */
  editTarget?: string;
};

function readHashPage(total: number) {
  const value = Number(window.location.hash.replace(/^#/, ""));
  return Number.isInteger(value) && value >= 1 && value <= total ? value - 1 : 0;
}

export function DeckApp({ deck: initial, designOverride, editTarget }: Props) {
  const [deck, setDeck] = useState(initial);
  const total = deck.slides.length;
  const [index, setIndex] = useState(() => readHashPage(total));
  const [editing, setEditing] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [shareOpen, setShareOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [following, setFollowing] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState("");
  const localResults = useMemo(createLocalResults, [initial]);
  const rootRef = useRef<HTMLDivElement>(null);
  const design = designOf(designOverride ?? deck.meta.design);
  const toc = useMemo(() => deckToc(deck.slides) ?? [], [deck.slides]);

  // 실시간 모드: 덱이 켜 두었고 내 수파베이스 주소가 있을 때만. 방 이름은 주소의 ?room= (발표자가 [발표 시작] 때 만든다).
  const [room, setRoom] = useState(() => new URLSearchParams(window.location.search).get("room"));
  setLiveEnabled(deck.meta.live === true);
  setLiveRoom(room);
  const client = deck.meta.live === true ? liveClient() : null;
  const live = client && liveRoom() ? client : null;

  const startPresenting = useCallback(() => {
    if (!client) return;
    let name = liveRoom();
    if (!name) {
      name = newRoomName();
      const params = new URLSearchParams(window.location.search);
      params.set("room", name);
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);
      setLiveRoom(name);
      setRoom(name);
    }
    setPresenting(true);
    setShareOpen(true);
    void client.setPresenter(name, index);
  }, [client, index]);

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(total - 1, next));
      setIndex(clamped);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${clamped + 1}`);
      if (live && presenting) void live.setPresenter(liveRoom(), clamped);
    },
    [total, live, presenting],
  );

  // 발표자 따라오기: 학생 화면은 발표자가 넘긴 장으로 같이 넘어간다. 꺼 두면 혼자 넘겨 본다.
  useEffect(() => {
    if (!live || presenting || !following) return;
    return live.subscribePresenter(liveRoom(), (presenterIndex) => {
      setIndex(Math.max(0, Math.min(total - 1, presenterIndex)));
    });
  }, [live, presenting, following, total]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        go(index + 1);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        go(index - 1);
      } else if (event.key === "Home") go(0);
      else if (event.key === "End") go(total - 1);
      else if (event.key === "f" || event.key === "F") void toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, total]);

  useEffect(() => {
    const onHash = () => setIndex(readHashPage(total));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [total]);

  // 표식 지킴이(두 번째 겹).
  useEffect(() => {
    if (!rootRef.current) return;
    return startMarkGuard(rootRef.current);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const root = rootRef.current;
    if (!root) return;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    else await root.requestFullscreen?.().catch(() => undefined);
  }, []);

  const editor: SlideInlineEditor | undefined = useMemo(() => {
    if (!editing || !editTarget) return undefined;
    return {
      onCommit: (change: SlideInlineEdit) => {
        const current = deck.slides[index];
        const next = applyInlineEditToSlide(current as DeckSlide & { kind: string; payload: unknown }, change);
        if (!next) return;
        const slides = deck.slides.map((slide, slideIndex) => (slideIndex === index ? (next as DeckSlide) : slide));
        const nextDeck = { ...deck, slides };
        setDeck(nextDeck);
        if (editTarget === "memory") {
          setSaveState("saved");
          return;
        }
        setSaveState("saving");
        fetch("/__dormslide/edit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ target: editTarget, slideIndex: index, slide: next }),
        })
          .then((response) => setSaveState(response.ok ? "saved" : "error"))
          .catch(() => setSaveState("error"));
      },
    } as SlideInlineEditor;
  }, [editing, editTarget, deck, index]);

  const slide = deck.slides[index];
  const shareUrl = typeof window === "undefined" ? "" : `${window.location.origin}${window.location.pathname}${window.location.search}`;

  const exportAll = async () => {
    if (exporting) return;
    setExporting(true);
    setExportNotice("");
    try {
      const rows = live && presenting ? roomResultRows(deck, await live.exportRoom(liveRoom())) : localResultRows(deck, localResults);
      if (!rows.length) {
        setExportNotice("아직 내려받을 결과가 없어요.");
        return;
      }
      downloadCsv(`${deck.meta.title} 전체 결과.csv`, RESULT_HEADERS, rows);
      setExportNotice("모든 장의 결과를 받았어요. 엑셀에서 열 수 있어요.");
    } catch (error) {
      setExportNotice(error instanceof Error ? error.message : "결과를 불러오지 못했어요. 다시 눌러 주세요.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <LocalResultsContext.Provider value={localResults}>
    <div ref={rootRef} className={`ds-app ${design.className}${editing ? " is-editing" : ""}`} style={{ ["--ds-mark" as string]: design.markColor }} data-design={design.id}>
      <DeckNavContext.Provider value={{ go, max: total }}>
        <Stage rail={deck.meta.railLabel} page={String(index + 1).padStart(2, "0")} pageNo={`${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`} brand={deck.meta.brand} issue={deck.meta.issueLabel} footDeck={deck.meta.footLabel} mark={<Mark />} backdrop={design.Backdrop ? <design.Backdrop /> : null}>
          {slide ? <SlidePage key={`${index}:${editing ? "e" : "v"}`} slide={slide} index={index} design={design} editor={editor} /> : null}
        </Stage>
      </DeckNavContext.Provider>

      <nav className="ds-controls" aria-label="슬라이드 넘기기">
        <FirstPageButton index={index} onGo={go} className="ds-controls__btn" testId="ds-first" />
        <button type="button" className="ds-controls__btn" onClick={() => go(index - 1)} disabled={index === 0} aria-label="이전 장">
          <Icon name="prev" size={16} />
        </button>
        <PageJump index={index} total={total} onGo={go} className="ds-controls__page" testId="ds-page" />
        <button type="button" className="ds-controls__btn" onClick={() => go(index + 1)} disabled={index >= total - 1} aria-label="다음 장">
          <Icon name="next" size={16} />
        </button>
        {toc.length ? <TocMenu entries={toc} index={index} max={total} onGo={go} className="ds-controls__btn" testId="ds-toc" /> : null}
        <button type="button" className="ds-controls__btn" onClick={() => void toggleFullscreen()} aria-label="전체 화면">
          <Icon name="expand" size={16} />
        </button>
        <button type="button" className="ds-controls__btn" onClick={() => setShareOpen((value) => !value)} aria-label="링크 공유" aria-expanded={shareOpen}>
          <Icon name="link" size={16} />
        </button>
        {client && !presenting && !live ? (
          <button type="button" className="ds-controls__btn ds-controls__text" onClick={startPresenting}>
            발표 시작
          </button>
        ) : null}
        {live ? (
          <button
            type="button"
            className={`ds-controls__btn ds-controls__text${presenting || following ? " is-on" : ""}`}
            onClick={() => (presenting ? undefined : setFollowing((value) => !value))}
            aria-pressed={presenting || following}
          >
            {presenting ? "발표 중 · 학생이 따라와요" : following ? "발표자 따라가는 중" : "혼자 넘겨 보는 중"}
          </button>
        ) : null}
        {live && presenting ? (
          <button
            type="button"
            className="ds-controls__btn ds-controls__text"
            onClick={() => {
              if (window.confirm("수업을 끝내고 이 방의 학생 응답·게시물을 지울까요? 결과가 필요하면 먼저 [결과 내려받기] 를 눌러 주세요.")) {
                void live.clearRoom(liveRoom());
                setPresenting(false);
              }
            }}
          >
            수업 끝내기
          </button>
        ) : null}
        {hasResultSlides(deck) && (!client || (live && presenting)) ? (
          <button type="button" className="ds-controls__btn" onClick={() => void exportAll()} disabled={exporting} aria-label="모든 결과 내려받기" title={exporting ? "결과 모으는 중" : "모든 결과 내려받기"} aria-busy={exporting} data-test="ds-export-all">
            <Icon name="download" size={15} />
          </button>
        ) : null}
        {editTarget ? (
          <button type="button" className={`ds-controls__btn ds-controls__text${editing ? " is-on" : ""}`} onClick={() => setEditing((value) => !value)} aria-pressed={editing} data-test="ds-edit">
            <Icon name="edit" size={15} /> {editing ? (saveState === "saving" ? "저장 중" : saveState === "error" ? "저장 실패" : "편집 끝내기") : "편집"}
          </button>
        ) : null}
      </nav>
      {exportNotice ? <p className="ds-export-notice" role="status">{exportNotice}</p> : null}

      {shareOpen ? (
        <div className="ds-share" role="dialog" aria-label="링크 공유">
          <QrCode value={shareUrl} size={180} label="이 슬라이드 주소 QR 코드" />
          <div className="ds-share__copy">
            <strong>이 슬라이드 주소</strong>
            <span>{shareUrl}</span>
            <button type="button" onClick={() => void navigator.clipboard?.writeText(shareUrl)}>
              <Icon name="copy" size={14} /> 주소 복사
            </button>
          </div>
          <button type="button" className="ds-share__close" onClick={() => setShareOpen(false)} aria-label="닫기">
            <Icon name="close" size={16} />
          </button>
        </div>
      ) : null}
    </div>
    </LocalResultsContext.Provider>
  );
}
