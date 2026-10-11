import type { BoardItem, LiveClient, SurveySnapshot, RoomResults } from "./types";

/**
 * 내 수파베이스로 도는 실시간 모드. 표와 규칙은 supabase/schema.sql 에 있다.
 * 학생은 이메일 없이 수파베이스 익명 로그인으로 브라우저마다 번호를 하나 받는다(대시보드에서 Anonymous sign-ins 켜기).
 * 규칙(RLS)이 그 번호로 '한 사람 한 표'와 '발표자는 방을 연 사람만'을 지킨다.
 */
/** 표 모양을 미리 알려 주지 않고 쓰는 느슨한 손잡이. 표와 규칙은 supabase/schema.sql 이 정한다. */
type Query = {
  select: (columns: string) => Query;
  eq: (column: string, value: unknown) => Query;
  order: (column: string, options: { ascending: boolean }) => Query;
  limit: (count: number) => Promise<{ data: unknown[] | null }>;
  range: (from: number, to: number) => Promise<{ data: unknown[] | null; error?: unknown }>;
  maybeSingle: () => Promise<{ data: unknown }>;
  insert: (row: Record<string, unknown>) => Promise<unknown>;
};
type Channel = { on: (event: string, filter: Record<string, string>, callback: () => void) => Channel; subscribe: () => Channel };
type Client = {
  auth: { getSession: () => Promise<{ data: { session: unknown } }>; signInAnonymously: () => Promise<{ error: unknown }> };
  from: (table: string) => Query;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
  channel: (name: string) => Channel;
  removeChannel: (channel: Channel) => Promise<unknown>;
};

