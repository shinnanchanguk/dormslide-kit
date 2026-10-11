import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import type { Block, BodyPayload, BodyResource, BodyTable } from "@/lib/deck-content";
import { strictInternalImagePath, strictPublicWebUrl } from "@/lib/safe-url";
import { InlineEditableText, type SlideInlineEdit, type SlideInlineEditor } from "@/runtime/InlineEditableText";
import { QrCode } from "@/runtime/QrCode";
import { manuscriptText } from "@/lib/live-tokens";

/** 크로마 배치들이 함께 쓰는 도구. 배치 파일마다 같은 규칙으로 표를 읽고 글자를 고칠 수 있게 한다. */

export type Props = {
  payload: BodyPayload;
  renderBlocks: (columnIndex: number, blocks: Block[], blockIndexes: number[]) => ReactNode;
  renderResource: (resource: BodyResource, index: number, variant: "source" | "case" | "cover") => ReactNode;
  media?: ReactNode;
  /** 관리자가 무대에서 바로 고칠 때만 온다. */
  editor?: SlideInlineEditor;
};

/**
 * 표에서 꺼내 그리는 글자(칸·머리줄·설명·출처)와 숫자 칸 이름·목차를 무대에서 바로 고칠 수 있게 한다.
 * 편집기가 없으면 글자만 그대로 내보내 발표·참여 화면의 DOM 은 예전과 같다.
 */
export const EditContext = createContext<SlideInlineEditor | undefined>(undefined);

export type EditAt =
  | { kind: "cell"; t: number; r: number; c: number }
  | { kind: "head"; t: number; c: number }
  | { kind: "caption"; t: number }
  | { kind: "note"; t: number }
  | { kind: "stat"; i: number }
  | { kind: "agenda"; i: number }
  | { kind: "field"; f: "eyebrow" | "title" }
  | { kind: "resourceCaption"; i: number };

export const cellAt = (r: number, c: number, t = 0): EditAt => ({ kind: "cell", t, r, c });

function editChange(at: EditAt, value: string): SlideInlineEdit {
  switch (at.kind) {
    case "cell":
      return { target: "table-cell", tableIndex: at.t, rowIndex: at.r, colIndex: at.c, value };
    case "head":
      return { target: "table-head", tableIndex: at.t, colIndex: at.c, value };
    case "caption":
      return { target: "table-text", tableIndex: at.t, part: "caption", value };
    case "note":
      return { target: "table-text", tableIndex: at.t, part: "note", value };
    case "stat":
      return { target: "case-stat", index: at.i, value };
    case "agenda":
      return { target: "agenda", index: at.i, value };
    case "field":
      return { target: "payload", field: at.f, value };
    case "resourceCaption":
      return { target: "resource-caption", index: at.i, value };
  }
}

export function useEditing() {
  return useContext(EditContext) !== undefined;
}

/**
 * 표 한 줄을 통째로 원문(글·댓글·앱)으로 잇는 투명 덮개 링크. 줄 안의 글자는 그대로 두고 위에 깐다.
 * 공개 HTTPS 주소만 받는다. 편집 중에는 글자를 눌러 고쳐야 하므로 덮개를 그리지 않는다.
 */
export function RowHit({ url, label }: { url: string | undefined; label: string }) {
  const editing = useEditing();
  const safe = url ? strictPublicWebUrl(url) : null;
  if (!safe || editing) return null;
  return <a className="ch-hit" href={safe} target="_blank" rel="noreferrer noopener" aria-label={label} />;
}

/**
 * 누르면 무엇이 열리는지 알려 주는 버튼 글자. 도름스 공지·글·앱·토픽은 그 이름으로, 그 밖은 사이트로 부른다.
 * 주소가 공개 HTTPS 가 아니면 빈 글자를 돌려준다.
 */
export function linkWord(url: string | undefined): string {
  const safe = url ? strictPublicWebUrl(url) : null;
  if (!safe) return "";
  const { hostname, pathname } = new URL(safe);
  const host = hostname.replace(/^www\./, "");
  if (host === "dorms.school") {
    if (pathname.startsWith("/notice/")) return "공지 보기";
    if (pathname.startsWith("/board/p/")) return "글 보기";
    if (pathname.startsWith("/apps/")) return "앱 보기";
    if (pathname.startsWith("/topics/")) return "토픽 보기";
  }
  if (host === "instagram.com") return "인스타그램 보기";
  return "사이트 보기";
}

