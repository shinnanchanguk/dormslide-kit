import { htmlToParts } from "@/runtime/inline-edit-parts";
import type { Block, Inline } from "@/lib/deck-content";

/**
 * 발표 자료의 본문 한 문단을 무대에서 바로 고친 뒤 넘기는 값이다.
 *
 * 이 콜백은 관리자 미리보기에서만 준다. 발표·참여 화면은 콜백을 주지 않으므로
 * 같은 본문 컴포넌트를 써도 읽기 전용으로 남는다.
 */
export type BlockCommit = (blockIndex: number, parts: Inline[]) => void;

/**
 * 편집기에서 지정한 색·크기를 그린다.
 *
 * 크기는 `em` 으로 준다. 무대 전체 글자 크기는 `AutoFit` 이 `--fs` 로 정하므로,
 * 배율로 얹어야 창이 작아졌을 때 함께 줄어들어 무대 밖으로 넘치지 않는다.
 */
function styleOf(part: Inline): React.CSSProperties | undefined {
  if (!part.c && !part.s) return undefined;
  return {
    ...(part.c ? { color: part.c } : {}),
    ...(part.s ? { fontSize: `${part.s}em` } : {}),
  };
}

function Parts({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((part, index) => (
        <span
          key={index}
          className={part.t === "hl" ? "hl" : undefined}
          data-hl={part.t === "hl" ? "1" : undefined}
          data-c={part.c}
          data-s={part.s}
          style={styleOf(part)}
        >
          {part.v}
        </span>
      ))}
    </>
  );
}

function plainPaste(event: React.ClipboardEvent<HTMLElement>) {
  event.preventDefault();
  const text = event.clipboardData.getData("text/plain").replace(/[\r\n]+/g, " ");
  event.currentTarget.ownerDocument.execCommand("insertText", false, text);
}

function EditableParagraph({
  block,
  blockIndex,
  className,
  onCommit,
}: {
  block: Exclude<Block, { b: "rule" }>;
  blockIndex: number;
  className?: string;
  onCommit?: BlockCommit;
}) {
  const editable = Boolean(onCommit);

  return (
    <p
      className={className ? `${className}${editable ? " slide-inline-edit" : ""}` : editable ? "slide-inline-edit" : undefined}
      contentEditable={editable ? "plaintext-only" : undefined}
      suppressContentEditableWarning={editable}
      spellCheck={editable}
      aria-label={editable ? `본문 문장 ${blockIndex + 1} 편집` : undefined}
      onFocus={
        editable
          ? (event) => {
              event.currentTarget.dataset.inlineEditing = "true";
            }
          : undefined
      }
      onKeyDown={
        editable
          ? (event) => {
              // 한 문단은 한 줄 흐름으로 둔다. Enter 로 만든 줄은 저장할 때 공백으로
              // 바뀌므로, 처음부터 눌리지 않게 해 커서와 자동 맞춤이 흔들리지 않게 한다.
              if (event.key === "Enter") event.preventDefault();
            }
          : undefined
      }
      onPaste={editable ? plainPaste : undefined}
      onBlur={
        editable
          ? (event) => {
              delete event.currentTarget.dataset.inlineEditing;
              const next = htmlToParts(event.currentTarget);
              const same =
                next.length === block.parts.length &&
                next.every((part, index) => {
                  const current = block.parts[index];
                  return (
                    current?.t === part.t &&
                    current.v === part.v &&
                    current.c === part.c &&
                    current.s === part.s
                  );
                });
              if (!same) onCommit?.(blockIndex, next);
            }
          : undefined
      }
    >
      <Parts parts={block.parts} />
    </p>
  );
}

export function Blocks({
  blocks,
  blockIndexes,
  onCommit,
}: {
  blocks: Block[];
  /** 카드처럼 일부 문단만 꺼내 그릴 때, 원본 배열의 자리를 보존한다. */
  blockIndexes?: number[];
  onCommit?: BlockCommit;
}) {
  return (
    <div className="prose">
      {blocks.map((block, index) => {
        const originalIndex = blockIndexes?.[index] ?? index;
        if (block.b === "rule") return <div key={index} className="page-rule" />;
        if (block.b === "lead")
          return (
            <EditableParagraph
              key={index}
              block={block}
              blockIndex={originalIndex}
              className="lead"
              onCommit={onCommit}
            />
          );
        if (block.b === "note")
          return (
            <EditableParagraph
              key={index}
              block={block}
              blockIndex={originalIndex}
              className="note-serif"
              onCommit={onCommit}
            />
          );
        return <EditableParagraph key={index} block={block} blockIndex={originalIndex} onCommit={onCommit} />;
      })}
    </div>
  );
}
