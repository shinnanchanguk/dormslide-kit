import { useCallback, useEffect, useMemo, useState } from "react";
import type { ToolPayload } from "@/lib/deck";
import { Icon } from "@/runtime/Icon";
import { strictPublicWebUrl } from "@/lib/safe-url";
import { liveClient, liveRoom } from "./client";
import type { BoardItem } from "./types";
import { downloadCsv } from "../results-export/exportCsv";
import { useLocalResults } from "../results-export/context";

/**
 * 학생 화면과 주고받는 도구들. 실시간 모드(내 수파베이스)가 켜져 있으면 반 전체가 한 화면을 같이 쓰고,
 * 꺼져 있으면 이 화면 안에서만 쌓이는 '혼자 보는 판'으로 돈다(모양 확인·시연용).
 *
 *  link-board : 학생이 링크·한 줄을 올리면 한 화면에 모인다
 *  classify   : 모인 의견을 선생님이 칸으로 나누어 붙인다
 *  likes      : 다른 사람 의견에 한 번씩 좋아요
 *  join       : 별명을 정하고 들어온다(위 도구들이 이 별명을 쓴다)
 */
export const LIVE_TOOLS = new Set(["link-board", "classify", "likes", "join"]);

const NICK_KEY = "dormslide:nickname";
function savedNickname(): string {
  try {
    return localStorage.getItem(NICK_KEY) ?? "";
  } catch {
    return "";
  }
}

function useBoard(slide: number) {
  const client = liveClient();
  const results = useLocalResults();
  const [items, setItems] = useState<BoardItem[]>(() => !client ? results.boards.get(slide) ?? [] : []);
  useEffect(() => {
    if (!client) results.boards.set(slide, items);
  }, [client, items, results, slide]);
  useEffect(() => {
    if (!client) return;
    return client.subscribeBoard(liveRoom(), slide, setItems);
  }, [client, slide]);
  const post = useCallback(
    (item: { nickname: string; text: string; url?: string }) => {
      if (client) return void client.post(liveRoom(), slide, item);
      setItems((previous) => [...previous, { id: `local-${Date.now()}-${previous.length}`, likes: 0, createdAt: new Date().toISOString(), ...item }].slice(-300));
    },
    [client, slide],
  );
  const like = useCallback(
    (id: string) => {
      if (client) return void client.like(liveRoom(), slide, id);
      setItems((previous) => previous.map((item) => (item.id === id ? { ...item, likes: item.likes + 1 } : item)));
    },
    [client, slide],
  );
  const move = useCallback(
    (id: string, bucket: string) => {
      if (client) return void client.moveBucket(liveRoom(), slide, id, bucket);
      setItems((previous) => previous.map((item) => (item.id === id ? { ...item, bucket } : item)));
    },
    [client, slide],
  );
  return { live: Boolean(client), items, post, like, move };
}

