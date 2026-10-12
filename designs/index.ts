import type { Design } from "@/runtime/design";
import dormsStory from "./dorms-story";
import simulationBlueprint from "./simulation-blueprint";
import retroWindows from "./retro-windows";

/**
 * 쓸 수 있는 디자인 목록. 새 디자인을 더하면 여기에 한 줄을 더한다(CONTRIBUTING.md).
 * 덱 파일(slides/content.json)의 meta.design 이 이 열쇠 가운데 하나다.
 */
export const DESIGNS: Record<string, Design> = {
  [dormsStory.id]: dormsStory,
  [simulationBlueprint.id]: simulationBlueprint,
  [retroWindows.id]: retroWindows,
};

export const DEFAULT_DESIGN = dormsStory.id;

export function designOf(id: string | undefined): Design {
  return (id && DESIGNS[id]) || DESIGNS[DEFAULT_DESIGN];
}
