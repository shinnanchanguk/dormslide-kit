import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BodyResource, BodyTable } from "@/lib/deck-content";
import { strictPublicWebUrl } from "@/lib/safe-url";
import { CaseLiveStats } from "./CaseLiveStats";
import { Icon } from "@/runtime/Icon";
import { Copy, E, EditContext, QrResource, RowHit, cellAt, delay, imageSrc, linkText, linkWord, linked, num, table, useEditing, type Props } from "./chroma-kit";
import { AppGallery, CollabThread, Evidence, FiveElements, MusicCard, RemixChain, TableOfContents } from "./ChromaStories";
import { ChapterDivider, GuardSteps, NeedFlow, ProductShowcase, PurposeStage, ReasonMap } from "./ChromaSections";
import { LiveBadge, LiveStatus, useLivePayload, useLiveStatus } from "./live-counters";


/**
 * 크로마(Chroma) 무대 배치.
 *
 * 따뜻한 종이 바탕·필름 그레인·기하 산세리프·모노 라벨로 된 발표 디자인이다. 모든 배치는
 * 기존 payload 필드(columns·tables·caseStats·media·resources·agenda)만 읽어서, 원고 형식과
 * 게시 경로를 새로 만들지 않는다. 제목과 머리말은 SlidePage 가 그대로 그리고, 여기서는
 * 그 아래 본문만 그린다. 움직임은 전부 CSS(transform·opacity)라서 AutoFit 이 매 프레임
 * 다시 재지 않는다. [PDF 저장] 캡처·인쇄·움직임 줄이기 설정에서는 CSS 가 움직임을 끄고
 * 마지막 모습만 남긴다.
 */

export { CHROMA_LAYOUTS, isChromaLayout, type ChromaLayout } from "./layouts";

const SERIES_COLORS = ["#5692f0", "#f29fc8", "#ed5a14", "#d99d21"];

/**
 * 표지 오른쪽: 선생님들이 실제로 모여 온 추이. 표의 첫 열이 날짜, 나머지 열이 선이다.
 * 선마다 크기가 달라(가입 수천 명, 앱·자료 수백 개) 각자 가장 큰 값에 맞춰 그린다. 숫자는 머리에 적는다.
 */
function GrowthPanel({ data }: { data: BodyTable | undefined }) {
  const uid = useId().replace(/:/g, "");
  const live = useLiveStatus();
  if (!data || data.rows.length < 2) return null;
  const rows = data.rows;
  const series = data.head.slice(1);
  const W = 400;
  const H = 180;
  const last = rows[rows.length - 1];
  return (
    <figure className="ch-growth" aria-label={`${data.caption ?? "추이"}: ${series.map((name, index) => `${name} ${last[index + 1]}`).join(", ")}`}>
      <figcaption className="ch-growth__head">
        <span className="ch-growth__title">
          <E v={data.caption} at={{ kind: "caption", t: 0 }} />
          {live.live ? <LiveBadge updatedAt={live.updatedAt} /> : null}
        </span>
        <ul className="ch-growth__legend">
          {series.map((name, index) => (
            <li key={name}>
              <i style={{ background: SERIES_COLORS[index % SERIES_COLORS.length] }} />
              <E v={name} at={{ kind: "head", t: 0, c: index + 1 }} />
              <b>{Number(num(last[index + 1])).toLocaleString("ko-KR")}</b>
            </li>
          ))}
        </ul>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}-a`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#5692f0" stopOpacity="0.4" />
            <stop offset="1" stopColor="#5692f0" stopOpacity="0" />
          </linearGradient>
        </defs>
        {series.map((name, sIndex) => {
          const values = rows.map((row) => num(row[sIndex + 1]));
          const max = Math.max(1, ...values);
          const points = values.map((value, index) => [(index / (values.length - 1)) * W, H - (value / max) * (H - 14) - 5] as const);
          const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
          return (
            <g key={name}>
              {sIndex === 0 ? <polygon points={`0,${H} ${line} ${W},${H}`} fill={`url(#${uid}-a)`} className="ch-growth__area" /> : null}
              <polyline
                points={line}
                fill="none"
                stroke={SERIES_COLORS[sIndex % SERIES_COLORS.length]}
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                className="ch-growth__line"
                style={delay(sIndex, 0.35, 0.5)}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </svg>
      <div className="ch-growth__axis">
        <span><E v={rows[0][0]} at={cellAt(0, 0)} /></span>
        <span><E v={last[0]} at={cellAt(rows.length - 1, 0)} /></span>
      </div>
    </figure>
  );
}

