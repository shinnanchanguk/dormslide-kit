import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/runtime/Icon";
import { assetUrl, strictPublicWebUrl } from "@/lib/safe-url";
import type { Block } from "@/lib/deck-content";
import { Copy, E, QrResource, cellAt, delay, imageSrc, linkText, table, useEditing, type Props } from "./chroma-kit";
import { useFullscreenHost } from "@/runtime/useFullscreenHost";

/**
 * 크로마 무대의 구획 배치. 챕터가 바뀌는 자리, 살핌 소개처럼 한 장에 여러 증거를 엮는 자리,
 * "무엇이 있었고 무엇이 없었나"처럼 흐름을 도식으로 보여 주는 자리에 쓴다.
 * 모든 배치는 표(tables)의 칸만 읽고, 번호는 1·2·3 으로 붙인다(01·02 쓰지 않음).
 */

/** 챕터 번호. 머리말(CHAPTER 2 · 만든 이유)의 숫자를 쓰고, 숫자가 없으면(끝 · 제 답) 첫 낱말을 쓴다. */
function chapterMark(eyebrow: string): { mark: string; current: number | null } {
  const digit = eyebrow.match(/\d+/)?.[0];
  if (digit) return { mark: String(Number(digit)), current: Number(digit) - 1 };
  return { mark: eyebrow.split(/[\s·]/)[0] || eyebrow, current: null };
}

/**
 * 챕터 표지. 무대를 어두운 판 하나로 덮고, 큰 번호·챕터 이름·한 줄 소개·전체 흐름을 보여 준다.
 * 제목은 SlidePage 가 그린 것을 CSS 로 숨기고 판 안에 다시 크게 놓는다.
 */
