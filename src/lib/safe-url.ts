const WEB_PROTOCOLS = new Set(["http:", "https:"]);

export function strictWebUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw.trim());
    if (!WEB_PROTOCOLS.has(parsed.protocol) || !parsed.hostname) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** 발표 자료의 외부 근거 링크는 공개 HTTPS 주소만 허용한다. */
export function strictPublicWebUrl(raw: string): string | null {
  const parsed = strictWebUrl(raw);
  if (!parsed) return null;

  const url = new URL(parsed);
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const ipv4Literal = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
  const localName =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal");

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    ipv4Literal ||
    hostname.startsWith("[") ||
    localName
  ) {
    return null;
  }
  return parsed;
}

export function normalizedWebUrl(raw: string): string | null {
  const trimmed = raw.trim();
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = strictWebUrl(candidate);
  if (!parsed) return null;
  try {
    const hostname = new URL(parsed).hostname.toLowerCase().replace(/\.$/, "");
    const ipv4Literal = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
    const localName = hostname === "localhost" || hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") || hostname.endsWith(".internal");
    // 학생 링크가 교사 브라우저를 내부망 관리 화면으로 유도하지 않게 한다.
    if (ipv4Literal || hostname.startsWith("[") || localName) return null;
    return hostname.includes(".") ? parsed : null;
  } catch {
    return null;
  }
}

/** MORAN이 발급한 계정 없는 체험 링크만 허용한다. */
export function strictMoranQuickUrl(raw: string): string | null {
  const normalized = strictWebUrl(raw);
  if (!normalized) return null;
  const parsed = new URL(normalized);
  if (parsed.protocol !== "https:") return null;
  if (!["moran.school", "www.moran.school"].includes(parsed.hostname.toLowerCase())) return null;
  if (parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash) return null;
  if (!/^\/[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(parsed.pathname)) return null;
  return parsed.toString();
}

/**
 * 덱에 적는 그림 경로. 이 레포의 public/ 아래 그림(/samples/…, /slides/…, /assets/…)과,
 * HTML 한 파일로 저장할 때 그림 자체로 바뀐 data: 주소만 받는다. 바깥 주소 그림은 받지 않는다.
 * 돌려주는 값은 화면이 바로 쓸 수 있게 배포 위치(BASE_URL)를 붙인 주소다.
 */
export function strictInternalImagePath(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^data:image\/(?:png|jpeg|webp|gif|svg\+xml|avif);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) return trimmed;
  if (!/^\/(?:decks|samples|slides|assets)\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)*\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(trimmed)) {
    return null;
  }
  if (trimmed.includes("..")) return null;
  return assetUrl(trimmed);
}

/** "/samples/a.svg" 같은 레포 안 경로에 배포 위치를 붙인다. */
export function assetUrl(rooted: string): string {
  const base = (import.meta.env?.BASE_URL as string | undefined) ?? "/";
  return `${base.endsWith("/") ? base : `${base}/`}${rooted.replace(/^\//, "")}`;
}

/** 앱이 직접 서빙하는 덱 안내서(.md)만 내려받기 단추에 건다. 바깥 주소는 버린다. */
export function strictInternalDocPath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^\/decks\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)+\.(?:md|pdf)$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * 조회할 때 서명 주소로 바뀐 안내서. 화면은 이 모양만 받는다.
 *
 * 경로는 세그먼트 단위로 본다. `%2f` 로 구분자를 숨기거나 `..`·연속 점으로 위로 올라가는
 * 모양을 통과시키지 않는다. 쿼리도 `exp`·`sig` 둘만 있어야 한다.
 */
export function strictSignedDeckDocPath(raw: string): string | null {
  const trimmed = raw.trim();
  if (/%2f|%2e|%5c/i.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed, "https://dormslide.invalid");
    if (parsed.origin !== "https://dormslide.invalid" || parsed.hash) return null;

    const segments = parsed.pathname.split("/");
    if (segments.shift() !== "") return null;
    if (segments.shift() !== "api" || segments.shift() !== "deck") return null;
    const slug = segments.shift() ?? "";
    if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(slug)) return null;
    if (segments.shift() !== "asset" || segments.shift() !== "decks") return null;
    if (segments.length < 1) return null;
    const last = (segments[segments.length - 1] ?? "").toLowerCase();
    if (!last.endsWith(".md") && !last.endsWith(".pdf")) return null;
    if (!segments.every((segment) => /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(segment))) {
      return null;
    }

    const keys = [...parsed.searchParams.keys()];
    if (keys.length !== 2 || !keys.includes("exp") || !keys.includes("sig")) return null;
    if (!/^\d{10}$/.test(parsed.searchParams.get("exp") ?? "")) return null;
    if (!/^[A-Za-z0-9_-]{43}$/.test(parsed.searchParams.get("sig") ?? "")) return null;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}
/** 서버가 수업별로 발급한 짧은 만료·서명 이미지 경로만 화면에 그린다. */
export function strictSignedDeckImagePath(raw: string): string | null {
  const trimmed = raw.trim();
  try {
    const parsed = new URL(trimmed, "https://dormslide.invalid");
    if (parsed.origin !== "https://dormslide.invalid" || parsed.hash) return null;
    if (
      !/^\/api\/deck\/[a-z0-9][a-z0-9-]{1,59}\/asset\/(?:decks|restricted\/lesson-content\/decks)\/[A-Za-z0-9_%./-]+$/i.test(
        parsed.pathname,
      )
    ) {
      return null;
    }
    if (!/^\d{10}$/.test(parsed.searchParams.get("exp") ?? "")) return null;
    if (!/^[A-Za-z0-9_-]{43}$/.test(parsed.searchParams.get("sig") ?? "")) return null;
    if ([...parsed.searchParams.keys()].sort().join(",") !== "exp,sig") return null;
    return `${parsed.pathname}?${parsed.searchParams}`;
  } catch {
    return null;
  }
}

/** 관리자 편집기의 쿠키 보호 미리보기 경로. 저장용 payload에는 넣지 않는다. */
export function strictAdminDeckImagePath(raw: string): string | null {
  const trimmed = raw.trim();
  return /^\/api\/admin\/decks\/[a-z0-9][a-z0-9-]{1,59}\/asset\/(?:decks|restricted\/lesson-content\/decks)\/[A-Za-z0-9_%./-]+$/i.test(
    trimmed,
  )
    ? trimmed
    : null;
}
