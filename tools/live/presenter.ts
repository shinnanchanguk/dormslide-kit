/** 이 브라우저가 발표자일 때 쓰는 열쇠. 처음 '발표자 되기'를 누른 브라우저에 만들어 두고, 그 방의 주인이 된다. */
const KEY = "dormslide:presenter-key";

export function presenterKey(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && saved.length >= 32) return saved;
    const fresh = Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    return "presenter-key-unavailable-in-this-browser";
  }
}