export function ChapterDivider({ payload, renderBlocks }: Props) {
  const blocks = payload.columns[0] ?? [];
  const agenda = payload.agenda ?? [];
  const { mark, current } = chapterMark(payload.eyebrow);
  const allDone = current === null;
  return (
    <div className="ch-divider">
      <section className="ch-divider__panel">
        <span className="ch-divider__mark" aria-hidden="true">
          {mark}
        </span>
        <div className="ch-divider__copy">
          <span className="ch-divider__kicker"><E v={payload.eyebrow} at={{ kind: "field", f: "eyebrow" }} label="머리말 편집" /></span>
          <p className="ch-divider__title"><E v={payload.title} at={{ kind: "field", f: "title" }} label="제목 편집" /></p>
          <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-divider__lead" />
        </div>
        {agenda.length ? (
          <ol className="ch-divider__track" aria-label="전체 흐름">
            {agenda.map((label, index) => (
              <li
                key={label}
                data-state={allDone || index < (current ?? 0) ? "done" : index === current ? "now" : "next"}
                style={delay(index, 0.12, 0.45)}
              >
                <span>{index + 1}</span>
                <E v={label} at={{ kind: "agenda", i: index }} />
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    </div>
  );
}

/** 영상은 이 레포 public/ 아래 mp4 만 받는다(/slides/…, /samples/…, /assets/…). */
function videoSrc(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^\/(?:samples|slides|assets)\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)*\.mp4$/.test(trimmed) || trimmed.includes("..")) return null;
  return assetUrl(trimmed);
}

/**
 * 시연 영상 카드. 무대 안에서는 소리 없이 되풀이해 돌고, 누르면 화면 전체에 크게 연다.
 * 무대는 transform 으로 줄어 있어서 큰 화면은 body(전체 화면이면 그 전체 화면 요소)로 옮겨(portal) 그린다.
 */
/** 큰 화면이 열려 있는 동안 발표 넘기기(리모컨) 키가 뒤의 장을 넘기지 않게 막는다. */
const PAGING_KEYS = new Set(["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "Enter", "Home", "End"]);

function DemoVideo({ src, poster, caption }: { src: string; poster: string | null; caption: string }) {
  const [open, setOpen] = useState(false);
  // 전체 화면에서는 전체 화면 요소 안쪽만 보이므로 창도 그 안에 그린다.
  const host = useFullscreenHost(open);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  // 창은 그릴 자리(host)를 고른 다음 그려지므로, 자리가 정해진 뒤에 닫기 단추로 초점을 옮긴다.
  useEffect(() => {
    if (open && host) closeRef.current?.focus();
  }, [open, host]);
  useEffect(() => {
    if (!open) return;
    const opener = openerRef.current;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        return;
      }
      // 닫기 단추에서 누르는 Enter·Space 는 단추 자신이 받게 둔다.
      if (PAGING_KEYS.has(event.key) && !(event.target instanceof HTMLButtonElement && (event.key === "Enter" || event.key === " "))) {
        event.stopPropagation();
        if (event.key === " " || event.key.startsWith("Page")) event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      opener?.focus({ preventScroll: true });
    };
  }, [open]);
  return (
    <>
      <button ref={openerRef} type="button" className="ch-demo" onClick={() => setOpen(true)} aria-label={`${caption} 크게 보기`}>
        <span className="ch-demo__frame">
          <video src={src} poster={poster ?? undefined} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element -- 인쇄·PDF 에서 영상 대신 남는 첫 장면이다.
            <img className="ch-demo__poster" src={poster} alt="" />
          ) : null}
          <span className="ch-demo__zoom" aria-hidden="true">
            <Icon name="expand" size={16} />
            크게 보기
          </span>
        </span>
        <span className="ch-demo__caption">
          <Icon name="play" size={13} />
          {caption}
        </span>
      </button>
      {open && host
        ? createPortal(
            <div className="ch-lightbox" role="dialog" aria-modal="true" aria-label={caption} onClick={() => setOpen(false)}>
              <div className="ch-lightbox__body" onClick={(event) => event.stopPropagation()}>
                <video src={src} poster={poster ?? undefined} autoPlay muted loop playsInline controls />
                <div className="ch-lightbox__bar">
                  <span>{caption}</span>
                  <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="크게 보기 닫기">
                    <Icon name="close" size={16} />
                    돌아가기
                  </button>
                </div>
              </div>
            </div>,
            host,
          )
        : null}
    </>
  );
}

/**
 * 제품 소개. 첫째 표 [단계, 설명]은 쓰는 흐름, 둘째 표 [이름, 값, 단위]는 실시간 숫자,
 * 셋째 표 첫 줄 [영상, 첫 장면, 설명]은 시연 영상이다. QR 은 흐름 아래에 둔다.
 */
export function ProductShowcase({ payload, renderBlocks, renderResource }: Props) {
  const steps = table(payload)?.rows ?? [];
  const stats = table(payload, 1);
  const demo = table(payload, 2)?.rows[0];
  const blocks = payload.columns[0] ?? [];
  const src = videoSrc(demo?.[0]);
  const poster = imageSrc(demo?.[1]);
  return (
    <div className="ch-product">
      <div className="ch-product__main">
        <ol className="ch-product__steps">
          {steps.map((row, index) => (
            <li key={`${row[0]}:${index}`} style={delay(index, 0.25, 0.15)}>
              <span className="ch-product__no">{index + 1}</span>
              <strong>
                <E v={row[0]} at={cellAt(index, 0)} />
              </strong>
              <span>
                <E v={row[1]} at={cellAt(index, 1)} />
              </span>
            </li>
          ))}
        </ol>
        <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-product__copy" />
        <QrResource payload={payload} renderResource={renderResource} size={92} />
      </div>
      <div className="ch-product__side">
        {src ? <DemoVideo src={src} poster={poster} caption={demo?.[2] ?? "시연 영상"} /> : null}
        {stats ? (
          <section className="ch-product__stats" aria-label={stats.caption ?? "실시간 이용 통계"}>
            {stats.caption ? (
              <span className="ch-product__statsHead">
                <E v={stats.caption} at={{ kind: "caption", t: 1 }} />
              </span>
            ) : null}
            <dl>
              {stats.rows.map((row, index) => (
                <div key={`${row[0]}:${index}`} style={delay(index, 0.12, 0.4)}>
                  <dt>
                    <E v={row[0]} at={cellAt(index, 0, 1)} />
                  </dt>
                  <dd>
                    <span className="ch-count">
                      <E v={row[1]} at={cellAt(index, 1, 1)} />
                    </span>
                    <small>
                      <E v={row[2]} at={cellAt(index, 2, 1)} />
                    </small>
                  </dd>
                  <i className="ch-product__bar" aria-hidden="true" />
                </div>
              ))}
            </dl>
          </section>
        ) : null}
      </div>
    </div>
  );
}

/**
 * 있었던 것과 없던 것. 행은 [단계 이름, 제목, 설명, 낱말들(/ 로 나눔), 상태(have|empty|made)].
 * have 는 여러 칩을 모은 판, empty 는 비어 있는 점선 판, made 는 채워진 어두운 판이다.
 */
export function NeedFlow({ payload, renderBlocks }: Props) {
  const rows = table(payload)?.rows ?? [];
  const blocks = payload.columns[0] ?? [];
  return (
    <div className="ch-need">
      <ol className="ch-need__row" data-count={rows.length}>
        {rows.map((row, index) => {
          const state = row[4] === "empty" || row[4] === "made" ? row[4] : "have";
          const chips = (row[3] ?? "").split(" / ").map((chip) => chip.trim()).filter(Boolean);
          return (
            <li key={`${row[0]}:${index}`} className={`ch-need__stage ch-need__stage--${state}`} style={delay(index, 0.35, 0.15)}>
              <span className="ch-need__step">
                <E v={row[0]} at={cellAt(index, 0)} />
              </span>
              <div className="ch-need__box">
                {state === "made" ? <Icon name="emblem" size={40} /> : null}
                <strong>
                  <E v={row[1]} at={cellAt(index, 1)} />
                </strong>
                {chips.length ? (
                  <ul className="ch-need__chips">
                    {chips.map((chip, chipIndex) => (
                      <li key={chip} style={delay(chipIndex, 0.12, 0.35 + index * 0.35)}>
                        {chip}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {row[2] ? (
                  <span className="ch-need__more">
                    <E v={row[2]} at={cellAt(index, 2)} />
                  </span>
                ) : null}
              </div>
              {index < rows.length - 1 ? (
                <span className="ch-need__arrow" aria-hidden="true">
                  <svg viewBox="0 0 48 24">
                    <path d="M3 12h38M33 5l8 7-8 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-need__copy" />
    </div>
  );
}

/**
 * 판단의 뿌리가 만든 결정. 행은 [뿌리, 뿌리 설명, 결정, 결정 설명].
 * 왼쪽 뿌리 카드와 오른쪽 결정 카드를 줄마다 이어, 무엇이 어떤 선택을 낳았는지 보여 준다.
 */
export function ReasonMap({ payload, renderBlocks }: Props) {
  const data = table(payload);
  const rows = data?.rows ?? [];
  const blocks = payload.columns[0] ?? [];
  return (
    <div className="ch-reasons">
      {data ? (
        <div className="ch-reasons__heads" aria-hidden="true">
          <span>
            <E v={data.head[0]} at={{ kind: "head", t: 0, c: 0 }} />
          </span>
          <span>
            <E v={data.head[2]} at={{ kind: "head", t: 0, c: 2 }} />
          </span>
        </div>
      ) : null}
      <ol className="ch-reasons__rows">
        {rows.map((row, index) => (
          <li key={`${row[0]}:${index}`} className="ch-reasons__row" style={delay(index, 0.4, 0.15)}>
            <div className="ch-reasons__root">
              <span className="ch-reasons__no">{index + 1}</span>
              <strong>
                <E v={row[0]} at={cellAt(index, 0)} />
              </strong>
              <span>
                <E v={row[1]} at={cellAt(index, 1)} />
              </span>
            </div>
            <span className="ch-reasons__link" aria-hidden="true">
              <svg viewBox="0 0 64 24" preserveAspectRatio="none">
                <path d="M2 12h54M48 4l9 8-9 8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </svg>
            </span>
            <div className="ch-reasons__choice">
              <strong>
                <E v={row[2]} at={cellAt(index, 2)} />
              </strong>
              <span>
                <E v={row[3]} at={cellAt(index, 3)} />
              </span>
            </div>
          </li>
        ))}
      </ol>
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-reasons__copy" />
    </div>
  );
}

/**
 * 카드 아래에 붙는 원문(공지·글) 버튼. 공개 HTTPS 주소만 받는다.
 * 무대가 작게 줄어드는 휴대폰 글 화면에서도 누르기 쉽도록 카드 전체가 이 링크의 누름 자리다(CSS ::after).
 * 편집 중에는 누르면 이동하지 않도록 링크 대신 같은 모양의 글자로 그려 버튼 이름을 고칠 수 있게 한다.
 */
function GuardLink({ url, label, index }: { url: string | undefined; label: string | undefined; index: number }) {
  const editing = useEditing();
  const safe = url ? strictPublicWebUrl(url) : null;
  if (!safe) return null;
  const name = label?.trim() || "자세히 보기";
  if (editing) {
    // 편집 중에는 이동하지 않는다. 어디로 가는 버튼인지는 마우스를 올리면 보인다.
    return (
      <span className="ch-guard__link" title={safe}>
        {label ? <E v={label} at={cellAt(index, 5)} label="버튼 이름 편집" /> : name}
        <Icon name="open" />
      </span>
    );
  }
  return (
    <a className="ch-guard__link" href={safe} target="_blank" rel="noreferrer noopener" aria-label={`${name} 새 창에서 열기`}>
      {name}
      <Icon name="open" />
    </a>
  );
}

/**
 * 장벽을 대신 치우는 장치. 행은 [현실의 장벽, 도름스가 하는 일, 설명, 숫자, 원문 주소?, 버튼 이름?].
 * 번호가 붙은 네 단계로, 위에는 걸림돌, 아래에는 도름스가 대신 해 주는 일과 실제 숫자를 둔다.
 * 원문 주소가 있는 카드는 맨 아래에 그 공지·글로 가는 버튼을 단다.
 */
export function GuardSteps({ payload, renderBlocks }: Props) {
  const rows = table(payload)?.rows ?? [];
  const blocks = payload.columns[0] ?? [];
  return (
    <div className="ch-guard">
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-guard__copy" />
      <ol className="ch-guard__steps" data-count={rows.length}>
        {rows.map((row, index) => (
          <li key={`${row[1]}:${index}`} className="ch-guard__step" style={delay(index, 0.25, 0.15)}>
            <span className="ch-guard__wall">
              <E v={row[0]} at={cellAt(index, 0)} />
            </span>
            <span className="ch-guard__down" aria-hidden="true">
              <svg viewBox="0 0 16 22">
                <path d="M8 2v15M3 12l5 6 5-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div className={`ch-guard__card${strictPublicWebUrl(row[4] ?? "") ? " ch-guard__card--link" : ""}`}>
              <span className="ch-guard__no">{index + 1}</span>
              <strong>
                <E v={row[1]} at={cellAt(index, 1)} />
              </strong>
              <span className="ch-guard__what">
                <E v={row[2]} at={cellAt(index, 2)} />
              </span>
              {row[3] ? (
                <b className="ch-guard__fig">
                  <E v={row[3]} at={cellAt(index, 3)} />
                </b>
              ) : null}
              <GuardLink url={row[4]} label={row[5]} index={index} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** 한 단의 문장을 첫 구분선 앞뒤로 나눈다. 앞은 칩 위, 뒤는 칩 아래에 그린다. 번호는 원본 자리 그대로 둔다. */
function splitAtRule(blocks: Block[]): [number[], number[]] {
  const at = blocks.findIndex((block) => block.b === "rule");
  const every = blocks.map((_, index) => index);
  return at < 0 ? [every, []] : [every.slice(0, at), every.slice(at + 1)];
}

function PurposeCopy({ column, blocks, indexes, renderBlocks, className }: { column: number; blocks: Block[]; indexes: number[]; renderBlocks: Props["renderBlocks"]; className: string }) {
  if (!indexes.length) return null;
  return <div className={className}>{renderBlocks(column, indexes.map((index) => blocks[index]), indexes)}</div>;
}

/** 칩 한 줄. 행은 [이름, dim|main]. t 는 표 번호다. */
function PurposeChips({ rows, t, className, base }: { rows: string[][]; t: number; className: string; base: number }) {
  if (!rows.length) return null;
  return (
    <ul className={className}>
      {rows.map((row, index) => (
        <li key={`${row[0]}:${index}`} className={`ch-purpose__chip ch-purpose__chip--${row[1] === "main" ? "main" : "dim"}`} style={delay(index, 0.14, base)}>
          <E v={row[0]} at={cellAt(index, 0, t)} />
        </li>
      ))}
    </ul>
  );
}

/**
 * 도름스가 있는 이유. 기술 이야기에서 멈추지 않고 방향을 함께 정한다는 것을 한 장에 그린다.
 * 표 0 은 정체성 한 줄 [주어, 아닌 것, 인 것]과 출처(설명), 머리줄의 둘째·셋째 칸이 `아닙니다`·`입니다` 표시다.
 * 표 1 은 기술 칩, 표 2 는 방향을 정할 주체 칩이다(행은 [이름, dim|main]).
 * 1단은 좁고 흐린 `기술` 칸, 2단은 넓고 진한 `방향` 칸이다. 각 단은 구분선(rule) 앞 문장을 칩 위에, 뒤 문장을 칩 아래에 둔다.
 * 공개 주소인 자료마다 출처 옆에 원문 글로 가는 버튼을 단다(새 창, 편집 중에는 이동하지 않음).
 */
export function PurposeStage({ payload, renderBlocks }: Props) {
  const editing = useEditing();
  const identity = table(payload, 0);
  const row = identity?.rows[0];
  const tech = payload.columns[0] ?? [];
  const direction = payload.columns[1] ?? [];
  const [techTop, techRest] = splitAtRule(tech);
  const [directionTop, directionRest] = splitAtRule(direction);
  const links = (payload.resources ?? []).flatMap((resource) => {
    const url = strictPublicWebUrl(resource.url);
    return url ? [{ label: resource.label, url, go: linkText(url) }] : [];
  });
  // 출처와 원문 글 버튼. 정체성 줄이 없어도 자료 링크는 숨기지 않는다.
  const source =
    identity?.caption || links.length ? (
      <p className="ch-purpose__source">
        {identity?.caption ? <E v={identity.caption} at={{ kind: "caption", t: 0 }} /> : null}
        {links.map(({ label, url, go }, index) =>
          editing ? (
            <span key={`${index}:${url}`} className="ch-purpose__link" title={url}>
              {go}
              <Icon name="open" />
            </span>
          ) : (
            <a key={`${index}:${url}`} className="ch-purpose__link" href={url} target="_blank" rel="noreferrer noopener" aria-label={`${label} ${go} (새 창)`}>
              {go}
              <Icon name="open" />
            </a>
          ),
        )}
      </p>
    ) : null;
  return (
    <div className="ch-purpose">
      {identity && row ? (
        <section className="ch-purpose__identity" style={delay(0, 0.1, 0.1)}>
          <p className="ch-purpose__subject">
            <E v={row[0]} at={cellAt(0, 0)} />
          </p>
          <p className="ch-purpose__not">
            <s>
              <E v={row[1]} at={cellAt(0, 1)} />
            </s>
            <span className="ch-purpose__tag">
              <E v={identity.head[1]} at={{ kind: "head", t: 0, c: 1 }} />
            </span>
          </p>
          <svg className="ch-purpose__arrow" viewBox="0 0 48 24" aria-hidden="true">
            <path d="M3 12h38M31 4l9 8-9 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="ch-purpose__is">
            <strong>
              <E v={row[2]} at={cellAt(0, 2)} />
            </strong>
            <span className="ch-purpose__tag ch-purpose__tag--is">
              <E v={identity.head[2]} at={{ kind: "head", t: 0, c: 2 }} />
            </span>
          </p>
          {source}
        </section>
      ) : (
        source
      )}
      <div className="ch-purpose__main">
        <section className="ch-purpose__panel ch-purpose__panel--tech" style={delay(1, 0.1, 0.25)}>
          <PurposeCopy column={0} blocks={tech} indexes={techTop} renderBlocks={renderBlocks} className="ch-purpose__copy" />
          <PurposeChips rows={table(payload, 1)?.rows ?? []} t={1} className="ch-purpose__chips ch-purpose__chips--tech" base={0.45} />
          <PurposeCopy column={0} blocks={tech} indexes={techRest} renderBlocks={renderBlocks} className="ch-purpose__copy" />
        </section>
        <section className="ch-purpose__panel ch-purpose__panel--direction" style={delay(2, 0.1, 0.35)}>
          <PurposeCopy column={1} blocks={direction} indexes={directionTop} renderBlocks={renderBlocks} className="ch-purpose__copy" />
          <PurposeChips rows={table(payload, 2)?.rows ?? []} t={2} className="ch-purpose__chips ch-purpose__chips--actors" base={0.7} />
          <PurposeCopy column={1} blocks={direction} indexes={directionRest} renderBlocks={renderBlocks} className="ch-purpose__copy ch-purpose__copy--after" />
        </section>
      </div>
    </div>
  );
}
