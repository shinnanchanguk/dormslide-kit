import { useCallback, useEffect, useState } from "react";
import { liveClient, liveRoom } from "./client";
import { useLocalResults } from "../results-export/context";

/**
 * 설문 한 장의 상태. 실시간 모드면 내 수파베이스에 답을 모으고, 아니면 이 화면에서만 센다.
 */
export function useLiveSurvey(slideIndex: number, optionCount: number) {
  const client = liveClient();
  const results = useLocalResults();
  const [counts, setCounts] = useState<number[]>(() => !client ? results.surveys.get(slideIndex)?.counts ?? Array.from({ length: optionCount }, () => 0) : Array.from({ length: optionCount }, () => 0));
  const [texts, setTexts] = useState<string[]>(() => !client ? results.surveys.get(slideIndex)?.texts ?? [] : []);
  const [mine, setMine] = useState<number | null>(null);

  useEffect(() => {
    const saved = client ? undefined : results.surveys.get(slideIndex);
    setCounts(saved?.counts ?? Array.from({ length: optionCount }, () => 0));
    setTexts(saved?.texts ?? []);
    setMine(null);
  }, [client, optionCount, slideIndex, results]);

  useEffect(() => {
    if (!client) results.surveys.set(slideIndex, { counts, texts });
  }, [client, results, slideIndex, counts, texts]);

  useEffect(() => {
    if (!client) return;
    return client.subscribeSurvey(liveRoom(), slideIndex, optionCount, (next) => {
      setCounts(next.counts);
      setTexts(next.texts);
    });
  }, [client, slideIndex, optionCount]);

  const vote = useCallback(
    (index: number) => {
      if (client) {
        setMine(index);
        void client.vote(liveRoom(), slideIndex, index);
        return;
      }
      // 혼자 보는 판: 누를 때마다 하나씩 센다(손을 든 수를 세어 누르는 쓰임).
      setCounts((previous) => previous.map((value, i) => (i === index ? value + 1 : value)));
    },
    [client, slideIndex],
  );

  const submitText = useCallback(
    (text: string) => {
      if (client) {
        void client.answer(liveRoom(), slideIndex, text);
        return;
      }
      setTexts((previous) => [text, ...previous].slice(0, 200));
    },
    [client, slideIndex],
  );

  return { live: Boolean(client), counts, texts, mine, vote, submitText };
}
