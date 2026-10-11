import type { CSSProperties, ReactNode } from "react";
import { Icon } from "@/runtime/Icon";
import { strictPublicWebUrl } from "@/lib/safe-url";
import { parseTocPages } from "@/lib/deck-toc";
import { useDeckNav } from "@/runtime/DeckNav";
import { Copy, E, RowHit, cellAt, imageSrc, linked, table, useEditing, type Props } from "./chroma-kit";

/**
 * 크로마 무대의 사례 배치. 도름스에서 실제로 일어난 일을 실제 화면 그림과 함께 보여 준다.
 *
 * 모든 배치는 표(tables)의 칸만 읽는다. 그림 칸은 앱 안의 경로(/decks/...)만, 주소 칸은 공개
 * HTTPS 주소만 받아서 그 밖의 값은 그리지 않는다. 카드를 누르면 도름스의 그 글·앱으로 간다.
 * 그림 틀의 높이는 em 으로 잡아 AutoFit 이 글자 크기를 줄일 때 그림도 함께 줄어든다.
 */

/** 카드 하나를 링크로 감쌀지 정한다. 편집 중에는 글자를 누를 때 이동하지 않게 InlineEditableText 가 막는다. */
function CardLink({
  url,
  className,
  style,
  children,
  label,
}: {
  url: string | null;
  className: string;
  style?: CSSProperties;
  children: ReactNode;
  label?: string;
}) {
  if (!url) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <a className={className} style={style} href={url} target="_blank" rel="noreferrer noopener" aria-label={label}>
      {children}
    </a>
  );
}

/** 실제 화면 그림. 그림이 없으면(교사 인증 전용 앱 등) 잠긴 자리로 둔다. */
function Shot({ src, alt, locked, className }: { src: string | undefined; alt: string; locked?: string; className: string }) {
  const safe = imageSrc(src);
  if (!safe) {
    return (
      <span className={`${className} ${className}--locked`}>
        <Icon name="lock" size={20} />
        <span>{locked ?? "교사 인증 전용"}</span>
      </span>
    );
  }
  return (
    <span className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element -- 도름스 화면을 표시 크기로 줄여 둔 정적 그림이다. */}
      <img src={safe} alt={alt} loading="lazy" decoding="async" />
    </span>
  );
}

function Reaction({ dorms, comments }: { dorms?: string; comments?: string }) {
  return (
    <span className="ch-react">
      {dorms ? (
        <span className="ch-react__item" aria-label={`도름 ${dorms}`}>
          <Icon name="thumb" size={13} />
          {dorms}
        </span>
      ) : null}
      {comments ? (
        <span className="ch-react__item" aria-label={`댓글 ${comments}`}>
          <Icon name="comment" size={13} />
          {comments}
        </span>
      ) : null}
    </span>
  );
}

/**
 * 선생님들이 올린 앱. 행은 [영역, 앱, 한 줄, 만든 사람, 도름, 댓글, 주소, 그림].
 * 카드가 아니라 실제 화면이 앞에 선다. 영역은 그림 위 작은 표지로만 둔다.
 */
export function AppGallery({ payload, renderBlocks }: Props) {
  const data = table(payload);
  const rows = data?.rows ?? [];
  const blocks = payload.columns[0] ?? [];
  return (
    <div className="ch-apps">
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-apps__copy" />
      <ul className="ch-apps__grid" data-count={rows.length}>
        {rows.map((row, index) => (
          <li key={`${row[1]}:${index}`} className="ch-apps__item">
            <CardLink url={strictPublicWebUrl(row[6])} className="ch-app" label={`${row[1]} 도름스에서 열기`}>
              <span className="ch-app__frame">
                <Shot src={row[7]} alt={`${row[1]} 실제 화면`} className="ch-app__shot" />
                {row[0] ? (
                  <span className="ch-app__area">
                    <E v={row[0]} at={cellAt(index, 0)} />
                  </span>
                ) : null}
              </span>
              <strong className="ch-app__name">
                <E v={row[1]} at={cellAt(index, 1)} />
              </strong>
              {row[2] ? (
                <span className="ch-app__line">
                  <E v={row[2]} at={cellAt(index, 2)} />
                </span>
              ) : null}
              <span className="ch-app__meta">
                <span className="ch-app__maker">
                  <E v={row[3]} at={cellAt(index, 3)} />
                </span>
                <Reaction dorms={row[4]} comments={row[5]} />
              </span>
            </CardLink>
          </li>
        ))}
      </ul>
      {data?.note ? (
        <p className="ch-source">
          <E v={data.note} at={{ kind: "note", t: 0 }} />
        </p>
      ) : null}
    </div>
  );
}

