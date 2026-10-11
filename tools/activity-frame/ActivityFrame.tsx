import { strictPublicWebUrl } from "@/lib/safe-url";

/**
 * 다른 곳의 수업 화면(매쓰매쓰 수업·모란 활동·내가 만든 웹앱)을 슬라이드 안에 띄운다.
 * 격리된 액자(sandbox)라 그 화면이 이 슬라이드를 건드리지 못한다. 안 뜨는 사이트는 [새 창으로 열기] 를 쓴다.
 */
export function ActivityFrameTool({ config }: { config?: Record<string, unknown> }) {
  const url = strictPublicWebUrl(String(config?.url ?? ""));
  const title = String(config?.title ?? "수업 화면");
  if (!url) return <p className="tool-missing">띄울 주소(config.url)가 비어 있거나 https 주소가 아니에요.</p>;
  return (
    <div className="ds-frame">
      <iframe src={url} title={title} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerPolicy="no-referrer" loading="lazy" />
      <a className="ds-frame__open" href={url} target="_blank" rel="noreferrer noopener">새 창으로 열기</a>
    </div>
  );
}
