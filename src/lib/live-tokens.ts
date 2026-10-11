/**
 * 원고 칸의 {{live:열쇠|원고 숫자}} 를 다루는 순수 함수들. 발표 화면(클라이언트)과 시험이 함께 쓴다.
 *
 * 세는 숫자는 줄지 않는다. 실시간 값이 0 이거나 원고 숫자의 90%에 못 미치면 바깥 쪽이 고장 난
 * 것으로 보고 원고 숫자를 그대로 둔다.
 */
export const LIVE_TOKEN = /\{\{live:([a-z0-9]+\.[A-Za-z0-9_-]{1,40})\|([^{}|]{0,24})\}\}/g;
const format = new Intl.NumberFormat("ko-KR");

export function hasLiveTokens(value: unknown): boolean {
  return JSON.stringify(value ?? null).includes("{{live:");
}

/** 원고 숫자와 견줘 믿을 만한 실시간 값인지. 원고 숫자가 숫자가 아니면 0 만 거른다. */
function acceptable(value: number, fallback: string): boolean {
  if (value <= 0) return false;
  const base = Number(fallback.replace(/[^0-9.]/g, ""));
  return !Number.isFinite(base) || base <= 0 || value >= base * 0.9;
}

function liveValue(values: Record<string, number>, key: string, fallback: string): number | null {
  if (!Object.hasOwn(values, key)) return null;
  const value = values[key];
  return acceptable(value, fallback) ? value : null;
}

function replaceTokens(text: string, values: Record<string, number>): string {
  return text.replace(LIVE_TOKEN, (_, key: string, fallback: string) => {
    const value = liveValue(values, key, fallback);
    return value === null ? fallback : format.format(value);
  });
}

/** 실시간 칸을 원고 숫자로 되돌린 글. 편집 화면의 그래프처럼 숫자로 읽어야 하는 곳이 쓴다. */
export function manuscriptText(text: string): string {
  return text.includes("{{live:") ? text.replace(LIVE_TOKEN, (_, _key: string, fallback: string) => fallback) : text;
}

/** payload 안의 실시간 칸 가운데 지금 믿을 만한 값이 하나라도 있는지. */
export function usesLiveValue(value: unknown, values: Record<string, number>): boolean {
  const text = JSON.stringify(value ?? null);
  for (const match of text.matchAll(LIVE_TOKEN)) {
    if (liveValue(values, match[1], match[2]) !== null) return true;
  }
  return false;
}

/** payload 안의 모든 글자에서 실시간 칸을 바꾼다. 모양(배열·객체)은 그대로 둔다. */
export function resolveLiveTokens<T>(value: T, values: Record<string, number>): T {
  if (typeof value === "string") return (value.includes("{{live:") ? replaceTokens(value, values) : value) as T;
  if (Array.isArray(value)) return value.map((item) => resolveLiveTokens(item, values)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, resolveLiveTokens(child, values)]),
    ) as T;
  }
  return value;
}
