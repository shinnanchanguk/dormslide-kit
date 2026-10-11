import { useMemo } from "react";
import QRCode from "qrcode";

/**
 * 주소 하나를 QR 로 그린다.
 *
 * 라이브러리가 만들어 주는 SVG 문자열을 화면에 그대로 꽂지 않고, 칸 배열만 받아
 * 우리가 도형을 그린다. 화면에 넣는 값이 숫자뿐이라 주소에 무엇이 들어와도
 * 글자가 화면 코드로 새어 들어갈 길이 없다.
 *
 * 검정과 흰색만 쓰고 여백을 없애 슬라이드 어디에 놓아도 또렷하게 찍힌다.
 * 주소가 바뀌면 그 자리에서 다시 그리므로 발표 중에 링크를 갈아 끼워도 된다.
 */
export function QrCode({
  value,
  size = 168,
  label,
}: {
  value: string;
  size?: number;
  label?: string;
}) {
  const grid = useMemo(() => {
    try {
      const made = QRCode.create(value, { errorCorrectionLevel: "M" });
      return { count: made.modules.size, cells: made.modules.data as Uint8Array };
    } catch {
      return null;
    }
  }, [value]);

  if (!grid) return <div className="qr" style={{ width: size, height: size }} aria-hidden="true" />;

  // 한 줄에 이어 붙은 검은 칸은 사각형 하나로 묶는다. 도형 수가 줄어 인쇄와 확대가 깔끔하다.
  const runs: { x: number; y: number; w: number }[] = [];
  for (let y = 0; y < grid.count; y += 1) {
    let start = -1;
    for (let x = 0; x <= grid.count; x += 1) {
      const dark = x < grid.count && grid.cells[y * grid.count + x] === 1;
      if (dark && start === -1) start = x;
      if (!dark && start !== -1) {
        runs.push({ x: start, y, w: x - start });
        start = -1;
      }
    }
  }

  return (
    <svg
      className="qr"
      width={size}
      height={size}
      viewBox={`0 0 ${grid.count} ${grid.count}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label ?? `${value} 로 가는 QR 코드`}
      data-test="qr"
    >
      <rect width={grid.count} height={grid.count} fill="#ffffff" />
      {runs.map((run, index) => (
        <rect key={index} x={run.x} y={run.y} width={run.w} height={1} fill="#000000" />
      ))}
    </svg>
  );
}
