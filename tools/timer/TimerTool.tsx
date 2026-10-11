import { useEffect, useRef, useState } from "react";
import { Icon } from "@/runtime/Icon";

/** 슬라이드에서 바로 쓰는 시계. 시작·멈춤·다시·1분 더하기. 혼자 쓰는 판에서도 돈다. config.doneMessage 는 0초가 되면 보이는 한 줄. */
export function TimerTool({ config }: { config?: Record<string, unknown> }) {
  const initial = Math.max(10, Math.min(60 * 90, Number(config?.seconds ?? 300) || 300));
  const [left, setLeft] = useState(initial);
  const [running, setRunning] = useState(false);
  const endRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    endRef.current = Date.now() + left * 1000;
    const timer = window.setInterval(() => {
      const next = Math.max(0, Math.round(((endRef.current ?? Date.now()) - Date.now()) / 1000));
      setLeft(next);
      if (next === 0) setRunning(false);
    }, 250);
    return () => window.clearInterval(timer);
    // 시작할 때의 남은 시간만 기준으로 삼는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div className={`ds-timer${left === 0 ? " is-done" : ""}`}>
      <div className="ds-timer__face" role="timer" aria-live="off" aria-label={`남은 시간 ${mm}분 ${ss}초`}>
        {mm}:{ss}
      </div>
      <div className="ds-timer__buttons">
        <button type="button" onClick={() => setRunning((value) => !value)} aria-label={running ? "멈추기" : "시작"}>
          <Icon name={running ? "pause" : "play"} size={18} />
        </button>
        <button type="button" onClick={() => { setRunning(false); setLeft(initial); }} aria-label="처음 시간으로">
          <Icon name="reset" size={18} />
        </button>
        <button type="button" onClick={() => { setLeft((value) => value + 60); if (running && endRef.current) endRef.current += 60_000; }} aria-label="1분 더하기">
          <Icon name="plus" size={18} />
        </button>
      </div>
      {left === 0 && typeof config?.doneMessage === "string" && config.doneMessage.trim() ? (
        <p className="ds-timer__done" role="status">{config.doneMessage.slice(0, 120)}</p>
      ) : null}
    </div>
  );
}
