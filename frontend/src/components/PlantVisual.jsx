// Shared "growth plant" visuals used by both the Dashboard hero and the Bloom
// Garden. Each day becomes one potted plant whose bloom stage is derived from
// that day's goal completion, and whose colour reflects sobriety (a relapsed
// day recolours the whole plant brown/wilted).

// One day's palette + tier, derived from that day's sobriety and goal %.
//   Sobriety -> color:  clean = green, relapse = brown/wilted (whole plant recolors)
//   Goal %   -> shape:  <50% bare · 50-74% leaves · 75-99% half bloom · 100% full bloom
export function daySegmentStyle(day) {
  const relapsed = !!day.relapsed;
  const pct = day.goal_pct || 0;
  const tier = pct >= 1 ? 'full' : pct >= 0.75 ? 'half' : pct >= 0.5 ? 'leaves' : 'bare';
  return {
    tier,
    relapsed,
    stemColor: relapsed ? '#9c7a52' : 'var(--accent-goals)',
    leafColor: relapsed ? '#a68a63' : 'var(--accent-goals)',
    flowerColor: relapsed ? '#c1a67d' : 'var(--accent-mood)',
    flowerCenter: relapsed ? '#7a6249' : 'var(--text-primary)',
    opacity: relapsed ? 0.65 : 1,       // wilt = fade
    droop: relapsed ? 3 : 0,            // wilt = sag downward
    bloomAnim: relapsed ? 'none' : 'gentlePulse 2s ease-in-out infinite',
  };
}

// A small radial flower built from N petals around a center.
export function Flower({ cx, cy, petals, petalLen, petalW, color, centerColor, centerR, opacity, anim }) {
  return (
    <g opacity={opacity} style={{ transformOrigin: `${cx}px ${cy}px`, animation: anim }}>
      {Array.from({ length: petals }).map((_, p) => {
        const angle = (360 / petals) * p;
        return (
          <ellipse
            key={p}
            cx={cx} cy={cy - petalLen / 2}
            rx={petalW / 2} ry={petalLen / 2}
            fill={color} fillOpacity="0.92"
            transform={`rotate(${angle} ${cx} ${cy})`}
          />
        );
      })}
      <circle cx={cx} cy={cy} r={centerR} fill={centerColor} />
    </g>
  );
}

export const WEEKDAY_FMT = new Intl.DateTimeFormat(undefined, { weekday: 'short' });

// A single pointed leaf drawn pointing straight up from its base (0,0) to its
// tip (0,-len); callers rotate/translate it onto the stem so leaves fan out.
function leafPath(len, wid) {
  return `M 0 0 C ${-wid} ${-len * 0.35} ${-wid * 0.55} ${-len * 0.85} 0 ${-len} C ${wid * 0.55} ${-len * 0.85} ${wid} ${-len * 0.35} 0 0 Z`;
}

// Where each of the two blossoms sits, and where its pedicel (little branch)
// meets the main stem. Kept as shared anchors so buds / half / full blooms all
// attach to the stem instead of floating in mid-air.
const LEFT_BLOOM = { x: 31, y: 46, from: { x: 50, y: 64 } };
const RIGHT_BLOOM = { x: 69, y: 39, from: { x: 50, y: 56 } };

// Leaves climbing the stem: biggest near the soil, tapering toward the crown.
const LEAVES = [
  { x: 50, y: 104, angle: -58, len: 26, wid: 13 },
  { x: 50, y: 90, angle: 58, len: 26, wid: 13 },
  { x: 50, y: 78, angle: -52, len: 22, wid: 11 },
  { x: 50, y: 68, angle: 52, len: 20, wid: 10 },
  { x: 50, y: 60, angle: -46, len: 16, wid: 8 },
];