/**
 * 옆그레이드 사슬. 행은 [사슬, 역할, 앱, 날짜, 무슨 일, 주소, 그림, 앞 칸에서 걸린 시간].
 * 같은 사슬끼리 한 줄에 놓고, 칸 사이 화살표 위에 걸린 시간을 적는다.
 */
export function RemixChain({ payload, renderBlocks }: Props) {
  const data = table(payload);
  const rows = data?.rows ?? [];
  const blocks = payload.columns[0] ?? [];
  const chains: { name: string; items: { row: string[]; index: number }[] }[] = [];
  rows.forEach((row, index) => {
    const found = chains.find((chain) => chain.name === row[0]);
    if (found) found.items.push({ row, index });
    else chains.push({ name: row[0], items: [{ row, index }] });
  });
  const roleClass = (role: string) => (role === "원본" ? "origin" : role === "옆그레이드" ? "remix" : "together");
  return (
    <div className="ch-remix">
      <div className="ch-remix__chains">
        {chains.map((chain) => (
          <section className="ch-remix__chain" key={chain.name} data-count={chain.items.length}>
            <h3 className="ch-remix__name">
              <E v={chain.name} at={cellAt(chain.items[0].index, 0)} />
            </h3>
            <ol className="ch-remix__row">
              {chain.items.map(({ row, index }, position) => (
                <li className="ch-remix__step" key={`${row[2]}:${index}`}>
                  {position > 0 ? (
                    <span className="ch-remix__gap" aria-hidden={row[7] ? undefined : true}>
                      {/* 곡선 끝의 접선 방향(약 29도 아래)에 맞춰 화살촉을 그렸다. 비율을 고정해 늘어나도 촉이 어긋나지 않는다. */}
                      <svg viewBox="0 0 64 28" aria-hidden="true">
                        <path d="M5 19Q32 3 57 17" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
                        <path d="M53.3 9.4 57.6 17.3 48.6 17.7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {row[7] ? (
                        <b>
                          <E v={row[7]} at={cellAt(index, 7)} />
                        </b>
                      ) : null}
                    </span>
                  ) : null}
                  <CardLink
                    url={strictPublicWebUrl(row[5])}
                    className={`ch-remix__card ch-remix__card--${roleClass(row[1])}`}
                    label={`${row[2]} 도름스에서 열기`}
                  >
                    <Shot src={row[6]} alt={`${row[2]} 실제 화면`} className="ch-remix__shot" />
                    <span className="ch-remix__role">
                      <span className="ch-remix__chip">
                        <E v={row[1]} at={cellAt(index, 1)} />
                      </span>
                      <em>
                        <E v={row[3]} at={cellAt(index, 3)} />
                      </em>
                    </span>
                    <strong className="ch-remix__title">
                      <E v={row[2]} at={cellAt(index, 2)} />
                    </strong>
                    {row[4] ? (
                      <span className="ch-remix__note">
                        <E v={row[4]} at={cellAt(index, 4)} />
                      </span>
                    ) : null}
                  </CardLink>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      {data?.note ? (
        <p className="ch-source">
          <E v={data.note} at={{ kind: "note", t: 0 }} />
        </p>
      ) : null}
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-remix__copy" />
    </div>
  );
}

/**
 * 요청이 기능이 되기까지. 행은 [앱, 요청 때, 요청 원문, 반영 때, 반영 원문, 걸린 시간, 주소, 그림].
 * 왼쪽 앱 화면, 가운데 다른 선생님의 요청, 오른쪽 만든 선생님의 반영을 한 줄로 잇는다.
 * 두 번째 표가 있으면 같은 순서의 행 [요청 쪽 이름표, 반영 쪽 이름표, 요청 원문 주소, 반영 원문 주소]로
 * 말풍선 이름표를 바꾸고, 말풍선을 누르면 그 댓글·소식으로 가게 한다.
 */
export function CollabThread({ payload, renderBlocks }: Props) {
  const data = table(payload);
  const rows = data?.rows ?? [];
  const extra = payload.tables?.[1]?.rows ?? [];
  const blocks = payload.columns[0] ?? [];
  return (
    <div className="ch-collab">
      <ol className="ch-collab__rows">
        {rows.map((row, index) => (
          <li className="ch-collab__row" key={`${row[0]}:${index}`}>
            <CardLink url={strictPublicWebUrl(row[6])} className="ch-collab__app" label={`${row[0]} 도름스에서 열기`}>
              <Shot src={row[7]} alt={`${row[0]} 실제 화면`} className="ch-collab__shot" />
              <strong>
                <E v={row[0]} at={cellAt(index, 0)} />
              </strong>
            </CardLink>
            <div className="ch-collab__ask" data-linked={linked(extra[index]?.[2])}>
              <span className="ch-collab__when">
                <E v={row[1]} at={cellAt(index, 1)} /> ·{" "}
                {extra[index]?.[0] ? <E v={extra[index][0]} at={cellAt(index, 0, 1)} /> : "다른 선생님의 요청"}
                {linked(extra[index]?.[2]) !== undefined ? <span className="ch-cue" aria-hidden="true"><Icon name="open" /></span> : null}
              </span>
              <p>
                “<E v={row[2]} at={cellAt(index, 2)} />”
              </p>
              <RowHit url={extra[index]?.[2]} label={`${row[0]} 요청 원문 열기`} />
            </div>
            <span className="ch-collab__gap">
              <svg viewBox="0 0 48 12" preserveAspectRatio="none" aria-hidden="true">
                <path d="M1 6h44M39 1l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </svg>
              <b>
                <E v={row[5]} at={cellAt(index, 5)} />
              </b>
            </span>
            <div className="ch-collab__done" data-linked={linked(extra[index]?.[3])}>
              <span className="ch-collab__when">
                <E v={row[3]} at={cellAt(index, 3)} /> ·{" "}
                {extra[index]?.[1] ? <E v={extra[index][1]} at={cellAt(index, 1, 1)} /> : "만든 선생님의 반영"}
                {linked(extra[index]?.[3]) !== undefined ? <span className="ch-cue" aria-hidden="true"><Icon name="open" /></span> : null}
              </span>
              <p>
                “<E v={row[4]} at={cellAt(index, 4)} />”
              </p>
              <RowHit url={extra[index]?.[3]} label={`${row[0]} 반영 원문 열기`} />
            </div>
          </li>
        ))}
      </ol>
      {data?.note ? (
        <p className="ch-source">
          <E v={data.note} at={{ kind: "note", t: 0 }} />
        </p>
      ) : null}
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-collab__copy" />
    </div>
  );
}

/**
 * 다섯 가지 요소 한 장의 증거. 첫째 표 행은 [종류, 제목, 인용, 누가·언제, 반응, 주소, 그림]이고
 * 첫 행이 큰 카드가 된다. 둘째 표 행은 [값, 단위, 설명]인 숫자 칸이다. agenda 는 다섯 요소 이름이며
 * 머리말에 들어 있는 요소가 지금 자리로 표시된다.
 */
export function Evidence({ payload, renderBlocks }: Props) {
  const cases = table(payload)?.rows ?? [];
  const figures = table(payload, 1);
  const blocks = payload.columns[0] ?? [];
  const agenda = payload.agenda ?? [];
  const current = agenda.findIndex((label) => payload.eyebrow.includes(label));
  const [feature, ...rest] = cases;
  const card = (row: string[], index: number, featured: boolean) => (
    <CardLink
      key={`${row[1]}:${index}`}
      url={strictPublicWebUrl(row[5])}
      className={`ch-evi${featured ? " ch-evi--feature" : ""}${row[6] ? "" : " ch-evi--text"}`}
      label={`${row[1]} 도름스에서 열기`}
    >
      {/* 그림이 없는 사례(도름스 밖 대화, 집계 등)는 글만 둔다. */}
      {row[6] ? <Shot src={row[6]} alt={`${row[1]} 화면`} className="ch-evi__shot" /> : null}
      <span className="ch-evi__body">
        <span className="ch-evi__head">
          <span className="ch-evi__kind">
            <E v={row[0]} at={cellAt(index, 0)} />
          </span>
          <span className="ch-evi__who">
            <E v={row[3]} at={cellAt(index, 3)} />
          </span>
        </span>
        <strong className="ch-evi__title">
          <E v={row[1]} at={cellAt(index, 1)} />
        </strong>
        {row[2] ? (
          <span className="ch-evi__quote">
            “<E v={row[2]} at={cellAt(index, 2)} />”
          </span>
        ) : null}
        {row[4] ? (
          <span className="ch-evi__stats">
            <E v={row[4]} at={cellAt(index, 4)} />
          </span>
        ) : null}
      </span>
    </CardLink>
  );
  return (
    <div className="ch-evidence" data-element={current >= 0 ? current : undefined}>
      {/* 다섯 가지 차례 표시는 모든 요소 장이 같은 자리(오른쪽 위)에 그린다(ChromaLayouts 의 ElementTrack). */}
      <div className="ch-evidence__main">
        <div className="ch-evidence__side">
          <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-evidence__copy" />
          {figures ? (
            <dl className="ch-evidence__figures">
              {figures.rows.map((row, index) => (
                <div key={`${row[2]}:${index}`}>
                  <dt>
                    <E v={row[2]} at={cellAt(index, 2, 1)} />
                  </dt>
                  <dd>
                    <E v={row[0]} at={cellAt(index, 0, 1)} />
                    <small>
                      <E v={row[1]} at={cellAt(index, 1, 1)} />
                    </small>
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {figures?.note ? (
            <p className="ch-source">
              <E v={figures.note} at={{ kind: "note", t: 1 }} />
            </p>
          ) : null}
        </div>
        {cases.length >= 6 ? (
          // 여섯 칸이면 큰 칸 없이 세 칸씩 두 줄로 같은 폭에 놓는다.
          <div className="ch-evidence__cases ch-evidence__cases--grid" data-count={cases.length}>
            {cases.map((row, index) => card(row, index, false))}
          </div>
        ) : (
          <div className="ch-evidence__cases" data-count={cases.length}>
            {feature ? card(feature, 0, true) : null}
            {rest.length ? <div className="ch-evidence__small">{rest.map((row, index) => card(row, index + 1, false))}</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 다섯 가지 한눈에. 행은 [요소, 보통 먼저 챙기는 것, 도름스가 먼저 챙긴 것, 증거 한 줄].
 * 자리마다 정해진 색이 뒤따르는 증거 장에서도 같은 자리에 쓰인다.
 */
export function FiveElements({ payload, renderBlocks }: Props) {
  const rows = table(payload)?.rows ?? [];
  const blocks = payload.columns[0] ?? [];
  // 머리말에 요소 이름이 들어 있으면 그 요소를 여는 구분 장이다. 그 칸만 크게 펼치고 나머지는 이름만 남긴다.
  const focus = rows.findIndex((row) => row[0] && payload.eyebrow.includes(row[0]));
  // 다섯 칸이 같은 줄 높이를 나눠 쓰게 한다(subgrid). 한 칸의 회색 줄이 두 줄이 되어도
  // 옆 칸의 굵은 줄·증거 줄 시작 높이가 같이 내려간다.
  const hasUsual = rows.some((row) => row[1]);
  const hasProof = rows.some((row) => row[3]);
  const tracks = ["auto", hasUsual ? "auto" : "", "1fr", hasProof ? "auto" : ""].filter(Boolean);
  return (
    <div className={`ch-five${focus >= 0 ? " ch-five--focus" : ""}`} data-focus={focus >= 0 ? focus : undefined}>
      <ol
        className="ch-five__cols"
        data-count={rows.length}
        style={{ gridTemplateRows: tracks.join(" "), ["--five-rows" as string]: tracks.length }}
      >
        {rows.map((row, index) => (
          <li
            className="ch-five__col"
            key={`${row[0]}:${index}`}
            data-element={index}
            data-state={focus < 0 ? undefined : index === focus ? "now" : index < focus ? "done" : "next"}
          >
            {focus >= 0 ? (
              <span className="ch-five__index" aria-hidden="true">
                {index + 1}
              </span>
            ) : null}
            <strong className="ch-five__word">
              <E v={row[0]} at={cellAt(index, 0)} />
            </strong>
            {hasUsual ? (
              <span className="ch-five__usual">{row[1] ? <E v={row[1]} at={cellAt(index, 1)} /> : null}</span>
            ) : null}
            <span className="ch-five__ours">
              <E v={row[2]} at={cellAt(index, 2)} />
            </span>
            {hasProof ? (
              <span className="ch-five__proof">{row[3] ? <E v={row[3]} at={cellAt(index, 3)} /> : null}</span>
            ) : null}
          </li>
        ))}
      </ol>
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-five__copy" />
    </div>
  );
}

/**
 * 목차 장. 줄마다 [차례, 장, 무엇을, 쪽]. 보기 화면에서는 줄을 누르면 그 장의 첫 쪽으로 넘어간다
 * (쪽 칸을 읽을 수 있고, 지금 넘어갈 수 있는 쪽일 때). 보기 화면에서 갈 수 없는 줄은 누를 수 없는 글자 줄이지만
 * 칸 배치는 단추 줄과 같아 표가 삐뚤어지지 않는다. 편집 중·PDF·인쇄에서는 원래 글자 줄로만 남는다.
 */
export function TableOfContents({ payload, renderBlocks }: Props) {
  const data = table(payload);
  const rows = data?.rows ?? [];
  const blocks = payload.columns[0] ?? [];
  const nav = useDeckNav();
  const editing = useEditing();
  return (
    <div className="ch-toc">
      <ol className="ch-toc__list">
        {rows.map((row, index) => {
          const cells = (
            <>
              <span className="ch-toc__no">
                <E v={row[0]} at={cellAt(index, 0)} />
              </span>
              <strong className="ch-toc__title">
                <E v={row[1]} at={cellAt(index, 1)} />
              </strong>
              <span className="ch-toc__what">
                <E v={row[2]} at={cellAt(index, 2)} />
              </span>
              <span className="ch-toc__pages">
                <E v={row[3]} at={cellAt(index, 3)} />
              </span>
            </>
          );
          if (!nav || editing) {
            return (
              <li className="ch-toc__row" key={`${row[0]}:${index}`}>
                {cells}
              </li>
            );
          }
          const pages = parseTocPages(row[3]);
          // 지금 갈 수 없는 줄(발표자가 아직 열지 않은 장, 쪽을 못 읽는 줄, 덱 밖 쪽)은 흐리게 하지 않고
          // 글자 그대로 두되, 넘김 표시 자리를 비워 둔 채 단추 줄과 같은 칸에 놓는다.
          if (!pages || pages[0] > nav.max) {
            return (
              <li className="ch-toc__item" key={`${row[0]}:${index}`}>
                <div className="ch-toc__row ch-toc__row--go ch-toc__row--off">
                  {cells}
                  <span className="ch-toc__go ch-toc__go--off" aria-hidden="true" />
                </div>
              </li>
            );
          }
          return (
            <li className="ch-toc__item" key={`${row[0]}:${index}`}>
              <button
                type="button"
                className="ch-toc__row ch-toc__row--go"
                data-test="toc-row"
                aria-label={`${[row[0], row[1], row[2], row[3]].map((cell) => (cell ?? "").trim()).filter(Boolean).join(" ")}, ${pages[0]}쪽으로 이동`}
                onClick={() => nav.go(pages[0] - 1)}
              >
                {cells}
                <span className="ch-toc__go" aria-hidden="true">
                  <Icon name="next" />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-toc__copy" />
    </div>
  );
}

function youtubeId(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const id = url.hostname === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v");
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * 음원 플랫폼 플레이어. payload.video 의 곡을 개인정보 보호 모드 YouTube 플레이어로 싣는다(YouTube
 * Music 과 같은 곡). 표 두 번째(tables[1]) 첫 행 [곡, 부른 사람, 앨범, 플랫폼]이 설명 줄이고, 인쇄·PDF
 * 에서는 플레이어 대신 media 의 앨범 그림이 남는다.
 */
export function MusicCard({ payload }: Pick<Props, "payload">) {
  const id = youtubeId(payload.video?.url);
  const info = table(payload, 1)?.rows[0];
  const cover = imageSrc(payload.media?.src);
  const editing = useEditing();
  if (!id) return null;
  return (
    <figure className="ch-music">
      <div className="ch-music__frame">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- 인쇄할 때 플레이어 대신 남는 앨범 그림이다.
          <img className="ch-music__poster" src={cover} alt={payload.media?.alt ?? ""} />
        ) : null}
        {/* 편집 중에는 플레이어가 눌림을 가져가지 않게 막아, 옆 글자를 편하게 고치게 한다. */}
        <iframe
          className="ch-music__player"
          src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`}
          title={info ? `${info[1]} - ${info[0]}` : "음원 플레이어"}
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          style={editing ? { pointerEvents: "none" } : undefined}
        />
      </div>
      {info ? (
        <figcaption className="ch-music__caption">
          <Icon name="music" size={16} />
          <span className="ch-music__song">
            <b>
              <E v={info[1]} at={cellAt(0, 1, 1)} />
            </b>
            <span>
              <E v={info[0]} at={cellAt(0, 0, 1)} />
            </span>
          </span>
          <span className="ch-music__album">
            <E v={info[2]} at={cellAt(0, 2, 1)} />
            {info[3] ? (
              <>
                {" · "}
                <E v={info[3]} at={cellAt(0, 3, 1)} />
              </>
            ) : null}
          </span>
        </figcaption>
      ) : null}
    </figure>
  );
}
