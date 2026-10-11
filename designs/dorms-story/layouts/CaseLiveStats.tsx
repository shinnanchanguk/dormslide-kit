import type { CSSProperties } from "react";
import type { CaseStatItem } from "@/lib/deck-content";
import type { ReactNode } from "react";

type LiveStatsSource = "dorms" | "salpeem";


const numberFormat = new Intl.NumberFormat("ko-KR");

export function CaseStats({
  items,
  live = false,
  editLabel,
}: {
  items: CaseStatItem[];
  live?: boolean;
  /** 발표자가 [편집]을 켰을 때만 온다. 숫자 칸 이름을 그 자리에서 고친다. */
  editLabel?: (label: string, index: number) => ReactNode;
}) {
  return (
    <div className={`case-live-stats${live ? " case-live-stats--live" : ""}`} aria-label={live ? "실시간 이용 통계" : "이용 통계"}>
      {live ? <div className="case-live-stats__badge"><span aria-hidden="true" />LIVE</div> : null}
      <div
        className="case-live-stats__grid"
        style={{ "--case-stat-columns": items.length } as CSSProperties}
      >
        {items.map((item, index) => (
          <div className="case-live-stats__item" key={`${item.label}:${index}`}>
            <strong>{numberFormat.format(item.value)}<em>{item.suffix}</em></strong>
            <span>{editLabel ? editLabel(item.label, index) : item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 본체는 이 자리에 도름스·살핌 실시간 이용 숫자 세 칸을 서버에서 받아 그렸다.
 * 공개판은 우리 서버에 묻지 않으므로, payload.caseStats 에 적힌 숫자가 있으면 그것을 그리고 없으면 비워 둔다.
 */
export function CaseLiveStats({ items }: { source: LiveStatsSource; items?: CaseStatItem[] }) {
  if (!items?.length) return null;
  return <CaseStats items={items} />;
}
