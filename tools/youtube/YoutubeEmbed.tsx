/** 유튜브 주소를 슬라이드 안에서 바로 재생되는 화면으로 바꾼다. 개인정보 보호 모드(youtube-nocookie)를 쓴다. */
export function youtubeId(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return /^[\w-]{11}$/.test(url.pathname.slice(1)) ? url.pathname.slice(1) : null;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const v = url.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) return v;
      const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/);
      return match ? match[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function YoutubeEmbed({ url, title }: { url: string; title: string }) {
  const id = youtubeId(url);
  if (!id) return null;
  return (
    <div className="ds-youtube">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title={`${title} 영상`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
}
