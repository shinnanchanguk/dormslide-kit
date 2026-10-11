import { useMemo, useState } from "react";
import type { SurveyPayload } from "@/lib/deck-content";
import { useLiveSurvey } from "../live/useLiveSurvey";
import { downloadCsv } from "../results-export/exportCsv";

/**
 * 객관식·서술형 설문.
 *
 * 실시간 모드(meta.live + 내 수파베이스)가 켜져 있으면 학생 화면의 답이 모여 막대로 자란다.
 * 꺼져 있으면 이 화면에서 누른 것만 세는 '혼자 보는 판'이다(수업 전에 모양을 확인하거나, 손을 들어 받은 수를 눌러 세는 데 쓴다).
 */
export function SurveyTool({ payload, slideIndex }: { payload: SurveyPayload; slideIndex: number }) {
  const kind = payload.kind ?? (payload.options?.length ? "CHOICE" : "TEXT");
  const options = useMemo(() => (payload.options ?? []).slice(0, 12), [payload.options]);
  const store = useLiveSurvey(slideIndex, options.length);
  const [draft, setDraft] = useState("");
  const total = store.counts.reduce((sum, value) => sum + value, 0);

  if (kind === "TEXT") {
    return (
      <div className="ds-survey ds-survey--text">
        <form
          className="ds-survey__form"
          onSubmit={(event) => {
            event.preventDefault();
            const value = draft.trim();
            if (!value) return;
            store.submitText(value);
            setDraft("");
          }}
        >
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={400} rows={2} placeholder="생각을 적어 주세요" aria-label="답 적기" />
          <button type="submit">보내기</button>
        </form>
        <ul className="ds-survey__answers" aria-live="polite">
          {store.texts.map((text, index) => (
            <li key={`${index}:${text.slice(0, 12)}`}>{text}</li>
          ))}
        </ul>
        <p className="ds-survey__mode">
          {store.live ? "실시간으로 모으는 중" : "혼자 보는 판: 이 화면에 적은 답만 보여요"}
          {store.texts.length ? (
            <button type="button" className="ds-export" onClick={() => downloadCsv(`${payload.title}.csv`, ["답"], store.texts.map((text) => [text]))}>결과 내려받기</button>
          ) : null}
        </p>
      </div>
    );
  }

  return (
    <div className="ds-survey">
      <ol className="ds-survey__options">
        {options.map((option, index) => {
          const count = store.counts[index] ?? 0;
          const ratio = total ? count / total : 0;
          return (
            <li key={`${index}:${option.slice(0, 12)}`}>
              <button type="button" className={`ds-survey__option${store.mine === index ? " is-mine" : ""}`} onClick={() => store.vote(index)} aria-pressed={store.mine === index}>
                <span className="ds-survey__bar" style={{ transform: `scaleX(${ratio})` }} aria-hidden="true" />
                <span className="ds-survey__no">{String(index + 1).padStart(2, "0")}</span>
                <span className="ds-survey__label">{option}</span>
                <span className="ds-survey__count">{count}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="ds-survey__mode">
        {store.live ? `실시간으로 모으는 중 · ${total}명 응답` : "혼자 보는 판: 이 화면에서 누른 수만 세요"}
        {total ? (
          <button type="button" className="ds-export" onClick={() => downloadCsv(`${payload.title}.csv`, ["보기", "응답 수"], options.map((option, index) => [option, store.counts[index] ?? 0]))}>결과 내려받기</button>
        ) : null}
      </p>
    </div>
  );
}
