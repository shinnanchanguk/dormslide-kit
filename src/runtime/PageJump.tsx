import { useEffect, useRef, useState } from "react";
import { Icon } from "@/runtime/Icon";

/**
 * 슬라이드 아래 막대의 `처음으로` 단추와 쪽 표시(06 / 63).
 * 쪽 표시를 누르면 그 자리에서 번호 입력칸으로 바뀐다. 번호를 넣고 Enter 를 누르거나 입력칸을 벗어나면
 * 그 슬라이드로 가고, Esc 를 누르면 그대로 닫힌다. 아이폰 숫자 자판에는 Enter 가 없어서 `완료`나
 * 바깥 누르기(입력칸 벗어남)로도 이동해야 한다. 도름슬라이드 보기 화면과 도름스 글 속 보기 화면이 함께 쓴다.
 */
export function FirstPageButton({
  index,
  onGo,
  className = "btn btn--sm",
  labelClassName,
  testId,
}: {
  index: number;
  onGo: (index: number) => void;
  className?: string;
  /** 좁은 화면에서 글자를 숨길 때 쓰는 이름. */
  labelClassName?: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      className={className}
      data-test={testId}
      aria-label="처음으로, 첫 슬라이드로 이동"
      onClick={() => onGo(0)}
      disabled={index === 0}
    >
      <Icon name="first" size={13} />
      <span className={labelClassName}>처음으로</span>
    </button>
  );
}

export function PageJump({
  index,
  total,
  max = total,
  onGo,
  className,
  testId,
}: {
  index: number;
  total: number;
  /** 지금 갈 수 있는 마지막 번호(1부터). 참여자가 발표자를 따라가는 동안은 발표자가 연 자리까지다. */
  max?: number;
  /** 0부터 센 자리. */
  onGo: (index: number) => void;
  className: string;
  testId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Enter 와 입력칸 벗어남(입력칸이 사라질 때도 일어난다)이 한 번의 입력을 두 번 처리하지 않게 한다.
  const settled = useRef(false);
  // Enter·Esc 로 마쳤을 때만 쪽 표시로 초점을 돌린다. 바깥을 눌러 마쳤으면 누른 곳의 초점을 빼앗지 않는다.
  const returnFocus = useRef(false);
  const width = String(total).length;
  const limit = Math.max(1, Math.min(max, total));
  const page = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
      return;
    }
    // 키보드로 입력을 마치면 쪽 표시로 초점을 돌려 키보드·화면 읽기 사용자가 자리를 잃지 않게 한다.
    if (returnFocus.current) {
      returnFocus.current = false;
      buttonRef.current?.focus({ preventScroll: true });
    }
  }, [editing]);

  const finish = (commit: boolean, byKey: boolean) => {
    if (settled.current) return;
    settled.current = true;
    returnFocus.current = byKey;
    setEditing(false);
    if (!commit) return;
    const value = Number.parseInt(draft, 10);
    if (!Number.isFinite(value)) return;
    const target = Math.min(Math.max(value, 1), limit) - 1;
    if (target !== index) onGo(target);
  };

  if (editing) {
    return (
      <form
        className={`${className} page-jump page-jump--editing`}
        data-test={`${testId}-form`}
        onSubmit={(event) => {
          event.preventDefault();
          finish(true, true);
        }}
      >
        <input
          ref={inputRef}
          className="page-jump__input mono"
          data-test={`${testId}-input`}
          type="text"
          inputMode="numeric"
          enterKeyHint="go"
          pattern="[0-9]*"
          autoComplete="off"
          aria-label={`이동할 슬라이드 번호, 1부터 ${limit}까지`}
          value={draft}
          style={{ width: `${width + 1.5}ch` }}
          onChange={(event) => setDraft(event.target.value.replace(/[^0-9]/g, "").slice(0, width))}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              finish(false, true);
            }
          }}
          onBlur={() => finish(true, false)}
        />
        <span aria-hidden="true">/ {String(total).padStart(2, "0")}</span>
      </form>
    );
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`${className} page-jump`}
      data-test={testId}
      aria-label={`${page}, 눌러서 슬라이드 번호로 이동`}
      title="번호를 눌러 원하는 슬라이드로 이동"
      onClick={() => {
        settled.current = false;
        setDraft(String(index + 1));
        setEditing(true);
      }}
    >
      {page}
    </button>
  );
}
