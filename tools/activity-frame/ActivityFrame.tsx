import { strictPublicWebUrl } from "@/lib/safe-url";

const SAME_DECK = /^\.\/\?(?:demo|visual|sample|design)=[a-z0-9-]{1,60}(?:&(?:demo|visual|sample|design|embed)=[a-z0-9-]{1,60}){0,3}$/;

/**
 * 다른 곳의 수업 화면(매쓰매쓰 수업·모란 활동·내가 만든 웹앱)을 슬라이드 안에 띄운다.
 * 격리된 액자(sandbox)라 그 화면이 이 슬라이드를 건드리지 못한다. 안 뜨는 사이트는 [새 창으로 열기] 를 쓴다.
 */
export function ActivityFrameTool({ config }: { config?: Record<string, unknown> }) {
  const raw = String(config?.url ?? "");
  // 같은 덱 안의 다른 예시 화면(./?demo=… 처럼 이 사이트 안 주소)도 띄울 수 있다. 미리보기 사이트 주소를 덱에 박지 않으려는 것.
  const url = SAME_DECK.test(raw) ? raw : strictPublicWebUrl(raw);
  const title = String(config?.title ?? "수업 화면");
  if (!url) return <p className="tool-missing">띄울 주소(config.url)가 비어 있거나 https 주소가 아니에요.</p>;
  return (
    <div className="ds-frame">
      <iframe src={url} title={title} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerPolicy="no-referrer" loading="lazy" />
      <a className="ds-frame__open" href={url} target="_blank" rel="noreferrer noopener">새 창으로 열기</a>
    </div>
  );
}