function Hero({ payload, renderBlocks, renderResource }: Props) {
  const blocks = payload.columns[0] ?? [];
  const agenda = payload.agenda ?? [];
  // 둘째 표 [이름, 값, 단위]가 있으면 그 줄이 숫자 칸이다(실시간 숫자를 쓸 수 있다). 없으면 caseStats.
  const statTable = table(payload, 1);
  const stats = statTable
    ? statTable.rows.map((row, index) => ({ key: `${row[0]}:${index}`, label: <E v={row[0]} at={cellAt(index, 0, 1)} />, value: <E v={row[1]} at={cellAt(index, 1, 1)} />, suffix: row[2] ?? "" }))
    : (payload.caseStats?.items ?? []).map((item, index) => ({
        key: item.label,
        label: <E v={item.label} at={{ kind: "stat", i: index }} />,
        value: item.value.toLocaleString("ko-KR"),
        suffix: item.suffix,
      }));
  return (
    <div className="ch-hero">
      <GrowthPanel data={table(payload)} />
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-hero__copy" />
      {stats.length ? (
        <dl className="ch-hero__stats">
          {stats.map((item, index) => (
            <div className="ch-hero__stat" key={item.key} style={delay(index, 0.1, 0.5)}>
              <dt>{item.label}</dt>
              <dd>
                {item.value}
                <small>{item.suffix}</small>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="ch-hero__foot">
        {agenda.length ? (
          <ol className="ch-hero__agenda" aria-label="강의 흐름">
            {agenda.map((label, index) => (
              <li key={label} style={delay(index, 0.08, 0.7)}>
                <span>{index + 1}</span>
                <E v={label} at={{ kind: "agenda", i: index }} />
              </li>
            ))}
          </ol>
        ) : null}
        <QrResource payload={payload} renderResource={renderResource} size={150} />
      </div>
    </div>
  );
}

function Statement({ payload, renderBlocks }: Props) {
  const blocks = payload.columns[0] ?? [];
  return (
    <div className="ch-statement">
      <span className="ch-statement__bar" aria-hidden="true" />
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-statement__copy" />
    </div>
  );
}

function Chapter({ payload, renderBlocks }: Props) {
  const blocks = payload.columns[0] ?? [];
  const number = payload.eyebrow.match(/\d+/)?.[0] ?? "";
  const agenda = payload.agenda ?? [];
  const current = Number(number) - 1;
  const rows = table(payload)?.rows ?? [];
  return (
    <div className={`ch-chapter${payload.video ? " ch-chapter--music" : ""}`}>
      <div className="ch-chapter__main">
        <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-chapter__copy" />
        {payload.video ? <MusicCard payload={payload} /> : null}
        {rows.length ? (
          <ul className="ch-chapter__cards">
            {rows.map((row, index) => (
              <li className={`ch-chapter__card${index === 0 ? " ch-chapter__card--lead" : ""}`} key={`${row[0]}:${index}`} style={delay(index, 0.25, 0.3)}>
                <b><E v={row[0]} at={cellAt(index, 0)} /></b>
                <span><E v={row[1]} at={cellAt(index, 1)} /></span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {agenda.length ? (
        <ol className="ch-chapter__track" aria-label="전체 흐름">
          {agenda.map((label, index) => (
            <li key={label} data-state={index === current ? "now" : index < current ? "done" : "next"}>
              <span>{index + 1}</span>
              <E v={label} at={{ kind: "agenda", i: index }} />
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function Timeline({ payload, renderBlocks }: Props) {
  // 편집 중에는 줄 덮개 링크를 그리지 않는다. 버튼 모양에 마우스를 올리면 어디로 가는지만 보인다.
  const editing = useEditing();
  const data = table(payload);
  const rows = data?.rows ?? [];
  const blocks = payload.columns[0] ?? [];
  return (
    <div className={`ch-timeline${payload.pet ? " ch-timeline--pet" : ""}`}>
      <ol className="ch-timeline__track" style={{ ["--n" as string]: rows.length }}>
        <span className="ch-timeline__line" aria-hidden="true" />
        {rows.map((row, index) => (
          <li
            className="ch-timeline__node"
            key={`${row[0]}:${index}`}
            style={delay(index, 0.18, 0.2)}
            data-last={index === rows.length - 1 ? "" : undefined}
            data-linked={linked(row[3])}
          >
            <span className="ch-timeline__dot" aria-hidden="true" />
            <span className="ch-timeline__when">
              <E v={row[0]} at={cellAt(index, 0)} />
            </span>
            <strong className="ch-timeline__what"><E v={row[1]} at={cellAt(index, 1)} /></strong>
            {row[2] ? <span className="ch-timeline__more"><E v={row[2]} at={cellAt(index, 2)} /></span> : null}
            {/* 줄 전체가 링크(RowHit)다. 눌러서 무엇이 열리는지 보이도록 칸 아래에 버튼 모양을 둔다. */}
            {linked(row[3]) !== undefined ? (
              <span className="ch-timeline__go" aria-hidden="true" title={editing ? row[3] : undefined}>
                {linkWord(row[3])}
                <Icon name="open" />
              </span>
            ) : null}
            <RowHit url={row[3]} label={`${row[1]} ${linkWord(row[3])} (새 창)`} />
          </li>
        ))}
      </ol>
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-timeline__copy" />
    </div>
  );
}

function Contrast({ payload, renderBlocks }: Props) {
  const left = payload.columns[0] ?? [];
  const right = payload.columns[1] ?? [];
  return (
    <div className="ch-contrast">
      <section className="ch-contrast__panel ch-contrast__panel--light" style={delay(0)}>
        <Copy blocks={left} columnIndex={0} renderBlocks={renderBlocks} />
      </section>
      <div className="ch-contrast__arrow" aria-hidden="true">
        <svg viewBox="0 0 48 48" width="48" height="48">
          <path d="M8 24h30M28 13l11 11-11 11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <section className="ch-contrast__panel ch-contrast__panel--dark" style={delay(1, 0.3)}>
        <Copy blocks={right} columnIndex={1} renderBlocks={renderBlocks} />
      </section>
    </div>
  );
}

function Flow({ payload, renderBlocks, renderResource, media }: Props) {
  const rows = table(payload)?.rows ?? [];
  const blocks = payload.columns[0] ?? [];
  const editing = useEditing();
  return (
    <div className={`ch-flow${media ? " ch-flow--media" : ""}`}>
      <div className="ch-flow__main">
        <ol className="ch-flow__steps">
          {rows.map((row, index) => (
            <li className="ch-flow__step" key={`${row[0]}:${index}`} style={delay(index, 0.35, 0.15)}>
              <span className="ch-flow__no">{index + 1}</span>
              <strong><E v={row[0]} at={cellAt(index, 0)} /></strong>
              {/* " / " 로 나눈 설명은 항목 목록으로 그린다(예전의 장벽 세 가지 등). 편집 중에는 원래 한 칸으로 고친다. */}
              {!editing && (row[1] ?? "").includes(" / ") ? (
                <ul className="ch-flow__list">
                  {row[1].split(" / ").map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <span><E v={row[1]} at={cellAt(index, 1)} /></span>
              )}
              {index < rows.length - 1 ? <i className="ch-flow__link" aria-hidden="true" style={delay(index, 0.35, 0.35)} /> : null}
            </li>
          ))}
        </ol>
        <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-flow__copy" />
        <QrResource payload={payload} renderResource={renderResource} />
      </div>
      {media ? <div className="ch-flow__media">{media}</div> : null}
    </div>
  );
}

/**
 * 채팅창에서 앱 링크가 밀려 올라가며 흐려지는 장면. 메시지가 아래에서 하나씩 올라오고,
 * 먼저 온 메시지일수록 옅어진다. 잘라 내는 상자 없이 마지막 모습이 그대로 남는다.
 */
function Stream({ payload, renderBlocks }: Props) {
  const rows = table(payload)?.rows ?? [];
  const blocks = payload.columns[0] ?? [];
  const total = rows.length;
  // 종류 칸이 q(질문)·a(답)이면 게시글 댓글 흐름이다. 이때는 흐리게 밀어 올리지 않고 질문을 강조한다.
  const thread = rows.some((row) => row[2] === "q" || row[2] === "a");
  return (
    <div className={`ch-stream${thread ? " ch-stream--thread" : ""}`}>
      <div className="ch-stream__phone" aria-label={thread ? "게시글에 달린 댓글 흐름" : "오픈 채팅방에서 대화가 밀려 올라가는 모습"}>
        <div className="ch-stream__head">
          <span className="ch-stream__room"><E v={table(payload)?.caption} at={{ kind: "caption", t: 0 }} /></span>
        </div>
        <ul className="ch-stream__list">
          {rows.map((row, index) => {
            // 오래된 메시지일수록 옅게: 마지막 메시지 1, 첫 메시지 0.28
            const fade = thread ? 1 : total > 1 ? 0.28 + (0.72 * index) / (total - 1) : 1;
            const style = { ["--fade" as string]: fade.toFixed(2), ...delay(index, 0.35, 0.2) };
            return row[2] === "app" ? (
              <li className="ch-stream__msg ch-stream__msg--app" key={index} style={style} data-linked={linked(row[3])}>
                <span className="ch-stream__who"><E v={row[0]} at={cellAt(index, 0)} /></span>
                <span className="ch-stream__app">
                  <b><E v={row[1]} at={cellAt(index, 1)} /></b>
                  <small>앱 링크</small>
                </span>
                <RowHit url={row[3]} label={`${row[0]} 원문 열기`} />
              </li>
            ) : (
              <li className={`ch-stream__msg${row[2] === "q" ? " ch-stream__msg--q" : ""}`} key={index} style={style} data-linked={linked(row[3])}>
                <span className="ch-stream__who">
                  <E v={row[0]} at={cellAt(index, 0)} />
                  {linked(row[3]) !== undefined ? <span className="ch-cue" aria-hidden="true"><Icon name="open" /></span> : null}
                </span>
                <span className="ch-stream__bubble"><E v={row[1]} at={cellAt(index, 1)} /></span>
                <RowHit url={row[3]} label={`${row[0]} 댓글 원문 열기`} />
              </li>
            );
          })}
        </ul>
      </div>
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-stream__copy" />
    </div>
  );
}

/** 흘러가던 앱 카드가 하나씩 떨어져 그릇(격자)에 담기는 장면. */
function Vessel({ payload, renderBlocks }: Props) {
  const rows = table(payload)?.rows ?? [];
  const blocks = payload.columns[0] ?? [];
  return (
    <div className="ch-vessel">
      <div className="ch-vessel__bowl">
        <div className="ch-vessel__grid">
          {rows.map((row, index) => (
            <div className="ch-vessel__card" key={`${row[0]}:${index}`} style={delay(index, 0.09, 0.2)}>
              <b><E v={row[0]} at={cellAt(index, 0)} /></b>
              <span><E v={row[1]} at={cellAt(index, 1)} /></span>
            </div>
          ))}
        </div>
        <div className="ch-vessel__label"><E v={table(payload)?.caption} at={{ kind: "caption", t: 0 }} /></div>
      </div>
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-vessel__copy" />
    </div>
  );
}

/** 이름 분해: 표 제목(caption)이 큰 이름이고, 행은 [조각, 뜻]. 이름의 마지막 글자가 돌며 붙는다. */
function Name({ payload, renderBlocks }: Props) {
  const data = table(payload);
  const rows = data?.rows ?? [];
  const blocks = payload.columns[0] ?? [];
  const word = data?.caption ?? rows.map((row) => row[0]).join("");
  const head = word.slice(0, -1);
  const tail = word.slice(-1);
  const editing = useEditing();
  return (
    <div className="ch-name">
      <div className="ch-name__word" aria-label={word}>
        {editing ? (
          <span className="ch-name__part ch-name__part--0"><E v={data?.caption ?? word} at={{ kind: "caption", t: 0 }} /></span>
        ) : (
          <>
            <span className="ch-name__part ch-name__part--0" style={delay(0, 0, 0.1)}>{head}</span>
            <span className="ch-name__part ch-name__part--2" style={delay(0, 0, 0.9)}>{tail}</span>
          </>
        )}
      </div>
      <ol className="ch-name__legend">
        {rows.map((row, index) => (
          <li key={`${row[0]}:${index}`} style={delay(index, 0.35, 0.35)}>
            <b className={`ch-name__chip ch-name__chip--${index % 3}`}><E v={row[0]} at={cellAt(index, 0)} /></b>
            <span><E v={row[1]} at={cellAt(index, 1)} /></span>
          </li>
        ))}
      </ol>
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-name__copy" />
    </div>
  );
}

/** 학교 한 곳의 두 점이 전국의 많은 점과 이어지는 장면. 점 위치는 결정적으로 만든다. */
function Network({ payload, renderBlocks }: Props) {
  const blocks = payload.columns[0] ?? [];
  const rows = table(payload)?.rows ?? [];
  const uid = useId().replace(/:/g, "");
  const dots = Array.from({ length: 46 }, (_, index) => {
    const angle = index * 2.399963;
    const radius = 8 + Math.sqrt(index / 46) * 40;
    // 서버와 브라우저의 부동소수점 마지막 자리가 달라 수화 경고가 나지 않게 반올림한다.
    return { x: Number((50 + Math.cos(angle) * radius * 1.35).toFixed(2)), y: Number((50 + Math.sin(angle) * radius).toFixed(2)) };
  });
  return (
    <div className="ch-network">
      <div className="ch-network__stage">
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs>
            <radialGradient id={`${uid}-g`}>
              <stop offset="0" stopColor="#ed5a14" stopOpacity="0.55" />
              <stop offset="1" stopColor="#ed5a14" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="16" fill={`url(#${uid}-g)`} className="ch-network__glow" />
          {dots.map((dot, index) => (
            <line key={`l${index}`} x1="50" y1="50" x2={dot.x} y2={dot.y} className="ch-network__edge" style={delay(index, 0.03, 1.1)} />
          ))}
          {dots.map((dot, index) => (
            <circle key={`d${index}`} cx={dot.x} cy={dot.y} r={index % 5 === 0 ? 1.5 : 1} className="ch-network__dot" style={delay(index, 0.03, 0.9)} />
          ))}
          <circle cx="47.6" cy="50" r="2.4" className="ch-network__core" />
          <circle cx="52.4" cy="50" r="2.4" className="ch-network__core ch-network__core--b" />
        </svg>
      </div>
      <div className="ch-network__side">
        {rows.length ? (
          <dl className="ch-network__facts">
            {rows.map((row, index) => (
              <div key={`${row[0]}:${index}`} style={delay(index, 0.25, 0.4)}>
                <dt><E v={row[0]} at={cellAt(index, 0)} /></dt>
                <dd><E v={row[1]} at={cellAt(index, 1)} /></dd>
              </div>
            ))}
          </dl>
        ) : null}
        <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-network__copy" />
      </div>
    </div>
  );
}

/**
 * 17개 시·도를 한 칸씩 놓은 칸 지도. 원을 실제 위치에 겹쳐 놓으면 경기·서울·인천이 서로
 * 가려서, 칸끼리 겹치지 않는 격자에 대략의 위치만 살린다. [열, 행]
 */
const REGION_TILE: Record<string, [number, number]> = {
  인천: [1, 1], 서울: [2, 1], 경기: [3, 1], 강원: [4, 1],
  충남: [1, 2], 세종: [2, 2], 충북: [3, 2], 경북: [4, 2],
  전북: [1, 3], 대전: [2, 3], 대구: [3, 3], 울산: [4, 3],
  광주: [1, 4], 전남: [2, 4], 경남: [3, 4], 부산: [4, 4],
  제주: [1, 5],
};

function RegionMap({ payload, renderBlocks }: Props) {
  const rows = table(payload)?.rows ?? [];
  const blocks = payload.columns[0] ?? [];
  const max = Math.max(1, ...rows.map((row) => num(row[1])));
  const sorted = [...rows].sort((a, b) => num(b[1]) - num(a[1]));
  const editing = useEditing();
  const topIndex = rows.findIndex((row) => num(row[1]) === max);
  // 지역명은 칸 자리를 찾는 열쇠다. 모르는 이름(바로 고치기로 바뀐 이름 등)은 남는 칸에 둔다.
  const free = [[2, 5], [3, 5], [4, 5]] as const;
  let nextFree = 0;
  const tiles = rows.map((row) =>
    Object.hasOwn(REGION_TILE, row[0]) ? REGION_TILE[row[0]] : (free[nextFree++] as [number, number] | undefined),
  );
  return (
    <div className="ch-map">
      <div className="ch-map__stage" role="img" aria-label={rows.map((row) => `${row[0]} ${row[1]}명`).join(", ")}>
        {rows.map((row, index) => {
          const tile = tiles[index];
          if (!tile) return null;
          const share = num(row[1]) / max;
          return (
            <span
              // 흰 글자는 파란 칸이 충분히 진할 때만 쓴다(대비 4.5:1 이상).
              className={`ch-map__tile${index === topIndex ? " ch-map__tile--top" : ""}${share >= 0.7 ? " ch-map__tile--deep" : ""}`}
              key={row[0]}
              style={{
                gridColumn: tile[0],
                gridRow: tile[1],
                ["--v" as string]: (0.12 + Math.sqrt(share) * 0.88).toFixed(3),
                ...delay(index, 0.04, 0.2),
              }}
            >
              <i><E v={row[0]} at={cellAt(index, 0)} /></i>
              <b>{editing ? <E v={row[1]} at={cellAt(index, 1)} /> : Number(num(row[1])).toLocaleString("ko-KR")}</b>
            </span>
          );
        })}
      </div>
      <div className="ch-map__side">
        <ol className="ch-map__rank">
          {sorted.slice(0, 6).map((row, index) => (
            <li key={row[0]} style={delay(index, 0.08, 0.6)}>
              <span><E v={row[0]} at={cellAt(rows.indexOf(row), 0)} /></span>
              <b>{editing ? <E v={row[1]} at={cellAt(rows.indexOf(row), 1)} /> : Number(num(row[1])).toLocaleString("ko-KR")}</b>
            </li>
          ))}
        </ol>
        <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-map__copy" />
      </div>
    </div>
  );
}

/** 어두운 패널 위의 빛나는 선 그래프. 표의 첫 열이 가로축, 나머지 열이 선이다. */
function Chart({ payload, renderBlocks }: Props) {
  const data = table(payload);
  const uid = useId().replace(/:/g, "");
  const live = useLiveStatus();
  const blocks = payload.columns[0] ?? [];
  if (!data) return null;
  const series = data.head.slice(1);
  const rows = data.rows;
  // 선마다 크기가 크게 달라(가입 수천 명, 앱·자료 수백 개) 각자 가장 큰 값에 맞춰 그린다.
  const maxOf = series.map((_, sIndex) => Math.max(1, ...rows.map((row) => num(row[sIndex + 1]))));
  const W = 1000;
  const H = 360;
  const x = (index: number) => (rows.length <= 1 ? 0 : (index / (rows.length - 1)) * W);
  const y = (value: number, sIndex: number) => H - (value / maxOf[sIndex]) * (H - 18) - 6;
  const last = rows[rows.length - 1] ?? [];
  return (
    <div className="ch-chart">
      <section className="ch-chart__panel">
        <header className="ch-chart__head">
          <span className="ch-chart__title"><E v={data.caption} at={{ kind: "caption", t: 0 }} /></span>
          {live.live ? <LiveBadge updatedAt={live.updatedAt} /> : null}
          <ul className="ch-chart__legend">
            {series.map((name, index) => (
              <li key={name}>
                <i style={{ background: SERIES_COLORS[index % SERIES_COLORS.length] }} />
                <E v={name} at={{ kind: "head", t: 0, c: index + 1 }} /> <b>{Number(num(last[index + 1])).toLocaleString("ko-KR")}</b>
              </li>
            ))}
          </ul>
        </header>
        <div className="ch-chart__plot">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label={`${data.caption ?? "추이"} 그래프`} role="img">
            <defs>
              <filter id={`${uid}-glow`} x="-5%" y="-20%" width="110%" height="140%">
                <feGaussianBlur stdDeviation="5" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {[0.25, 0.5, 0.75].map((ratio) => (
              <line key={ratio} x1="0" x2={W} y1={H * ratio} y2={H * ratio} className="ch-chart__grid" />
            ))}
            {series.map((name, sIndex) => {
              const points = rows.map((row, index) => `${x(index).toFixed(1)},${y(num(row[sIndex + 1]), sIndex).toFixed(1)}`).join(" ");
              return (
                <polyline
                  key={name}
                  points={points}
                  fill="none"
                  stroke={SERIES_COLORS[sIndex % SERIES_COLORS.length]}
                  strokeWidth="4"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  filter={`url(#${uid}-glow)`}
                  pathLength={1}
                  className="ch-chart__line"
                  style={delay(sIndex, 0.3, 0.2)}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>
        </div>
        <footer className="ch-chart__axis">
          <span><E v={rows[0]?.[0]} at={cellAt(0, 0)} /></span>
          <span><E v={rows[Math.floor(rows.length / 2)]?.[0]} at={cellAt(Math.floor(rows.length / 2), 0)} /></span>
          <span><E v={last[0]} at={cellAt(rows.length - 1, 0)} /></span>
        </footer>
      </section>
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-chart__copy" />
    </div>
  );
}

/** 큰 숫자 칸. 움직임은 CSS 만 써서 DOM 이 바뀌지 않는다(AutoFit 이 다시 재지 않는다). */
function Numbers({ payload, renderBlocks }: Props) {
  const rows = table(payload)?.rows ?? [];
  const blocks = payload.columns[0] ?? [];
  const editing = useEditing();
  return (
    <div className="ch-numbers">
      <dl className="ch-numbers__grid" data-count={rows.length}>
        {rows.map((row, index) => {
          const raw = num(row[1]);
          // 1.3시간처럼 소수가 뜻을 가지는 값은 한 자리까지 살린다.
          const value = Number.isInteger(raw) ? raw.toLocaleString("ko-KR") : raw.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
          return (
            <div className="ch-numbers__cell" key={`${row[0]}:${index}`} style={delay(index, 0.1, 0.1)}>
              <dt><E v={row[0]} at={cellAt(index, 0)} /></dt>
              <dd>
                <span className="ch-count">{editing ? <E v={row[1]} at={cellAt(index, 1)} /> : value}</span>
                {row[2] ? <small><E v={row[2]} at={cellAt(index, 2)} /></small> : null}
              </dd>
              {row[3] ? <p><E v={row[3]} at={cellAt(index, 3)} /></p> : null}
            </div>
          );
        })}
      </dl>
      {payload.liveStats ? (
        <div className="ch-numbers__live">
          <CaseLiveStats source={payload.liveStats.source} />
        </div>
      ) : null}
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-numbers__copy" />
    </div>
  );
}

/** 실제 게시글 카드 벽. 행은 [제목, 작성자, 날짜, 반응, 발췌, 주소]. */
function Posts({ payload, renderBlocks }: Props) {
  const rows = table(payload)?.rows ?? [];
  const blocks = payload.columns[0] ?? [];
  return (
    <div className="ch-posts">
      <div className="ch-posts__wall" data-count={rows.length}>
        {rows.map((row, index) => {
          const url = strictPublicWebUrl(row[5]);
          const inner = (
            <>
              <span className="ch-posts__meta">
                <E v={row[1]} at={cellAt(index, 1)} /> · <E v={row[2]} at={cellAt(index, 2)} />
              </span>
              <strong className="ch-posts__title"><E v={row[0]} at={cellAt(index, 0)} /></strong>
              {row[4] ? <span className="ch-posts__excerpt">“<E v={row[4]} at={cellAt(index, 4)} />”</span> : null}
              {row[3] ? <span className="ch-posts__stats"><E v={row[3]} at={cellAt(index, 3)} /></span> : null}
            </>
          );
          return url ? (
            <a className="ch-posts__card" key={`${row[0]}:${index}`} href={url} target="_blank" rel="noreferrer noopener" style={delay(index, 0.1, 0.15)}>
              {inner}
            </a>
          ) : (
            <div className="ch-posts__card" key={`${row[0]}:${index}`} style={delay(index, 0.1, 0.15)}>
              {inner}
            </div>
          );
        })}
      </div>
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-posts__copy" />
    </div>
  );
}

function Quote({ payload, renderBlocks, media }: Props) {
  const blocks = payload.columns[0] ?? [];
  return (
    <div className={`ch-quote${media ? " ch-quote--media" : ""}`}>
      <svg className="ch-quote__mark" viewBox="0 0 64 48" width="64" height="48" aria-hidden="true">
        <path d="M4 44V26C4 13 11 5 24 3v8c-7 2-10 6-10 13h10v20H4zm34 0V26c0-13 7-21 20-23v8c-7 2-10 6-10 13h10v20H38z" fill="currentColor" />
      </svg>
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-quote__copy" />
      {media ? <div className="ch-quote__media">{media}</div> : null}
    </div>
  );
}

/**
 * 가로 막대 비교. 행은 [이름, 값, 묶음 이름]. 같은 묶음끼리 모아 그린다.
 * 값이 모두 100 이하면 백분율로 보고 그대로 막대 길이로 쓰고, 100을 넘는 값(조회수 같은 개수)이
 * 있으면 가장 큰 값을 100%로 맞춰 늘인다.
 */
function Bars({ payload, renderBlocks }: Props) {
  const data = table(payload);
  const rows = data?.rows ?? [];
  const blocks = payload.columns[0] ?? [];
  const groups: { name: string; rows: string[][] }[] = [];
  for (const row of rows) {
    const name = row[2] ?? "";
    const found = groups.find((group) => group.name === name);
    if (found) found.rows.push(row);
    else groups.push({ name, rows: [row] });
  }
  const peak = Math.max(0, ...rows.map((row) => num(row[1])));
  const scale = peak > 100 ? 100 / peak : 1;
  // 강조 막대는 가장 큰 값에 준다. 월별처럼 시간순으로 늘어놓은 표에서도 정점이 눈에 띈다.
  const leadRow = rows.findIndex((row) => num(row[1]) === peak);
  // 앱 이름처럼 긴 이름표는 세 줄로 쪼개지지 않게 이름 칸을 가장 긴 이름에 맞춰 넓힌다(최대 15em).
  const longest = Math.max(0, ...rows.map((row) => (row[0] ?? "").length));
  const labelWidth = `${Math.min(15, Math.max(6.2, longest * 0.72)).toFixed(1)}em`;
  let order = 0;
  return (
    <div className="ch-bars" style={{ ["--ch-bars-label" as string]: labelWidth }}>
      <div className="ch-bars__groups">
        {groups.map((group) => (
          <section className="ch-bars__group" key={group.name}>
            {group.name ? <h3 className="ch-bars__name">{group.name}</h3> : null}
            {group.rows.map((row, index) => {
              const value = num(row[1]);
              const lead = row === rows[leadRow];
              const style = { ["--w" as string]: `${Math.min(100, value * scale).toFixed(2)}%`, ...delay(order++, 0.18, 0.2) };
              return (
                <div className={`ch-bars__row${lead ? " ch-bars__row--lead" : ""}`} key={`${row[0]}:${index}`} style={style} data-linked={linked(row[3])}>
                  <span className="ch-bars__label">
                    <E v={row[0]} at={cellAt(rows.indexOf(row), 0)} />
                    {linked(row[3]) !== undefined ? <span className="ch-cue" aria-hidden="true"><Icon name="open" /></span> : null}
                  </span>
                  <span className="ch-bars__track">
                    <i className="ch-bars__fill" />
                  </span>
                  <b className="ch-bars__value"><E v={row[1]} at={cellAt(rows.indexOf(row), 1)} /></b>
                  <RowHit url={row[3]} label={`${row[0]} 도름스에서 열기`} />
                </div>
              );
            })}
          </section>
        ))}
      </div>
      {data?.note ? <p className="ch-source"><E v={data.note} at={{ kind: "note", t: 0 }} /></p> : null}
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-bars__copy" />
    </div>
  );
}

function Pillars({ payload, renderBlocks }: Props) {
  const rows = table(payload)?.rows ?? [];
  const blocks = payload.columns[0] ?? [];
  return (
    <div className="ch-pillars">
      <ol className="ch-pillars__row" data-count={rows.length}>
        {rows.map((row, index) => (
          <li className="ch-pillars__card" key={`${row[0]}:${index}`} style={delay(index, 0.2, 0.15)} data-linked={linked(row[3])}>
            <span className="ch-pillars__no">{index + 1}</span>
            <strong><E v={row[0]} at={cellAt(index, 0)} /></strong>
            <span><E v={row[1]} at={cellAt(index, 1)} /></span>
            {row[2] ? (
              <small>
                <E v={row[2]} at={cellAt(index, 2)} />
                {linked(row[3]) !== undefined ? <span className="ch-cue" aria-hidden="true"><Icon name="open" /></span> : null}
              </small>
            ) : null}
            <RowHit url={row[3]} label={`${row[0]} 원문 열기`} />
          </li>
        ))}
      </ol>
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-pillars__copy" />
    </div>
  );
}

/** 2×2 표. 머리줄 [빈칸, 열1, 열2], 본줄 [행 이름, 칸1, 칸2]. 칸 글자가 * 로 시작하면 강조 칸이다. */
function Matrix({ payload, renderBlocks }: Props) {
  const data = table(payload);
  const blocks = payload.columns[0] ?? [];
  // 둘째 표 [머리, 문장, 모양(light|dark)]는 표 아래에 이어지는 두 맥락(가정 → 결론)이다.
  const notes = table(payload, 1)?.rows ?? [];
  if (!data) return null;
  let order = 0;
  return (
    <div className="ch-matrix">
      <div className="ch-matrix__grid" style={{ ["--cols" as string]: data.head.length - 1 }}>
        <span className="ch-matrix__corner" />
        {data.head.slice(1).map((label, index) => (
          <span className="ch-matrix__colhead" key={label}><E v={label} at={{ kind: "head", t: 0, c: index + 1 }} /></span>
        ))}
        {data.rows.map((row, rowIndex) => (
          <div className="ch-matrix__line" key={row[0]}>
            <span className="ch-matrix__rowhead"><E v={row[0]} at={cellAt(rowIndex, 0)} /></span>
            {row.slice(1).map((cell, index) => {
              const strong = cell.startsWith("*");
              return (
                <span className={`ch-matrix__cell${strong ? " ch-matrix__cell--strong" : ""}`} key={index} style={delay(order++, 0.2, 0.2)}>
                  <E v={strong ? cell.slice(1).trim() : cell} at={cellAt(rowIndex, index + 1)} prefix={strong ? "*" : ""} />
                </span>
              );
            })}
          </div>
        ))}
      </div>
      {notes.length ? (
        <ol className="ch-matrix__notes">
          {notes.map((row, index) => (
            <li key={`${row[0]}:${index}`} className={`ch-matrix__note ch-matrix__note--${row[2] === "dark" ? "dark" : "light"}`} style={delay(index, 0.4, 0.6)}>
              <b>
                <E v={row[0]} at={cellAt(index, 0, 1)} />
              </b>
              <span>
                <E v={row[1]} at={cellAt(index, 1, 1)} />
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-matrix__copy" />
    </div>
  );
}

const SCHOOL_SHAPES = ["circle", "square", "diamond", "tri", "pill", "ring", "cross", "half", "hex", "star"] as const;
const SCHOOL_COLORS = ["#1e5fce", "#235c34", "#ed5a14", "#d99d21", "#f29fc8", "#7a42b8", "#5692f0", "#111111", "#16877a", "#c2263a"];

/**
 * 학교마다 모양이 다르다: 모양 10가지 × 색 10가지를 한 번씩만 쓴다. 칸 (행 a, 열 b)의 모양은 (a + 3b),
 * 색은 (3a + 2b)를 10으로 나눈 나머지다. 이 대응은 겹침이 없어(행렬식 -7, 10과 서로소) 100칸이 모두
 * 다르고, 옆 칸·아래 칸과도 모양과 색이 함께 달라진다. 모양을 돌려 같은 모양이 달라 보이게 하지 않는다.
 */
export function schoolCell(index: number) {
  const row = Math.floor(index / 10);
  const col = index % 10;
  return {
    shape: SCHOOL_SHAPES[(row + 3 * col) % 10],
    color: SCHOOL_COLORS[(3 * row + 2 * col) % 10],
  };
}

function Schools({ payload, renderBlocks }: Props) {
  const blocks = payload.columns[0] ?? [];
  // 표 첫 줄 [칸 번호, 이름표]가 있으면 그 칸 하나를 "제가 푼 문제"로 표시한다(다음 장으로 이어지는 실마리).
  const mark = table(payload)?.rows[0];
  const markIndex = mark ? Math.round(num(mark[0])) : -1;
  return (
    <div className="ch-schools">
      <div className="ch-schools__grid" aria-hidden={markIndex < 0 ? true : undefined}>
        {Array.from({ length: 100 }, (_, index) => {
          const { shape, color } = schoolCell(index);
          const mine = index === markIndex;
          return (
            <span
              className={`ch-schools__cell ch-schools__cell--${shape}${mine ? " ch-schools__cell--mine" : ""}`}
              key={index}
              style={{ ["--c" as string]: color, ...delay(index, 0.012, 0.1) }}
            >
              {mine ? (
                <span className="ch-schools__tag">
                  <E v={mark?.[1]} at={cellAt(0, 1)} />
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-schools__copy" />
    </div>
  );
}

/** 도구가 익숙해지는 과정. 행은 [도구, 처음, 지금]. */
function Lifespan({ payload, renderBlocks }: Props) {
  const data = table(payload);
  const blocks = payload.columns[0] ?? [];
  if (!data) return null;
  return (
    <div className="ch-lifespan">
      <div className="ch-lifespan__head">
        {data.head.map((label, index) => (
          <span key={label}><E v={label} at={{ kind: "head", t: 0, c: index }} /></span>
        ))}
      </div>
      {data.rows.map((row, index) => (
        <div className="ch-lifespan__row" key={`${row[0]}:${index}`} style={delay(index, 0.35, 0.2)}>
          <strong><E v={row[0]} at={cellAt(index, 0)} /></strong>
          <span className="ch-lifespan__then"><E v={row[1]} at={cellAt(index, 1)} /></span>
          <span className="ch-lifespan__arrow" aria-hidden="true" />
          <span className="ch-lifespan__now"><E v={row[2]} at={cellAt(index, 2)} /></span>
        </div>
      ))}
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-lifespan__copy" />
    </div>
  );
}

/**
 * 마무리 판 양옆에서 도는 도름스 엠블럼. 위치는 판의 백분율, 크기는 em 이라 AutoFit 과 함께 줄어든다.
 * 가운데 글과 QR 을 피해 좌우 가장자리에만 두고, 오른쪽 아래는 3D 도름이 자리라 비운다.
 */
const CLOSING_SWIRLS = [
  { x: 2.4, y: 4, size: 2.6, color: "#ED5A14", dur: 22, reverse: false, bob: 0 },
  { x: 9.5, y: 47, size: 1.8, color: "#EAAEAC", dur: 15, reverse: true, bob: 1.2 },
  { x: 2.6, y: 70, size: 2.4, color: "#E0CDBD", dur: 19, reverse: false, bob: 0.6 },
  { x: 90, y: 4, size: 2.3, color: "#6F8BFF", dur: 17, reverse: true, bob: 1.8 },
  { x: 91.5, y: 38, size: 1.5, color: "#F2C14E", dur: 12, reverse: false, bob: 0.3 },
  { x: 86.5, y: 48, size: 1.9, color: "#8A9DB0", dur: 20, reverse: true, bob: 1.5 },
];

function Closing({ payload, renderBlocks, renderResource }: Props) {
  const blocks = payload.columns[0] ?? [];
  return (
    <div className="ch-closing">
      <section className="ch-closing__panel">
        <div className="ch-closing__swirls" aria-hidden="true">
          {CLOSING_SWIRLS.map((swirl, index) => (
            <span
              className="ch-closing__swirl"
              key={index}
              style={{
                left: `${swirl.x}%`,
                top: `${swirl.y}%`,
                color: swirl.color,
                ["--swirl-size" as string]: `${swirl.size}em`,
                ["--swirl-spin" as string]: `${swirl.dur}s`,
                ["--swirl-way" as string]: swirl.reverse ? "reverse" : "normal",
                ["--swirl-bob" as string]: `${swirl.bob}s`,
              }}
            >
              <Icon name="emblem" />
            </span>
          ))}
        </div>
        <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-closing__copy" />
        <QrResource payload={payload} renderResource={renderResource} />
      </section>
    </div>
  );
}

/**
 * 사례 카드 옆 글 카드. QR 로 그리지 않는 자료(도름스에 올린 글 등)를 실제 화면 아래에 크게 둔다.
 * 자료 이름이 머리말, 자료 설명(caption)이 글 제목이다. 편집 중에는 눌러도 이동하지 않게 링크로 그리지 않는다.
 */
function CasePosts({ payload }: Pick<Props, "payload">) {
  const editing = useEditing();
  const posts = (payload.resources ?? [])
    .filter((resource) => resource.qr !== true)
    .map((resource) => ({ resource, url: strictPublicWebUrl(resource.url) }))
    .filter((item): item is { resource: BodyResource; url: string } => item.url !== null);
  if (!posts.length) return null;
  return (
    <ul className="ch-case__posts" aria-label="관련 글">
      {posts.map(({ resource, url }, index) => {
        const inner = (
          <>
            <span className="ch-case__postKicker">{resource.label}</span>
            {resource.caption ? <strong className="ch-case__postTitle">{resource.caption}</strong> : null}
            <span className="ch-case__postGo" aria-hidden="true">
              {linkText(url)}
              <Icon name="open" />
            </span>
          </>
        );
        return (
          <li key={`${index}:${url}`} style={delay(index, 0.12, 0.6)}>
            {editing ? (
              <div className="ch-case__post" title={url}>{inner}</div>
            ) : (
              <a
                className="ch-case__post"
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={`${resource.label}${resource.caption ? `, ${resource.caption}` : ""} ${linkText(url)} (새 창)`}
              >
                {inner}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** 사례 카드: 실제 화면 + 숫자 칸 + 설명. 숫자는 표의 행 [값, 이름, 기준]. 바로 가기 QR 은 엠블럼 옆에 둔다. */
function CaseCard({ payload, renderBlocks, renderResource, media }: Props) {
  const rows = table(payload)?.rows ?? [];
  const blocks = payload.columns[0] ?? [];
  const emblem = imageSrc(payload.gallery?.[0]?.src);
  return (
    <div className="ch-case">
      <div className="ch-case__copyCol">
        <div className="ch-case__brand">
          {emblem ? (
            // eslint-disable-next-line @next/next/no-img-element -- 서비스 엠블럼 원본을 그대로 쓴다.
            <img className="ch-case__emblem" src={emblem} alt={payload.gallery?.[0]?.alt ?? ""} />
          ) : null}
          <QrResource payload={payload} renderResource={renderResource} />
        </div>
        <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-case__copy" />
        {rows.length ? (
          <dl className="ch-case__stats">
            {rows.map((row, index) => (
              <div key={`${row[1]}:${index}`} style={delay(index, 0.12, 0.4)}>
                <dd><E v={row[0]} at={cellAt(index, 0)} /></dd>
                <dt><E v={row[1]} at={cellAt(index, 1)} /></dt>
              </div>
            ))}
          </dl>
        ) : null}
        {table(payload)?.note ? <p className="ch-source"><E v={table(payload)?.note} at={{ kind: "note", t: 0 }} /></p> : null}
        {media ? null : <CasePosts payload={payload} />}
      </div>
      {media ? (
        <div className="ch-case__side">
          <div className="ch-case__media">{media}</div>
          <CasePosts payload={payload} />
        </div>
      ) : null}
    </div>
  );
}

/** 누가 방향을 정해야 하나. 행은 [이름, 상태(dim|main)]. */
function Actors({ payload, renderBlocks }: Props) {
  const rows = table(payload)?.rows ?? [];
  const blocks = payload.columns[0] ?? [];
  return (
    <div className="ch-actors">
      <ul className="ch-actors__row">
        {rows.map((row, index) => (
          <li className={`ch-actors__chip ch-actors__chip--${row[1] === "main" ? "main" : "dim"}`} key={row[0]} style={delay(index, 0.22, 0.2)}>
            <E v={row[0]} at={cellAt(index, 0)} />
          </li>
        ))}
      </ul>
      <Copy blocks={blocks} renderBlocks={renderBlocks} className="ch-actors__copy" />
    </div>
  );
}

/**
 * QR 로 그리지 않는 자료 링크. 크로마 배치에서는 SlidePage 가 자료 목록을 그리지 않으므로
 * 여기서 작은 링크 칩으로 이어 준다(발표 중 클릭, PDF 에서도 링크로 남는다).
 */
/** QR 자리를 따로 그리는 배치. 다른 배치에서는 QR 자료도 링크 칩으로 남겨 조용히 사라지지 않게 한다. */
const QR_LAYOUTS = new Set(["ch-hero", "ch-flow", "ch-closing", "ch-case", "ch-product"]);

/** 칩에 보일 주소. 긴 식별자는 앞 8자, 뒤 조각(?c=…)은 빼고, 그래도 40자가 넘으면 도메인만 남긴다. */
function shortAddress(url: string) {
  const shown = url
    .replace(/^https:\/\//, "")
    .replace(/[?#].*$/, "")
    .replace(/\/$/, "")
    .replace(/([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/, "$1…");
  return shown.length > 40 ? `${shown.split("/")[0]}/…` : shown;
}

/** 자료 링크를 제 자리에 직접 그리는 배치. 아래 칩으로 한 번 더 그리지 않는다. */
const OWN_LINK_LAYOUTS = new Set(["ch-case", "ch-purpose"]);

function LinkChips({ payload }: Pick<Props, "payload">) {
  if (OWN_LINK_LAYOUTS.has(payload.layout ?? "")) return null;
  const hasQrSlot = QR_LAYOUTS.has(payload.layout ?? "");
  const links = (payload.resources ?? [])
    .filter((resource) => !(hasQrSlot && resource.qr === true))
    .map((resource) => ({ resource, url: strictPublicWebUrl(resource.url) }))
    .filter((item): item is { resource: BodyResource; url: string } => item.url !== null);
  if (!links.length) return null;
  return (
    <ul className="ch-links" aria-label="바로 가기">
      {links.map(({ resource, url }, index) => (
        <li key={`${index}:${url}`}>
          <a href={url} target="_blank" rel="noreferrer noopener">
            <b>{resource.label}</b>
            {/* 앱·글 주소의 긴 식별자는 앞 8자만, 댓글 위치(?c=…) 같은 뒤 조각은 빼고 보여 준다. 링크 자체는 전체 주소로 연결된다. */}
            <span>{shortAddress(url)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * 다섯 가지(agenda 순서, 지금은 재미·주인의식·진정성·예쁨·개방성) 가운데 지금 어느 이야기를 하는지 오른쪽 위에
 * 늘 같은 자리로 보여 준다. agenda 가 다섯 칸인 장에서만 그리고, 머리말에 든 요소가 지금 자리다. 색은 자리 순서를 따른다.
 */
function ElementTrack({ payload }: Pick<Props, "payload">) {
  const agenda = payload.agenda ?? [];
  if (agenda.length !== 5 || payload.layout === "ch-hero" || payload.layout === "ch-chapter") return null;
  const current = agenda.findIndex((label) => payload.eyebrow.includes(label));
  return (
    <ol className="ch-track" aria-label="다섯 가지 가운데 지금 이야기">
      {agenda.map((label, index) => (
        <li key={label} data-element={index} data-state={index === current ? "now" : index < current ? "done" : "next"}>
          <span>{index + 1}</span>
          <E v={label} at={{ kind: "agenda", i: index }} />
        </li>
      ))}
    </ol>
  );
}

/** 그래프 머리에 LIVE 를 직접 다는 배치. 오른쪽 위 공통 자리에는 LIVE 를 다시 그리지 않는다. */
const OWN_BADGE = new Set(["ch-hero", "ch-chart"]);

/**
 * 오른쪽 위 공통 자리(LIVE · 다섯 가지 차례). 새 줄을 만들지 않으려고 SlidePage 가 그린 머리말 줄의
 * 오른쪽 빈자리에 옮겨 그린다(portal). 머리말 줄이 없는 배치(챕터 표지 등)에서는 그리지 않는다.
 */
function Corner({ rootRef, payload, live, updatedAt }: { rootRef: React.RefObject<HTMLDivElement | null>; payload: Props["payload"]; live: boolean; updatedAt: string | null }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const track = (payload.agenda ?? []).length === 5 && payload.layout !== "ch-hero" && payload.layout !== "ch-chapter";
  useEffect(() => {
    const row = rootRef.current?.closest(".body-page")?.querySelector<HTMLElement>(":scope > .body-page__eyebrowRow");
    setSlot(row ?? null);
  }, [rootRef]);
  if (!slot || (!live && !track)) return null;
  return createPortal(
    <div className="ch-corner">
      {live ? <LiveBadge updatedAt={updatedAt} /> : null}
      {track ? <ElementTrack payload={payload} /> : null}
    </div>,
    slot,
  );
}

export function ChromaLayouts(original: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  // 원고의 {{live:…}} 칸을 실시간 숫자로 바꾼다. 편집 중에는 원고 그대로 보여 준다.
  const live = useLivePayload(original.payload, !original.editor, rootRef);
  const props = { ...original, payload: live.payload };
  const layout = props.payload.layout;
  // 같은 배치의 장을 넘길 때도 진입 움직임이 다시 돌도록 장마다 다시 그린다.
  const key = `${layout}:${props.payload.title}`;
  const view = (() => {
    switch (layout) {
      case "ch-hero":
        return <Hero {...props} />;
      case "ch-statement":
        return <Statement {...props} />;
      case "ch-chapter":
        return <Chapter {...props} />;
      case "ch-timeline":
        return <Timeline {...props} />;
      case "ch-contrast":
        return <Contrast {...props} />;
      case "ch-flow":
        return <Flow {...props} />;
      case "ch-stream":
        return <Stream {...props} />;
      case "ch-vessel":
        return <Vessel {...props} />;
      case "ch-name":
        return <Name {...props} />;
      case "ch-network":
        return <Network {...props} />;
      case "ch-map":
        return <RegionMap {...props} />;
      case "ch-chart":
        return <Chart {...props} />;
      case "ch-numbers":
        return <Numbers {...props} />;
      case "ch-posts":
        return <Posts {...props} />;
      case "ch-quote":
        return <Quote {...props} />;
      case "ch-bars":
        return <Bars {...props} />;
      case "ch-pillars":
        return <Pillars {...props} />;
      case "ch-matrix":
        return <Matrix {...props} />;
      case "ch-schools":
        return <Schools {...props} />;
      case "ch-lifespan":
        return <Lifespan {...props} />;
      case "ch-closing":
        return <Closing {...props} />;
      case "ch-case":
        return <CaseCard {...props} />;
      case "ch-actors":
        return <Actors {...props} />;
      case "ch-apps":
        return <AppGallery {...props} />;
      case "ch-remix":
        return <RemixChain {...props} />;
      case "ch-collab":
        return <CollabThread {...props} />;
      case "ch-evidence":
        return <Evidence {...props} />;
      case "ch-five":
        return <FiveElements {...props} />;
      case "ch-toc":
        return <TableOfContents {...props} />;
      case "ch-divider":
        return <ChapterDivider {...props} />;
      case "ch-product":
        return <ProductShowcase {...props} />;
      case "ch-need":
        return <NeedFlow {...props} />;
      case "ch-reasons":
        return <ReasonMap {...props} />;
      case "ch-guard":
        return <GuardSteps {...props} />;
      case "ch-purpose":
        return <PurposeStage {...props} />;
      default:
        return null;
    }
  })();
  return (
    <EditContext.Provider value={props.editor}>
      <LiveStatus.Provider value={{ live: live.live, updatedAt: live.updatedAt }}>
      <div ref={rootRef} className={`ch-body ch-body--${layout}`} key={key}>
        <Corner rootRef={rootRef} payload={props.payload} live={live.live && !OWN_BADGE.has(layout ?? "")} updatedAt={live.updatedAt} />
        {view}
        <LinkChips payload={props.payload} />
      </div>
      </LiveStatus.Provider>
    </EditContext.Provider>
  );
}