/**
 * 카드·버튼처럼 크게 보이는 링크 글자. 도름스 글·공지가 아닌 주소는 목적지 주소를 함께 적어,
 * 도름스 글처럼 보이는 자리에서 바깥으로 이어지는 것을 숨기지 않는다.
 */
export function linkText(url: string | undefined): string {
  const word = linkWord(url);
  if (word !== "사이트 보기") return word;
  return `${new URL(strictPublicWebUrl(url!)!).hostname.replace(/^www\./, "")} · ${word}`;
}

/** 줄에 원문 주소가 있으면 data-linked 를 붙여 누를 수 있다는 표시를 그린다. */
export const linked = (url: string | undefined) => (url && strictPublicWebUrl(url) ? "" : undefined);

/** 고칠 수 있는 글자 한 토막. 편집이 꺼져 있으면 글자만 그린다. */
export function E({ v, at, label, prefix = "" }: { v: string | undefined; at: EditAt; label?: string; prefix?: string }) {
  const editor = useContext(EditContext);
  const value = v ?? "";
  if (!editor) return <>{value}</>;
  return (
    <InlineEditableText
      as="span"
      value={value}
      ariaLabel={label ?? "글자 편집"}
      allowEmpty={at.kind !== "cell" && at.kind !== "head" && at.kind !== "stat" && at.kind !== "agenda" && at.kind !== "field"}
      // 강조 표시(*)처럼 글자 앞에 붙은 표식은 고친 글에 다시 붙여 저장한다.
      onCommit={(next) => editor.onCommit(editChange(at, `${prefix}${next}`))}
    />
  );
}


export function all(blocks: Block[]) {
  return blocks.map((_, index) => index);
}

export function Copy({ blocks, columnIndex = 0, renderBlocks, className = "ch-copy" }: { blocks: Block[]; columnIndex?: number; renderBlocks: Props["renderBlocks"]; className?: string }) {
  if (!blocks.length) return null;
  return <div className={className}>{renderBlocks(columnIndex, blocks, all(blocks))}</div>;
}

export function table(payload: BodyPayload, index = 0): BodyTable | undefined {
  return payload.tables?.[index];
}

export function imageSrc(src: string | undefined): string | null {
  if (!src) return null;
  return strictInternalImagePath(src);
}

export function delay(index: number, step = 0.12, base = 0.1): CSSProperties {
  return { ["--d" as string]: `${(base + index * step).toFixed(2)}s` };
}

export function num(value: string | undefined): number {
  // 편집 화면에서는 {{live:열쇠|원고 숫자}} 가 그대로 오므로 원고 숫자만 읽는다.
  const parsed = Number(manuscriptText(String(value ?? "")).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** 자료 가운데 QR 로 표시하라고 한 첫 공개 주소를 QR 과 링크 글로 그린다. size 는 QR 한 변(px)이다. */
export function QrResource({ payload, renderResource, size = 104 }: Pick<Props, "payload" | "renderResource"> & { size?: number }) {
  const index = (payload.resources ?? []).findIndex((resource) => resource.qr === true && strictPublicWebUrl(resource.url) !== null);
  const resource = index >= 0 ? payload.resources?.[index] : undefined;
  const url = resource ? strictPublicWebUrl(resource.url) : null;
  if (!resource || !url) return null;
  return (
    <div className="ch-qr">
      <a href={url} target="_blank" rel="noreferrer noopener" aria-label={`${resource.label} 열기`}>
        <QrCode value={url} size={size} label={`${resource.label} QR 코드`} />
      </a>
      <div className="ch-qr__copy">
        {renderResource(resource, index, "cover")}
        {resource.caption ? <span className="ch-qr__caption"><E v={resource.caption} at={{ kind: "resourceCaption", i: index }} label="자료 설명 편집" /></span> : null}
      </div>
    </div>
  );
}
