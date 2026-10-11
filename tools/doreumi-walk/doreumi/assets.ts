/** 도름이 자산 위치와 목록. three.js 를 끌어오지 않도록 렌더러와 따로 둔다. */
/**
 * 도름이 그림·모델이 있는 곳. 개발 서버와 배포본은 이 레포의 public/mascot/doreumi 를 쓴다.
 * HTML 한 파일로 저장한 판은 내 컴퓨터 파일을 읽을 수 없어서, 빌드할 때 VITE_DOREUMI_BASE 로 공개 주소를 넣는다.
 */
export const DOREUMI_BASE: string = (import.meta.env.VITE_DOREUMI_BASE as string | undefined) || `${import.meta.env.BASE_URL}mascot/doreumi`;
/** 검토를 통과한 제자리 춤(DoRms motions/registry.json 의 Dancing·stationary) */
export const DOREUMI_DANCES = ["meshy:22", "meshy:591", "meshy:596"] as const;
export const DOREUMI_EXPRESSIONS = ["neutral", "smile", "laugh", "surprise", "cheering", "sparkly", "love", "proud"] as const;
export type DoreumiExpression = (typeof DOREUMI_EXPRESSIONS)[number];
/** 정지 그림(fallback.webp) 크기와 그 안에서 캐릭터가 차지하는 세로 범위 */
export const DOREUMI_FALLBACK = { src: `${DOREUMI_BASE}/fallback.webp`, width: 512, height: 506, top: 54, bottom: 489 } as const;