// One day's own potted plant: curved stem + 5 leaves + 2 blossoms on pedicels.
// `size` scales the rendered SVG (the viewBox is fixed at 100x144).
export function DayPlant({ day, size = 78 }) {
  const s = daySegmentStyle(day);
  const CX = 50, SOIL_Y = 116, STEM_TOP = 52;

  const showLeaves = s.tier !== 'bare';
  const showBuds = s.tier === 'leaves';
  const showHalf = s.tier === 'half';
  const showFull = s.tier === 'full';
  const droop = s.droop;

  // Pedicel: a gentle curve from the stem out to a blossom/bud.
  const pedicel = (b) =>
    `M ${b.from.x} ${b.from.y} Q ${(b.from.x + b.x) / 2} ${b.y + droop} ${b.x} ${b.y + droop}`;

  return (
    <svg width={size} height={size * (144 / 100)} viewBox="0 0 100 144" style={{ overflow: 'visible' }}>
      {/* Soil + Pot */}
      <ellipse cx={CX} cy={SOIL_Y + 2} rx="24" ry="6.5" fill="#6b4f3a" />
      <path
        d={`M ${CX - 18} ${SOIL_Y + 2} L ${CX + 18} ${SOIL_Y + 2} L ${CX + 14} ${SOIL_Y + 24} L ${CX - 14} ${SOIL_Y + 24} Z`}
        fill="#c98a63" stroke="var(--accent-mood)" strokeWidth="1.8"
      />
      <line x1={CX - 21} y1={SOIL_Y + 2} x2={CX + 21} y2={SOIL_Y + 2} stroke="var(--accent-mood)" strokeWidth="2.4" strokeLinecap="round" />

      <g style={{ transition: 'all 0.5s ease-out' }} opacity={s.opacity}>
        {/* Main stem */}
        <path
          d={`M ${CX} ${SOIL_Y} C ${CX + 8} ${SOIL_Y - 24} ${CX - 8} ${STEM_TOP + 26} ${CX} ${STEM_TOP}`}
          fill="none" stroke={s.stemColor} strokeWidth="3.4" strokeLinecap="round"
        />

        {/* Leaves (50%+) */}
        {showLeaves && LEAVES.map((lf, i) => (
          <path
            key={i}
            d={leafPath(lf.len, lf.wid)}
            fill={s.leafColor} fillOpacity="0.9" stroke={s.leafColor} strokeWidth="1"
            transform={`translate(${lf.x} ${lf.y + droop}) rotate(${lf.angle})`}
          />
        ))}

        {/* Pedicels: drawn for any state that carries a bud or bloom so the
            blossoms visibly branch off the stem rather than float. */}
        {(showBuds || showHalf || showFull) && (
          <>
            <path d={pedicel(LEFT_BLOOM)} fill="none" stroke={s.stemColor} strokeWidth="2" strokeLinecap="round" />
            <path d={pedicel(RIGHT_BLOOM)} fill="none" stroke={s.stemColor} strokeWidth="2" strokeLinecap="round" />
          </>
        )}

        {/* Closed buds (50-74%) — not blooming yet */}
        {showBuds && (
          <>
            <ellipse cx={LEFT_BLOOM.x} cy={LEFT_BLOOM.y + droop} rx="3.2" ry="5" fill={s.flowerColor} transform={`rotate(-18 ${LEFT_BLOOM.x} ${LEFT_BLOOM.y + droop})`} />
            <ellipse cx={RIGHT_BLOOM.x} cy={RIGHT_BLOOM.y + droop} rx="3.2" ry="5" fill={s.flowerColor} transform={`rotate(18 ${RIGHT_BLOOM.x} ${RIGHT_BLOOM.y + droop})`} />
          </>
        )}

        {/* Half bloom (75-99%) — two opening, 5-petal flowers */}
        {showHalf && (
          <>
            <Flower cx={LEFT_BLOOM.x} cy={LEFT_BLOOM.y + droop} petals={5} petalLen={11} petalW={6.5} color={s.flowerColor} centerColor={s.flowerCenter} centerR={3.2} opacity={s.opacity} anim={s.bloomAnim} />
            <Flower cx={RIGHT_BLOOM.x} cy={RIGHT_BLOOM.y + droop} petals={5} petalLen={11} petalW={6.5} color={s.flowerColor} centerColor={s.flowerCenter} centerR={3.2} opacity={s.opacity} anim={s.bloomAnim} />
          </>
        )}

        {/* Full bloom (100%) — two fuller, 6-petal flowers */}
        {showFull && (
          <>
            <Flower cx={LEFT_BLOOM.x} cy={LEFT_BLOOM.y + droop} petals={6} petalLen={14} petalW={8} color={s.flowerColor} centerColor={s.flowerCenter} centerR={4} opacity={s.opacity} anim={s.bloomAnim} />
            <Flower cx={RIGHT_BLOOM.x} cy={RIGHT_BLOOM.y + droop} petals={6} petalLen={14} petalW={8} color={s.flowerColor} centerColor={s.flowerCenter} centerR={4} opacity={s.opacity} anim={s.bloomAnim} />
          </>
        )}
      </g>
    </svg>
  );
}

// One pot per weekday, Monday -> today, each with its own bloom stage & colors.
export function SproutGrowthVisual({ weekPlant = [] }) {
  if (weekPlant.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
        <DayPlant day={{ tier: 'bare' }} />
      </div>
    );
  }

  return (
    <>
      {weekPlant.map((day, i) => {
        const isToday = i === weekPlant.length - 1;
        return (
          <div
            key={day.date}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
          >
            <DayPlant day={day} />
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: isToday ? 800 : 600,
                color: isToday ? 'var(--accent-goals)' : 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {WEEKDAY_FMT.format(new Date(day.date))}
            </span>
          </div>
        );
      })}
    </>
  );
}
