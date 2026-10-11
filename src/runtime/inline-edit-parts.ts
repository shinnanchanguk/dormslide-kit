import { mergeInline, type Inline, type InlineStyle } from "@/lib/deck-content";

/**
 * 드래그한 글자만 색·크기를 바꾸는 편집의 속살.
 *
 * 화면(contentEditable)과 자료(Inline[]) 사이를 오간다. 자료가 정본이고, 서식을 먹일
 * 때는 글자 자리(offset)를 재서 자료를 쪼갠 뒤 다시 그린다. 브라우저 execCommand 는
 * 브라우저마다 결과가 달라 쓰지 않는다.
 */

export type StylePatch = {
  c?: string | null;
  s?: number | null;
  hl?: boolean;
};

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 자료를 편집칸에 그릴 HTML 로 바꾼다. 속성에 서식을 적어 두고 다시 읽을 때 쓴다. */
export function partsToHtml(parts: Inline[]): string {
  if (parts.length === 0) return "";
  return parts
    .map((part) => {
      const attrs = [
        part.t === "hl" ? ' data-hl="1"' : "",
        part.c ? ` data-c="${escapeHtml(part.c)}"` : "",
        part.s ? ` data-s="${part.s}"` : "",
      ].join("");
      const style = [
        part.c ? `color:${part.c}` : "",
        part.s ? `font-size:${part.s}em` : "",
      ]
        .filter(Boolean)
        .join(";");
      const cls = part.t === "hl" ? ' class="hl"' : "";
      return `<span${cls}${attrs}${style ? ` style="${style}"` : ""}>${escapeHtml(part.v)}</span>`;
    })
    .join("");
}

/** 편집칸에서 자료를 다시 읽는다. 사람이 글자를 친 직후에 부른다. */
export function htmlToParts(host: HTMLElement): Inline[] {
  const parts: Inline[] = [];

  const walk = (node: Node, inherited: Inline) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text.length > 0) parts.push({ ...inherited, v: text });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === "BR") {
      // 한 덩이는 한 문단이다. 줄바꿈은 공백으로 눕힌다.
      parts.push({ ...inherited, v: " " });
      return;
    }
    const next: Inline = {
      t: node.dataset.hl === "1" || node.classList.contains("hl") ? "hl" : inherited.t,
      v: "",
      ...(node.dataset.c ? { c: node.dataset.c } : inherited.c ? { c: inherited.c } : {}),
      ...(node.dataset.s
        ? { s: Number(node.dataset.s) }
        : inherited.s
          ? { s: inherited.s }
          : {}),
    };
    for (const child of Array.from(node.childNodes)) walk(child, next);
  };

  for (const child of Array.from(host.childNodes)) walk(child, { t: "text", v: "" });
  return mergeInline(parts);
}

/** 편집칸 안에서 지금 고른 구간이 몇 번째 글자부터 몇 번째 글자까지인지 잰다. */
export function selectionOffsets(host: HTMLElement): { start: number; end: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!host.contains(range.startContainer) || !host.contains(range.endContainer)) return null;

  const before = range.cloneRange();
  before.selectNodeContents(host);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  return { start, end: start + range.toString().length };
}

/** 잰 자리로 커서를 되돌린다. 다시 그린 뒤에도 하던 자리가 유지된다. */
export function restoreSelection(host: HTMLElement, start: number, end: number) {
  const range = document.createRange();
  let seen = 0;
  let done = { s: false, e: false };
  range.setStart(host, 0);
  range.setEnd(host, 0);

  const walk = (node: Node) => {
    if (done.s && done.e) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent?.length ?? 0;
      if (!done.s && seen + length >= start) {
        range.setStart(node, start - seen);
        done = { ...done, s: true };
      }
      if (!done.e && seen + length >= end) {
        range.setEnd(node, end - seen);
        done = { ...done, e: true };
      }
      seen += length;
      return;
    }
    for (const child of Array.from(node.childNodes)) walk(child);
  };

  walk(host);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function patched(part: Inline, patch: StylePatch): Inline {
  const next: Inline = { ...part };
  if (patch.c !== undefined) {
    if (patch.c === null) delete next.c;
    else next.c = patch.c;
  }
  if (patch.s !== undefined) {
    if (patch.s === null || patch.s === 1) delete next.s;
    else next.s = patch.s;
  }
  if (patch.hl !== undefined) next.t = patch.hl ? "hl" : "text";
  return next;
}

/** 고른 구간에만 서식을 먹인다. 걸친 토막은 쪼개고, 같은 서식끼리는 다시 합친다. */
export function applyStyle(
  parts: Inline[],
  start: number,
  end: number,
  patch: StylePatch,
): Inline[] {
  if (end <= start) return parts;
  const out: Inline[] = [];
  let cursor = 0;

  for (const part of parts) {
    const from = cursor;
    const to = cursor + part.v.length;
    cursor = to;

    if (to <= start || from >= end) {
      out.push(part);
      continue;
    }

    const headLength = Math.max(0, start - from);
    const tailStart = Math.min(part.v.length, Math.max(0, end - from));

    if (headLength > 0) out.push({ ...part, v: part.v.slice(0, headLength) });
    out.push(patched({ ...part, v: part.v.slice(headLength, tailStart) }, patch));
    if (tailStart < part.v.length) out.push({ ...part, v: part.v.slice(tailStart) });
  }

  return mergeInline(out);
}

/** 고른 구간이 지금 어떤 서식인지. 도구막대의 눌린 상태를 그릴 때 쓴다. */
export function styleAt(parts: Inline[], start: number, end: number): InlineStyle & { hl: boolean } {
  let cursor = 0;
  for (const part of parts) {
    const from = cursor;
    const to = cursor + part.v.length;
    cursor = to;
    if (to > start && from < Math.max(end, start + 1)) {
      return { c: part.c, s: part.s, hl: part.t === "hl" };
    }
  }
  return { hl: false };
}

export const PALETTE = [
  { name: "기본", value: null },
  { name: "빨강", value: "#c0392b" },
  { name: "파랑", value: "#1f5f8b" },
  { name: "초록", value: "#3f6b4a" },
  { name: "주황", value: "#c2751a" },
  { name: "보라", value: "#6b4a8b" },
  { name: "회색", value: "#7a736a" },
] as const;

export const SIZES = [
  { name: "작게", value: 0.8 },
  { name: "보통", value: 1 },
  { name: "크게", value: 1.35 },
  { name: "아주 크게", value: 1.8 },
] as const;
