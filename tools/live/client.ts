/**
 * 실시간 모드의 연결. 선생님 본인의 수파베이스(무료)를 쓴다. 도름스 서버에는 아무것도 보내지 않는다.
 *
 * 켜는 법(AGENTS.md 「실시간 기능」):
 *   1) 내 수파베이스 프로젝트에 supabase/schema.sql 을 실행한다.
 *   2) .env.local 에 VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY 를 적는다.
 *   3) slides/content.json 의 meta.live 를 true 로 바꾼다.
 * 셋 중 하나라도 없으면 null 을 돌려주고, 도구들은 '혼자 보는 판'으로 돈다.
 */
import type { LiveClient } from "./types";
import { createSupabaseLive } from "./supabase";

let cached: LiveClient | null | undefined;
let enabledByDeck = false;

export function setLiveEnabled(enabled: boolean) {
  if (enabledByDeck !== enabled) cached = undefined;
  enabledByDeck = enabled;
}

export function liveClient(): LiveClient | null {
  if (cached !== undefined) return cached;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  cached = enabledByDeck && url && key ? createSupabaseLive(url, key) : null;
  return cached;
}

/**
 * 수업 방 이름. 주소의 ?room= 값이 있으면 그것을, 없으면 덱 제목에서 만든 기본값을 쓴다.
 * 같은 슬라이드로 여러 반을 하면 반마다 ?room=1반 처럼 다른 방을 쓰면 된다.
 */
let roomName = "class";
export function setLiveRoom(name: string) {
  roomName = name.slice(0, 60) || "class";
}
export function liveRoom() {
  return roomName;
}
