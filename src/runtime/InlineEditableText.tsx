import type { Inline } from "@/lib/deck-content";

/** 무대 위 글자 변경 단위. 관리자 편집기와 발표자 화면의 바로 고치기가 함께 쓴다. */
export type SlideInlineEdit =
  | {
      target: "payload";
      field: "eyebrow" | "title" | "hint" | "caption";
      value: string;
    }
  | {
      target: "body-block";
      columnIndex: number;
      blockIndex: number;
      parts: Inline[];
    }
  | {
      target: "tool-intro";
      blockIndex: number;
      parts: Inline[];
    }
  | {
      target: "tool-config";
      field: "heading" | "caption" | "buttonLabel";
      value: string;
    }
  | {
      target: "resource";
      resourceIndex: number;
      value: string;
    }
  | {
      target: "survey-prompt";
      value: string;
    }
  | {
      /** 표 아래위에 붙는 설명 한 줄(caption)과 출처 줄(note). */
      target: "table-text";
      tableIndex: number;
      part: "caption" | "note";
      value: string;
    }
  | {
      target: "table-head";
      tableIndex: number;
      colIndex: number;
      value: string;
    }
  | {
      target: "table-cell";
      tableIndex: number;
      rowIndex: number;
      colIndex: number;
      value: string;
    }
  | {
      target: "case-stat";
      index: number;
      value: string;
    }
  | {
      target: "agenda";
      index: number;
      value: string;
    }
  | {
      /** 배치가 정해 둔 카드 머리 글(예: "01 / 산업혁명"). */
      target: "card-label";
      index: number;
      value: string;
    }
  | {
      /** 연수 워크플로 장의 개념 카드 글과 'AI에게 맡길 일' 이름. */
      target: "training-text";
      part: "visualTitle" | "visualNote" | "visualTag" | "actionLabel" | "aiNote" | "progressLabel" | "progressNote" | "stepText" | "stepNote" | "stepLinkLabel" | "stepsDone" | "guideKicker" | "guideTitle" | "guideFootnote" | "guideItem" | "guideTreeLabel" | "guideTreeNote";
      index?: number;
      /** 폴더 나무 안내의 가지. */
      branch?: "global" | "project";
      /** 프로필별 단계 판의 열쇠. 공통 단계면 없다. */
      profileKey?: string;
      value: string;
    }
  | {
      target: "survey-option";
      index: number;
      value: string;
    }
  | {
      target: "resource-caption";
      index: number;
      value: string;
    }
  | {
      /** 사례 카드의 제작자 줄. 이름에 걸린 주소는 그대로다. */
      target: "credit";
      part: "prefix" | "label";
      value: string;
    };

/**
 * 공개·발표 화면은 이 값을 주지 않는다. 관리자 미리보기와, 발표자가 [편집]을 켠
 * 화면에서만 같은 SlidePage 가 편집 가능한 상태가 된다.
 */
export type SlideInlineEditor = {
  onCommit: (change: SlideInlineEdit) => void;
};

type InlineTextTag = "div" | "span" | "p" | "h1" | "h2" | "strong" | "b" | "em" | "small" | "dt" | "dd";

/**
 * 한 줄로 만든 뒤 화면에 보이지 않는 문자(폭 없는 공백·방향 문자·한글 채움 문자 등)를 지운다.
 * 웹 문서나 메신저에서 복사한 글에 섞여 들어오면 서버가 저장을 거절하는데, 발표자는 그 이유를
 * 볼 수 없다. 서버(lib/inline-text-patch.ts)와 같은 문자 집합이다.
 */
function plainLine(text: string) {
  return text
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}\p{Zl}\p{Zp}]/gu, "");
}

/**
 * 내용은 React 텍스트로만 그린다. 편집 중에는 브라우저 DOM 을 그대로 두고, 포커스를
 * 벗어날 때 평문만 다시 읽어 콜백으로 넘긴다. 그래서 타이핑마다 React 가 다시 그려
 * 커서가 튀지 않는다.
 */
export function InlineEditableText({
  as: Tag = "span",
  className,
  value,
  onCommit,
  ariaLabel,
  allowEmpty = true,
}: {
  as?: InlineTextTag;
  className?: string;
  value: string;
  onCommit?: (value: string) => void;
  ariaLabel?: string;
  /** 자료 제목처럼 서버가 빈 값을 받을 수 없는 자리에서만 끈다. */
  allowEmpty?: boolean;
}) {
  const editable = Boolean(onCommit);

  return (
    <Tag
      className={className ? `${className}${editable ? " slide-inline-edit" : ""}` : editable ? "slide-inline-edit" : undefined}
      contentEditable={editable ? "plaintext-only" : undefined}
      suppressContentEditableWarning={editable}
      spellCheck={editable}
      aria-label={editable ? ariaLabel ?? "글자 편집" : undefined}
      onFocus={
        editable
          ? (event) => {
              event.currentTarget.dataset.inlineEditing = "true";
            }
          : undefined
      }
      onClick={
        editable
          ? (event) => {
              // 카드 전체가 링크인 자리에서도 글자를 누르면 고치기만 하고 이동하지 않는다.
              event.preventDefault();
              event.stopPropagation();
            }
          : undefined
      }
      onKeyDown={
        editable
          ? (event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                event.currentTarget.textContent = value;
                event.currentTarget.blur();
              }
              // 편집 중 화살표는 커서만 옮긴다. 슬라이드 넘김으로 번지지 않게 막는다.
              event.stopPropagation();
            }
          : undefined
      }
      onPaste={
        editable
          ? (event) => {
              event.preventDefault();
              const text = plainLine(event.clipboardData.getData("text/plain"));
              event.currentTarget.ownerDocument.execCommand("insertText", false, text);
            }
          : undefined
      }
      onBlur={
        editable
          ? (event) => {
              delete event.currentTarget.dataset.inlineEditing;
              const next = plainLine(event.currentTarget.textContent ?? "");
              if (!allowEmpty && next.trim().length === 0) {
                event.currentTarget.textContent = value;
                return;
              }
              if (next !== value) onCommit?.(next);
            }
          : undefined
      }
    >
      {value}
    </Tag>
  );
}
