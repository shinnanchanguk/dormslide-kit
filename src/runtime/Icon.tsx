/**
 * 화면에 그리는 기호는 전부 이 컴포넌트를 거친다.
 * 이모지·문자 기호는 기기마다 모양과 색이 달라져 쓰지 않는다.
 */
export type IconName =
  | "close"
  | "prev"
  | "first"
  | "toc"
  | "next"
  | "live"
  | "chart"
  | "text"
  | "link"
  | "check"
  | "people"
  | "key"
  | "back"
  | "clock"
  | "play"
  | "pause"
  | "reset"
  | "plus"
  | "trash"
  | "edit"
  | "copy"
  | "sandbox"
  | "terminal"
  | "open"
  | "like"
  | "expand"
  | "grip"
  | "checkbox"
  | "arrow"
  | "download"
  | "thumb"
  | "comment"
  | "lock"
  | "music"
  | "emblem";

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "square" } as const;

const PATHS: Record<IconName, React.ReactNode> = {
  // 그림마다 bbox 중심을 16x16 한가운데(8,8)에 맞춰 좌표를 박았다.
  clock: (
    <g {...STROKE}>
      <circle cx="8" cy="8" r="5.7" />
      <path d="M8 4.6V8l2.5 1.7" />
    </g>
  ),
  play: <path d="M5.4 3.2 12.6 8l-7.2 4.8z" fill="currentColor" />,
  pause: (
    <g fill="currentColor">
      <rect x="4.4" y="3.4" width="2.6" height="9.2" />
      <rect x="9" y="3.4" width="2.6" height="9.2" />
    </g>
  ),
  reset: (
    <g {...STROKE}>
      <path d="M13.2 8a5.2 5.2 0 1 1-1.8-3.9" />
      <path d="M13.4 2.3v3h-3" />
    </g>
  ),
  plus: <path d="M8 3.2v9.6M3.2 8h9.6" {...STROKE} />,
  trash: (
    <g {...STROKE}>
      <path d="M3.4 4.6h9.2" />
      <path d="M6.5 4.6V3.2h3v1.4" />
      <path d="M4.6 4.6v8.2h6.8V4.6" />
    </g>
  ),
  edit: (
    <g {...STROKE}>
      <path d="M10.7 2.6 13.4 5.3 5.9 12.8H3.2v-2.7z" />
      <path d="M9.1 4.2 11.8 6.9" />
    </g>
  ),
  copy: (
    <g {...STROKE}>
      <rect x="5.2" y="4.8" width="7.2" height="8" />
      <path d="M10.8 4.8V3.2H3.6v8h1.6" />
    </g>
  ),
  sandbox: (
    <g {...STROKE}>
      <rect x="2.6" y="3.4" width="10.8" height="9.2" />
      <path d="M2.6 6.3h10.8" />
    </g>
  ),
  terminal: (
    <g {...STROKE}>
      <rect x="2.2" y="3.2" width="11.6" height="9.6" />
      <path d="M4.6 6.2 6.8 8l-2.2 1.8" />
      <path d="M8.4 10h3" />
    </g>
  ),
  open: (
    <g {...STROKE}>
      <path d="M12.6 8.9v3.7H3.4V3.4h3.7" />
      <path d="M9.4 3.4h3.2v3.2" />
      <path d="M12.6 3.4 7.7 8.3" />
    </g>
  ),
  like: (
    <g {...STROKE}>
      <path d="M8 13.1 3.1 8.5a3.2 3.2 0 0 1 4.5-4.6L8 4.3l.4-.4a3.2 3.2 0 0 1 4.5 4.6z" />
    </g>
  ),
  checkbox: <rect x="2.75" y="2.75" width="10.5" height="10.5" {...STROKE} />,
  // 도름스의 공감 표시(도름)와 같은 엄지 모양. 그림 범위 x 2.3~13.7 · y 2.4~13.6 로 가운데에 둔다.
  thumb: (
    <g {...STROKE}>
      <path d="M2.3 7.1h2.6v6.5H2.3z" />
      <path d="M4.9 7.1 7.6 2.4c.9 0 1.6.8 1.5 1.7l-.3 2.3h3.4c.9 0 1.5.8 1.3 1.7l-.9 4.1c-.2.8-.8 1.4-1.6 1.4H4.9" />
    </g>
  ),
  comment: (
    <g {...STROKE}>
      <path d="M2.6 3.15h10.8v7.3H8l-3.1 2.4v-2.4H2.6z" />
    </g>
  ),
  lock: (
    <g {...STROKE}>
      <rect x="3.3" y="6.95" width="9.4" height="6.5" rx="1.2" />
      <path d="M5.4 6.95V5.15a2.6 2.6 0 0 1 5.2 0v1.8" />
    </g>
  ),
  music: (
    <g {...STROKE}>
      <path d="M6.5 11.75V3.85l6.4-1.3v7.8" />
      <circle cx="4.8" cy="11.75" r="1.7" />
      <circle cx="11.2" cy="10.35" r="1.7" />
    </g>
  ),
  // 도름스 엠블럼(소용돌이). 도름스 사이트 Glyphs.tsx 의 DormsEmblemGlyph 나선을 그대로 옮겨 16 칸으로 줄였다.
  // 원본이 24x24 한가운데(12,12)에 맞춰져 있어 줄이면 16x16 한가운데(8,8)에 온다.
  emblem: (
    <g transform="scale(0.666667)" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M 5.51 20.27 L 4.54 18.99 L 3.78 17.58 L 3.25 16.09 L 2.95 14.55 L 2.90 13.00 L 3.09 11.47 L 3.50 10.01 L 4.13 8.63 L 4.95 7.39 L 5.95 6.29 L 7.09 5.37 L 8.35 4.64 L 9.69 4.12 L 11.09 3.82 L 12.49 3.73 L 13.88 3.87 L 15.22 4.21 L 16.48 4.74 L 17.63 5.46 L 18.64 6.33 L 19.50 7.34 L 20.19 8.46 L 20.69 9.66 L 20.99 10.90 L 21.10 12.17 L 21.01 13.42 L 20.74 14.63 L 20.29 15.77 L 19.67 16.81 L 18.91 17.74 L 18.03 18.52 L 17.05 19.16 L 15.99 19.63 L 14.89 19.93 L 13.77 20.05 L 12.66 20.00 L 11.58 19.78 L 10.57 19.40 L 9.63 18.88 L 8.80 18.23 L 8.09 17.47 L 7.52 16.62 L 7.09 15.70 L 6.81 14.74 L 6.68 13.77 L 6.70 12.80 L 6.87 11.86 L 7.18 10.97 L 7.62 10.15 L 8.17 9.42 L 8.82 8.79 L 9.54 8.29 L 10.32 7.90 L 11.14 7.64 L 11.97 7.52 L 12.80 7.53 L 13.60 7.66 L 14.36 7.91 L 15.06 8.27 L 15.68 8.73 L 16.22 9.27 L 16.65 9.87 L 16.98 10.52 L 17.21 11.20 L 17.32 11.89 L 17.32 12.58 L 17.21 13.24 L 17.01 13.87 L 16.72 14.44 L 16.35 14.96 L 15.91 15.39 L 15.43 15.75 L 14.90 16.01 L 14.36 16.19 L 13.80 16.28 L 13.26 16.28 L 12.73 16.19 L 12.24 16.03 L 11.79 15.80 L 11.40 15.51 L 11.07 15.17 L 10.80 14.79 L 10.60 14.39 L 10.48 13.97 L 10.42 13.56 L 10.43 13.15 L 10.51 12.77 L 10.64 12.41 L 10.82 12.09 L 11.04 11.82 L 11.29 11.60 L 11.57 11.43 L 11.85 11.31 L 12.14 11.24 L 12.42 11.23 L 12.69 11.26" />
    </g>
  ),
  arrow: (
    <g {...STROKE}>
      <path d="M2.9 8h10.2M9.4 4.3 13.1 8 9.4 11.7" />
    </g>
  ),
  expand: (
    <g {...STROKE}>
      <path d="M6.2 3H3v3.2M9.8 3H13v3.2M6.2 13H3V9.8M9.8 13H13V9.8" />
    </g>
  ),
  grip: (
    <g fill="currentColor">
      <circle cx="5" cy="4" r="1" />
      <circle cx="11" cy="4" r="1" />
      <circle cx="5" cy="8" r="1" />
      <circle cx="11" cy="8" r="1" />
      <circle cx="5" cy="12" r="1" />
      <circle cx="11" cy="12" r="1" />
    </g>
  ),
  prev: <path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />,
  // 맨 앞으로: 세로 막대 + 왼쪽 꺾쇠. 그림 범위(4.25~11.75, 3.5~12.5)의 가운데가 (8, 8)이다.
  first: <path d="M4.25 3.5v9M11.75 3.5 7.25 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />,
  next: <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />,
  // 목차: 점 세 개 + 줄 세 개. 그림 범위(2.25~13.75, 3.5~12.5)의 가운데가 (8, 8)이다.
  toc: (
    <g>
      <g fill="currentColor">
        <circle cx="3.25" cy="4.5" r="1" />
        <circle cx="3.25" cy="8" r="1" />
        <circle cx="3.25" cy="11.5" r="1" />
      </g>
      <path d="M6 4.5h7M6 8h7M6 11.5h7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </g>
  ),
  live: <circle cx="8" cy="8" r="3.6" fill="currentColor" />,
  chart: (
    <g fill="currentColor">
      <rect x="2.5" y="8.5" width="2.6" height="5" />
      <rect x="6.7" y="4.5" width="2.6" height="9" />
      <rect x="10.9" y="6.8" width="2.6" height="6.7" />
    </g>
  ),
  text: (
    <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square">
      <path d="M2.8 4.2h10.4M2.8 8h10.4M2.8 11.8h6.6" />
    </g>
  ),
  link: (
    <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square">
      <path d="M6.6 9.4 9.4 6.6" />
      <path d="M8.2 4.9 9.6 3.5a2.4 2.4 0 0 1 3.4 3.4l-1.4 1.4" />
      <path d="M7.8 11.1 6.4 12.5a2.4 2.4 0 0 1-3.4-3.4l1.4-1.4" />
    </g>
  ),
  check: <path d="M3 8.4 6.4 11.8 13 5.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />,
  people: (
    <g fill="currentColor">
      <circle cx="5.6" cy="5.6" r="2.3" />
      <circle cx="11" cy="6.4" r="1.8" />
      <path d="M1.4 13.2c0-2.3 1.9-3.7 4.2-3.7s4.2 1.4 4.2 3.7z" />
      <path d="M11 9.7c2 0 3.6 1.2 3.6 3.1v.4h-3.2v-.4c0-1.2-.4-2.3-1.1-3z" />
    </g>
  ),
  key: (
    <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square">
      <circle cx="5.4" cy="5.4" r="2.6" />
      <path d="M7.3 7.3 13 13M10.6 10.6 9.2 12M12 9.2l-1.4 1.4" />
    </g>
  ),
  download: (
    <g {...STROKE}>
      <path d="M8 2.6v7.2" />
      <path d="M5 6.8 8 9.8l3-3" />
      <path d="M3 10.4v3h10v-3" />
    </g>
  ),
  back: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square">
      <path d="M7 3.5 2.5 8 7 12.5" />
      <path d="M2.5 8h11" />
    </g>
  ),
  // 창 닫기. 두 선이 (8,8)에서 만나 위아래·좌우 여백이 같다(3.5).
  close: (
    <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M3.5 3.5 12.5 12.5M12.5 3.5 3.5 12.5" />
    </g>
  ),
};

export function Icon({
  name,
  size = 14,
  label,
}: {
  name: IconName;
  size?: number;
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      style={{ display: "block", flex: "0 0 auto" }}
    >
      {PATHS[name]}
    </svg>
  );
}
