/**
 * 계기판 바탕 그림. 원본(시뮬레이션 교육 책의 react-app-32)에서 가져온 원형 뷰포트 · 눈금 고리 · 빗금 띠 ·
 * 방사선 · 별자리 점을 슬라이드 무대(1280x720)에 맞게 다시 놓았다. 글자 뒤에 옅게 깔리고, 고리 하나만 천천히 돈다.
 */
const RADIAL = [15, 30, 45, 60, 75, 105, 120, 135, 150, 165];
const STARS: Array<[number, number, number]> = [
  [120, -150, 2], [180, -100, 2.5], [250, -180, 1.5], [150, -250, 3], [-150, 120, 2], [-220, 80, 1.5], [-280, 190, 2.5], [-100, 220, 2], [20, 180, 2], [-40, 250, 2], [80, 290, 2.5],
];

export function BlueprintBackdrop() {
  return (
    <svg className="bp-backdrop" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="bp-hatch" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(226,232,240,0.22)" strokeWidth="1" />
        </pattern>
        <clipPath id="bp-ring-clip">
          <path d="M 0 -380 A 380 380 0 1 1 -0.1 -380 L 0 -362 A 362 362 0 1 0 0.1 -362 Z" />
        </clipPath>
      </defs>
      <g className="bp-backdrop__persp">
        <line x1="0" y1="80" x2="250" y2="170" />
        <line x1="0" y1="640" x2="250" y2="560" />
        <line x1="1280" y1="80" x2="1030" y2="170" />
        <line x1="1280" y1="640" x2="1030" y2="560" />
      </g>
      <g transform="translate(1090, 360)" className="bp-backdrop__ring">
        <circle r="398" className="bp-thin" />
        <circle r="390" className="bp-mid" />
        <path d="M 0 -380 A 380 380 0 1 1 -0.1 -380 Z" fill="url(#bp-hatch)" clipPath="url(#bp-ring-clip)" />
        <circle r="362" className="bp-strong" />
        <circle r="354" className="bp-thin" />
        <g className="bp-backdrop__spin">
          <circle r="372" className="bp-ticks" />
          <circle r="300" className="bp-dash" />
        </g>
        <g className="bp-thin">
          {RADIAL.map((deg) => (
            <line key={deg} x1="0" y1="-340" x2="0" y2="340" transform={`rotate(${deg})`} />
          ))}
        </g>
        <circle r="240" className="bp-thin" />
        <circle r="140" className="bp-thin" />
        <g className="bp-stars">
          {STARS.map(([x, y, r], index) => (
            <circle key={index} cx={x} cy={y} r={r} />
          ))}
        </g>
        <g className="bp-reticle">
          <circle r="14" />
          <circle r="4" className="bp-fill" />
          <line x1="-28" y1="0" x2="-18" y2="0" />
          <line x1="18" y1="0" x2="28" y2="0" />
          <line x1="0" y1="-28" x2="0" y2="-18" />
          <line x1="0" y1="18" x2="0" y2="28" />
        </g>
      </g>
    </svg>
  );
}
