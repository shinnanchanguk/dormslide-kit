import type { Platform, World } from "./brain";

/**
 * 도름이가 올라설 수 있는 면. 원고에서 `data-doreumi-platform` 을 달면 그 상자도 발판이 된다.
 * 연표는 동그라미가 달린 상자(__node) 대신 가로선(__line)을 쓴다. 상자 윗변은 선보다 떠 있어서
 * 그 위를 걸으면 허공에 서 있는 것처럼 보인다. 연표 아래 메모 상자(__copy)는 테두리가 있는 카드라 넣는다.
 */
export const PLATFORM_SELECTOR = [
  "[data-doreumi-platform]",
  ".ch-timeline__line",
  ".ch-timeline__copy",
  '[class*="__card"]',
  ".ch-hero__stat",
  ".page-title",
].join(", ");

const MIN_WIDTH = 70;
const ids = new WeakMap<Element, string>();
let nextId = 0;
function keyOf(element: Element) {
  let id = ids.get(element);
  if (!id) {
    id = `p${++nextId}`;
    ids.set(element, id);
  }
  return id;
}

/**
 * 무대 배율과 본문 크기, 발판을 잰다. 좌표는 host(.canvas) 기준 무대 px.
 * clientWidth 는 transform 배율이 걸리지 않은 크기라서 그대로 무대 px 이다.
 */
export function measureWorld(host: HTMLElement, overlay: HTMLElement, headroom: number): World & { scale: number } {
  const rect = host.getBoundingClientRect();
  const width = host.clientWidth;
  const height = host.clientHeight;
  const scale = width > 0 ? rect.width / width : 1;
  const platforms: Platform[] = [];
  for (const element of Array.from(host.querySelectorAll(PLATFORM_SELECTOR))) {
    if (overlay.contains(element)) continue;
    const box = element.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) continue;
    const left = Math.max(0, (box.left - rect.left) / scale);
    const right = Math.min(width, (box.right - rect.left) / scale);
    const top = (box.top - rect.top) / scale;
    // 너무 좁은 상자, 본문 밖(스크롤로 가려진) 상자, 머리가 본문 위로 나가는 높은 상자, 바닥과 겹치는 상자는 뺀다.
    if (right - left < MIN_WIDTH || top < headroom || top > height - 24) continue;
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || Number(style.opacity) === 0) continue;
    const key = keyOf(element);
    // 거의 같은 높이에 겹쳐 있는 상자는 하나로 친다.
    const twin = platforms.find((p) => Math.abs(p.top - top) < 3 && p.left < right && left < p.right);
    if (twin) {
      twin.left = Math.min(twin.left, left);
      twin.right = Math.max(twin.right, right);
      continue;
    }
    platforms.push({ key, left, right, top, floor: false });
  }
  return { width, height, platforms, scale };
}
