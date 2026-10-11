/**
 * 덱의 목차. 목차 장(배치 ch-toc)의 첫 표에서 줄마다 [차례, 장, 무엇을, 쪽]을 읽는다.
 * 쪽 칸은 `7~19`처럼 시작~끝 또는 `7` 한 쪽이다. 쪽을 읽을 수 없는 줄은 목차에서 빠진다.
 * 목차 장이 없거나 읽을 줄이 하나도 없으면 null 이라, 보기 화면은 목차 버튼을 그리지 않는다.
 */
export type DeckTocEntry = {
  /** 차례 표시(시작·1·2·끝 등). */
  mark: string;
  title: string;
  what: string;
  /** 1부터 센 첫 쪽과 끝 쪽. 끝 쪽은 다음 장 시작 전까지이고 덱 장 수를 넘지 않는다. */
  from: number;
  to: number;
};

// 앞뒤 공백을 먼저 걷고 짧은 글자만 읽는다. 공백 묶음이 서로 겹치지 않게 짜서 긴 입력에도 한 번에 끝난다.
const PAGES = /^(\d{1,4})(?:\s*쪽)?(?:\s*[~\-–～〜]\s*(\d{1,4})(?:\s*쪽)?)?$/;

/** 쪽 칸 글자를 [시작, 끝]으로 읽는다. 읽을 수 없으면 null. */
export function parseTocPages(raw: string | undefined): [number, number] | null {
  const text = (raw ?? "").trim();
  if (text.length > 24) return null;
  const match = PAGES.exec(text);
  if (!match) return null;
  const from = Number(match[1]);
  const to = match[2] ? Number(match[2]) : from;
  return from >= 1 && to >= from ? [from, to] : null;
}

export function deckToc(slides: readonly { kind: string; payload: unknown }[]): DeckTocEntry[] | null {
  const toc = slides.find((slide) => slide.kind === "BODY" && (slide.payload as { layout?: unknown } | null)?.layout === "ch-toc");
  const rows = (toc?.payload as { tables?: { rows?: unknown }[] } | undefined)?.tables?.[0]?.rows;
  if (!Array.isArray(rows)) return null;
  const entries: DeckTocEntry[] = [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const cells = row.map((cell) => (typeof cell === "string" ? cell : ""));
    const pages = parseTocPages(cells[3]);
    if (!pages || pages[0] > slides.length) continue;
    entries.push({ mark: cells[0].trim(), title: cells[1].trim(), what: cells[2].trim(), from: pages[0], to: Math.min(pages[1], slides.length) });
  }
  return entries.length ? entries : null;
}

/** 1부터 센 쪽이 속한 목차 줄의 자리. 어느 줄에도 없으면 -1. */
export function tocEntryAt(entries: readonly DeckTocEntry[], page: number): number {
  return entries.findIndex((entry) => page >= entry.from && page <= entry.to);
}