function PostForm({ withUrl, onPost }: { withUrl: boolean; onPost: (item: { nickname: string; text: string; url?: string }) => void }) {
  const [nickname, setNickname] = useState(savedNickname);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  return (
    <form
      className="ds-board__form"
      onSubmit={(event) => {
        event.preventDefault();
        const name = nickname.trim().slice(0, 20);
        const body = text.trim().slice(0, 400);
        const link = withUrl ? strictPublicWebUrl(url.trim()) ?? undefined : undefined;
        if (!name || (!body && !link)) return;
        try {
          localStorage.setItem(NICK_KEY, name);
        } catch {
          /* 저장이 막힌 브라우저는 그냥 넘어간다 */
        }
        onPost({ nickname: name, text: body || link || "", url: link });
        setText("");
        setUrl("");
      }}
    >
      <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="별명" maxLength={20} aria-label="별명" />
      {withUrl ? <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https:// 링크" aria-label="링크" /> : null}
      <input value={text} onChange={(event) => setText(event.target.value)} placeholder="한 줄 설명" maxLength={400} aria-label="한 줄" />
      <button type="submit">올리기</button>
    </form>
  );
}

function ModeLine({ live, items }: { live: boolean; items: BoardItem[] }) {
  return (
    <p className="ds-board__mode">
      {live ? `실시간으로 모으는 중 · ${items.length}개` : "혼자 보는 판: 이 화면에서 올린 것만 보여요"}
      {items.length ? (
        <button type="button" className="ds-export" onClick={() => downloadCsv("게시판 결과.csv", ["별명", "내용", "링크", "칸", "좋아요"], items.map((item) => [item.nickname, item.text, item.url ?? "", item.bucket ?? "", item.likes]))}>결과 내려받기</button>
      ) : null}
    </p>
  );
}

function LinkBoard({ slide, withLikes }: { slide: number; withLikes: boolean }) {
  const board = useBoard(slide);
  return (
    <div className="ds-board">
      <PostForm withUrl onPost={board.post} />
      <ul className="ds-board__grid">
        {board.items.map((item) => (
          <li key={item.id} className="ds-board__card">
            <span className="ds-board__nick">{item.nickname}</span>
            {item.url ? (
              <a href={item.url} target="_blank" rel="noreferrer noopener">
                {item.text}
              </a>
            ) : (
              <p>{item.text}</p>
            )}
            {withLikes ? (
              <button type="button" className="ds-board__like" onClick={() => board.like(item.id)} aria-label={`${item.nickname} 의견에 좋아요`}>
                <Icon name="like" size={14} /> {item.likes}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <ModeLine live={board.live} items={board.items} />
    </div>
  );
}

function Classify({ slide, buckets }: { slide: number; buckets: string[] }) {
  const board = useBoard(slide);
  const [dragging, setDragging] = useState<string | null>(null);
  const columns = useMemo(() => ["", ...buckets], [buckets]);
  return (
    <div className="ds-board ds-board--classify">
      <PostForm withUrl={false} onPost={board.post} />
      <div className="ds-classify" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((bucket) => (
          <section
            key={bucket || "unsorted"}
            className={`ds-classify__col${dragging ? " is-target" : ""}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData("text/plain");
              if (id) board.move(id, bucket);
              setDragging(null);
            }}
            aria-label={bucket || "아직 안 나눈 의견"}
          >
            <h3>{bucket || "아직 안 나눈 의견"}</h3>
            {board.items
              .filter((item) => (item.bucket ?? "") === bucket)
              .map((item) => (
                <article
                  key={item.id}
                  className="ds-board__card"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", item.id);
                    setDragging(item.id);
                  }}
                  onDragEnd={() => setDragging(null)}
                >
                  <span className="ds-board__nick">{item.nickname}</span>
                  <p>{item.text}</p>
                </article>
              ))}
          </section>
        ))}
      </div>
      <ModeLine live={board.live} items={board.items} />
    </div>
  );
}

function Join() {
  const [nickname, setNickname] = useState(savedNickname);
  const [saved, setSaved] = useState(Boolean(savedNickname()));
  return (
    <form
      className="ds-join"
      onSubmit={(event) => {
        event.preventDefault();
        const name = nickname.trim().slice(0, 20);
        if (!name) return;
        try {
          localStorage.setItem(NICK_KEY, name);
        } catch {
          /* 저장이 막힌 브라우저는 그냥 넘어간다 */
        }
        setSaved(true);
      }}
    >
      <label>
        <span>별명을 정해 주세요(실명 말고 별명)</span>
        <input value={nickname} onChange={(event) => { setNickname(event.target.value); setSaved(false); }} maxLength={20} />
      </label>
      <button type="submit">{saved ? "들어왔어요" : "들어가기"}</button>
    </form>
  );
}

export function renderLiveTool(payload: ToolPayload, index: number) {
  const buckets = Array.isArray(payload.config?.buckets) ? (payload.config?.buckets as unknown[]).map(String).slice(0, 5) : ["좋은 점", "아쉬운 점", "새로운 생각"];
  switch (payload.tool) {
    case "link-board":
      return <LinkBoard slide={index} withLikes={payload.config?.likes === true} />;
    case "likes":
      return <LinkBoard slide={index} withLikes />;
    case "classify":
      return <Classify slide={index} buckets={buckets} />;
    case "join":
      return <Join />;
    default:
      return null;
  }
}
