import { createContext, useContext, useMemo, type RefObject } from "react";
import { resolveLiveTokens } from "@/lib/live-tokens";

export { hasLiveTokens, manuscriptText, resolveLiveTokens, usesLiveValue } from "@/lib/live-tokens";

/**
 * 원고 칸의 {{live:열쇠|원고 숫자}} 를 원고 숫자로 풀어 그린다.
 *
 * 도름슬라이드 본체는 이 자리에서 도름스 통계를 15초마다 물어 실시간 숫자로 바꿨다. 공개판은
 * 우리 서버에 묻지 않으므로 원고에 적힌 숫자를 그대로 보여 준다. 실시간 숫자가 필요하면
 * 내 서버(예: 내 수파베이스)에서 값을 받아 resolveLiveTokens(payload, values) 로 바꾸면 된다.
 */
export function useLivePayload<T>(payload: T, _enabled: boolean, _rootRef: RefObject<HTMLElement | null>) {
  const resolved = useMemo(() => resolveLiveTokens(payload, {}), [payload]);
  return { payload: resolved, live: false, updatedAt: null as string | null };
}

export const LiveStatus = createContext<{ live: boolean; updatedAt: string | null }>({ live: false, updatedAt: null });

export function useLiveStatus() {
  return useContext(LiveStatus);
}

/** 실시간 숫자가 붙을 때만 쓰는 표시. 공개판 기본 상태에서는 그려지지 않는다. */
export function LiveBadge({ updatedAt }: { updatedAt: string | null }) {
  const time = updatedAt
    ? new Date(updatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" })
    : null;
  return (
    <span className="ch-live" role="status" aria-label={time ? `실시간 통계, ${time} 기준` : "실시간 통계"}>
      <i aria-hidden="true" />
      LIVE
      {time ? <small>{time}</small> : null}
    </span>
  );
}