export function createSupabaseLive(url: string, anonKey: string): LiveClient {
  let clientPromise: Promise<Client> | null = null;
  const client = () =>
    (clientPromise ??= import("@supabase/supabase-js").then(async (module) => {
      const db = module.createClient(url, anonKey, { auth: { persistSession: true, storageKey: "dormslide-live" } }) as unknown as Client;
      const { data } = await db.auth.getSession();
      if (!data.session) await db.auth.signInAnonymously();
      return db;
    }));

  // 방에 먼저 들어와야(ds_join) 그 방을 읽고 쓸 수 있다. 방마다 한 번만 들어온다.
  const joined = new Map<string, Promise<unknown>>();
  const join = async (room: string): Promise<Client> => {
    const db = await client();
    if (!joined.has(room)) joined.set(room, db.rpc("ds_join", { p_room: room }));
    await joined.get(room);
    return db;
  };

  async function readRoomRows(db: Client, table: "ds_responses" | "ds_board", columns: string, room: string): Promise<unknown[]> {
    const rows: unknown[] = [];
    const pageSize = 1000;
    for (let offset = 0; offset < 100_000; offset += pageSize) {
      const result = await db.from(table).select(columns).eq("room", room).order("created_at", { ascending: true }).order("id", { ascending: true }).range(offset, offset + pageSize - 1);
      if (result.error || !Array.isArray(result.data)) throw new Error("결과를 불러오지 못했어요. 잠시 뒤 다시 눌러 주세요.");
      rows.push(...result.data);
      if (result.data.length < pageSize) return rows;
    }
    throw new Error("결과가 많아 한 번에 받지 못했어요. 각 장의 결과 내려받기를 이용해 주세요.");
  }

  async function loadSurvey(room: string, slide: number, optionCount: number): Promise<SurveySnapshot> {
    const db = await join(room);
    const { data } = await db.from("ds_responses").select("option, text").eq("room", room).eq("slide", slide).order("created_at", { ascending: false }).limit(500);
    const counts = Array.from({ length: optionCount }, () => 0);
    const texts: string[] = [];
    for (const row of (data ?? []) as Array<{ option: number | null; text: string | null }>) {
      if (typeof row.option === "number" && row.option >= 0 && row.option < optionCount) counts[row.option] += 1;
      if (row.text) texts.push(row.text);
    }
    return { counts, texts };
  }

  async function loadBoard(room: string, slide: number): Promise<BoardItem[]> {
    const db = await join(room);
    const { data } = await db.from("ds_board").select("id, nickname, text, url, bucket, likes, created_at").eq("room", room).eq("slide", slide).order("created_at", { ascending: true }).limit(300);
    return ((data ?? []) as Array<{ id: string; nickname: string; text: string; url: string | null; bucket: string | null; likes: number; created_at: string }>).map((row) => ({
      id: row.id,
      nickname: row.nickname,
      text: row.text,
      url: row.url ?? undefined,
      bucket: row.bucket ?? undefined,
      likes: row.likes,
      createdAt: row.created_at,
    }));
  }

  function watch(table: string, room: string, reload: () => void): () => void {
    let stop = () => {};
    void join(room).then((db) => {
      const channel = db
        .channel(`${table}:${room}:${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "*", schema: "public", table, filter: `room=eq.${room}` }, () => reload())
        .subscribe();
      stop = () => void db.removeChannel(channel);
    });
    return () => stop();
  }

  return {
    subscribeSurvey(room, slide, optionCount, on) {
      const reload = () => void loadSurvey(room, slide, optionCount).then(on);
      reload();
      return watch("ds_responses", room, reload);
    },
    async vote(room, slide, option) {
      const db = await join(room);
      await db.rpc("ds_vote", { p_room: room, p_slide: slide, p_option: option });
    },
    async answer(room, slide, text) {
      const db = await join(room);
      await db.from("ds_responses").insert({ room, slide, kind: "text", text: text.slice(0, 400) });
    },
    subscribeBoard(room, slide, on) {
      const reload = () => void loadBoard(room, slide).then(on);
      reload();
      return watch("ds_board", room, reload);
    },
    async post(room, slide, item) {
      const db = await join(room);
      await db.from("ds_board").insert({ room, slide, nickname: item.nickname.slice(0, 20), text: item.text.slice(0, 400), url: item.url ?? null });
    },
    async like(room, slide, itemId) {
      const db = await join(room);
      await db.rpc("ds_like", { p_room: room, p_slide: slide, p_item: itemId });
    },
    async moveBucket(room, slide, itemId, bucket) {
      const db = await join(room);
      await db.rpc("ds_move_bucket", { p_room: room, p_slide: slide, p_item: itemId, p_bucket: bucket.slice(0, 40) });
    },
    async clearRoom(room) {
      const db = await join(room);
      await db.rpc("ds_clear_room", { p_room: room });
    },
    subscribePresenter(room, on) {
      const reload = () =>
        void join(room).then(async (db) => {
          const { data } = await db.from("ds_presenter").select("slide_index").eq("room", room).maybeSingle();
          if (data && typeof (data as { slide_index: number }).slide_index === "number") on((data as { slide_index: number }).slide_index);
        });
      reload();
      return watch("ds_presenter", room, reload);
    },
    async setPresenter(room, index) {
      const db = await join(room);
      await db.rpc("ds_set_presenter", { p_room: room, p_index: index });
    },
    async exportRoom(room) {
      const db = await join(room);
      const owner = await db.rpc("ds_is_presenter", { p_room: room }) as { data?: unknown; error?: unknown };
      if (owner.error || owner.data !== true) throw new Error("발표를 시작한 선생님 화면에서 내려받아 주세요.");
      const [responses, board] = await Promise.all([
        readRoomRows(db, "ds_responses", "slide, kind, option, text, created_at", room),
        readRoomRows(db, "ds_board", "id, slide, nickname, text, url, bucket, likes, created_at", room),
      ]);
      return {
        responses: (responses as Array<{ slide: number; kind: "choice" | "text"; option: number | null; text: string | null; created_at: string }>).map(({ created_at, ...row }) => ({ ...row, createdAt: created_at })),
        board: (board as Array<Omit<RoomResults["board"][number], "createdAt"> & { created_at: string }>).map(({ created_at, ...row }) => ({ ...row, createdAt: created_at })),
      };
    },
  };
}
