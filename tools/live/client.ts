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
 * 수업 방 이름. 주소의 ?room= 값이 있으면 그것을 쓴다. 없으면 발표자가 [발표 시작] 을 누를 때 무작위로 만든다
 * (예: ds-k3x9-2m7q). 이름을 아는 사람만 들어오도록, 학생에게는 링크 공유(QR)로 그 방 주소를 보낸다.
 */
let roomName = "";
export const ROOM_RE = /^[a-z0-9-]{6,60}$/;
export function setLiveRoom(name: string | null) {
  roomName = name && ROOM_RE.test(name) ? name : "";
}
export function liveRoom() {
  return roomName;
}
export function newRoomName() {
  const part = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (byte) => "abcdefghjkmnpqrstuvwxyz23456789"[byte % 31]).join("");
  return `ds-${part()}-${part()}`;
}
