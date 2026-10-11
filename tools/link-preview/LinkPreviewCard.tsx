import { strictInternalImagePath, strictPublicWebUrl } from "@/lib/safe-url";

/**
 * 링크 미리보기 카드. 제목·설명·그림은 슬라이드를 만들 때 AI 가 그 페이지에서 읽어 와 덱에 적어 둔다.
 * 그래서 발표 중에 바깥 사이트에 묻지 않고, 인터넷이 끊겨도 카드가 그대로 보인다.
 */
export type LinkPreview = { url: string; title?: string; description?: string; image?: string; site?: string };

export function LinkPreviewCard({ preview }: { preview: LinkPreview }) {
  const url = strictPublicWebUrl(preview.url);
  if (!url) return null;
  const image = preview.image ? strictInternalImagePath(preview.image) : null;
  const site = preview.site || new URL(url).hostname.replace(/^www\./, "");
  return (
    <a className="ds-linkcard" href={url} target="_blank" rel="noreferrer noopener">
      {image ? <img src={image} alt="" /> : null}
      <span className="ds-linkcard__copy">
        <span className="ds-linkcard__site">{site}</span>
        <strong>{preview.title || site}</strong>
        {preview.description ? <span className="ds-linkcard__desc">{preview.description}</span> : null}
      </span>
    </a>
  );
}
