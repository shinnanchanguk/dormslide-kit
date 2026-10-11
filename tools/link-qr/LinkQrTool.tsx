import { strictPublicWebUrl } from "@/lib/safe-url";
import { QrCode } from "@/runtime/QrCode";

/** 주소 하나를 큰 단추와 QR 그림으로 보여 준다. 학생이 휴대폰으로 찍어 들어오게 할 때 쓴다. */
export function LinkQrTool({ config }: { config?: Record<string, unknown> }) {
  const url = strictPublicWebUrl(String(config?.url ?? ""));
  const label = String(config?.label ?? "여기로 들어오세요");
  if (!url) return <p className="tool-missing">링크 주소(config.url)가 비어 있거나 https 주소가 아니에요.</p>;
  return (
    <div className="ds-linkqr">
      <QrCode value={url} size={220} label={`${label} QR 코드`} />
      <div className="ds-linkqr__copy">
        <strong>{label}</strong>
        <a href={url} target="_blank" rel="noreferrer noopener">{url.replace(/^https:\/\//, "")}</a>
      </div>
    </div>
  );
}
