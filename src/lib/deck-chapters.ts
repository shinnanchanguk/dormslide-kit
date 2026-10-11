/**
 * 지금 장이 어느 챕터에 속하는지. 가장 가까운 앞쪽 챕터 표지(ch-divider)의 머리말을 쓴다.
 * 챕터 표지가 없는 덱은 null 이라, 무대 오른쪽 위에는 원래대로 발표 날짜가 남는다.
 */
export function chapterLabelAt(slides: readonly { kind: string; payload: unknown }[], index: number): string | null {
  for (let cursor = Math.min(index, slides.length - 1); cursor >= 0; cursor -= 1) {
    const slide = slides[cursor];
    const payload = slide?.payload as { layout?: unknown; eyebrow?: unknown } | undefined;
    if (slide?.kind === "BODY" && payload?.layout === "ch-divider" && typeof payload.eyebrow === "string") {
      return payload.eyebrow;
    }
  }
  return null;
}
