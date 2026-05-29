// components/shared.jsx — shared UI primitives + icons + cue:creative brand assets

import React from 'react'

const Icon = ({ name, size = 16, stroke = 1.6, style }) => {
  const s = { width: size, height: size, ...style };
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round", style: s };
  switch (name) {
    case 'avatars':   return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>;
    case 'chat':      return <svg {...common}><path d="M4 5h16v11H8l-4 4z"/></svg>;
    case 'studio':    return <svg {...common}><rect x="3" y="6" width="14" height="12" rx="2"/><path d="m17 10 4-2v8l-4-2z"/></svg>;
    case 'onboard':   return <svg {...common}><path d="M12 16V4"/><path d="m6 10 6-6 6 6"/><path d="M4 20h16"/></svg>;
    case 'settings':  return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
    case 'search':    return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>;
    case 'plus':      return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case 'play':      return <svg {...common} fill="currentColor" stroke="none"><path d="M7 5v14l12-7z"/></svg>;
    case 'pause':     return <svg {...common} fill="currentColor" stroke="none"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>;
    case 'mic':       return <svg {...common}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 19v3"/></svg>;
    case 'cam':       return <svg {...common}><rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3z"/></svg>;
    case 'upload':    return <svg {...common}><path d="M12 16V4"/><path d="m6 10 6-6 6 6"/><path d="M4 20h16"/></svg>;
    case 'check':     return <svg {...common}><path d="M5 13l4 4L19 7"/></svg>;
    case 'send':      return <svg {...common}><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>;
    case 'sparkle':   return <svg {...common}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>;
    case 'more':      return <svg {...common}><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></svg>;
    case 'arrow-r':   return <svg {...common}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case 'arrow-l':   return <svg {...common}><path d="M19 12H5M11 5l-7 7 7 7"/></svg>;
    case 'close':     return <svg {...common}><path d="M6 6l12 12M18 6 6 18"/></svg>;
    case 'doc':       return <svg {...common}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>;
    case 'download':  return <svg {...common}><path d="M12 4v12"/><path d="m6 10 6 6 6-6"/><path d="M4 20h16"/></svg>;
    case 'globe':     return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18"/></svg>;
    case 'shield':    return <svg {...common}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>;
    case 'sliders':   return <svg {...common}><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h14M18 18h2"/><circle cx="16" cy="6" r="2" fill="currentColor"/><circle cx="8" cy="12" r="2" fill="currentColor"/><circle cx="16" cy="18" r="2" fill="currentColor"/></svg>;
    case 'history':   return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/></svg>;
    case 'lang':      return <svg {...common}><path d="m3 5 8-3 8 3-8 3-8-3z"/><path d="M3 5v6c0 4 4 7 8 8 4-1 8-4 8-8V5"/></svg>;
    default:          return <svg {...common}><circle cx="12" cy="12" r="9"/></svg>;
  }
};

/* ============================================================
 * CueLogo — the "C with !" mark from the brand sheet.
 * sizes: sm (24), md (36), lg (72)
 * ============================================================ */
const CueLogo = ({ size = 36, mono = false }) => {
  const c = mono ? 'currentColor' : '#8b1f1f';
  const y = mono ? 'currentColor' : '#f0b226';
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-label="cue:creative">
      {/* outer C ring */}
      <path
        d="M 88 28
           A 42 36 0 1 0 88 72
           L 78 64
           A 28 24 0 1 1 78 36 Z"
        fill={c}
      />
      {/* swoosh/tail */}
      <path
        d="M 72 60 Q 60 78 38 72 Q 56 70 68 56 Z"
        fill={c}
      />
      {/* exclamation bar */}
      <rect x="45" y="32" width="11" height="26" rx="2" fill={y}
        style={{ transform: 'rotate(-8deg)', transformOrigin: '50px 45px' }} />
      {/* exclamation dot */}
      <circle cx="51" cy="65" r="5.5" fill={y} />
    </svg>
  );
};

/* ============================================================
 * Wordmark — "cue:creative" with optional tagline
 * ============================================================ */
const Wordmark = ({ tagline = false, size = 19 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
    <span className="brand-word" style={{ fontSize: size }}>
      cue<span className="colon">:</span><span className="creative">creative</span>
    </span>
    {tagline && <span className="brand-tag">marketing and advertising</span>}
  </div>
);

/* ============================================================
 * EqualizerBars — the brand's signature equalizer motif.
 * Used as the avatar "speaking" indicator and as hero art.
 * `live` animates the bars; otherwise renders static.
 * `variant`: 'inline' (small live indicator) | 'hero' (large art)
 * ============================================================ */
const EQ_COLORS = ['#8b1f1f', '#f0b226', '#e15e3e', '#9cb833', '#a3c5cc', '#3b4e63', '#9ca697', '#c5cccb', '#e2e5dd', '#b22e2e'];

const EqualizerBars = ({ live = false, variant = 'inline', count = 14, style }) => {
  if (variant === 'hero') {
    // Layered, overlapping vertical bars — based on the brand asset
    const bars = [
      { x: 8,  w: 14, top: 22, h: 56, c: '#e15e3e' },
      { x: 18, w: 11, top: 12, h: 74, c: '#c5cccb' },
      { x: 28, w: 10, top: 28, h: 52, c: '#f0b226', a: 0.85 },
      { x: 37, w: 13, top: 14, h: 70, c: '#8b1f1f' },
      { x: 48, w: 18, top: 24, h: 56, c: '#e2e5dd' },
      { x: 60, w: 14, top: 18, h: 64, c: '#f0b226' },
      { x: 72, w: 12, top: 8,  h: 84, c: '#3b4e63', a: 0.85 },
      { x: 82, w: 13, top: 20, h: 60, c: '#9cb833' },
      { x: 92, w: 11, top: 6,  h: 88, c: '#6e1717' },
      { x: 100,w: 13, top: 28, h: 52, c: '#e15e3e' },
    ];
    return (
      <svg viewBox="0 0 116 100" style={{ width: '100%', height: '100%', ...style }} preserveAspectRatio="xMidYMid meet">
        {bars.map((b, i) => (
          <rect key={i} x={b.x} y={b.top} width={b.w} height={b.h} fill={b.c} opacity={b.a || 1} />
        ))}
      </svg>
    );
  }
  // inline animated bars
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 24, ...style }}>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} style={{
          width: 3,
          background: EQ_COLORS[i % EQ_COLORS.length],
          height: live ? '100%' : '30%',
          animation: live ? `eqbar ${0.5 + (i % 5) * 0.13}s ease-in-out ${i * 0.04}s infinite alternate` : 'none',
          borderRadius: 1
        }} />
      ))}
      <style>{`@keyframes eqbar { from { height: 18%; } to { height: 100%; } }`}</style>
    </div>
  );
};

const Placeholder = ({ label, style, children }) => (
  <div className="stripe-ph" style={{ width: '100%', height: '100%', ...style }}>
    {children}
    {label && <span className="ph-label">{label}</span>}
  </div>
);

/* ============================================================
 * AvatarTile — avatar video poster using the cue:creative palette.
 * Each avatar gets a stable color from the brand palette.
 * ============================================================ */
const AVATAR_PALETTES = [
  { bg: '#8b1f1f', fg: '#f0b226', tag: '#e2e5dd' },  // maroon + gold
  { bg: '#3b4e63', fg: '#a3c5cc', tag: '#e2e5dd' },  // navy + teal
  { bg: '#1e2330', fg: '#f0b226', tag: '#e15e3e' },  // charcoal + gold
  { bg: '#6e1717', fg: '#e2e5dd', tag: '#f0b226' },  // dark maroon + cream
  { bg: '#9cb833', fg: '#1e2330', tag: '#e2e5dd' },  // olive + charcoal
  { bg: '#e15e3e', fg: '#1e2330', tag: '#f0b226' },  // coral + charcoal
];

const paletteForId = (id) => {
  const idx = id.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[idx];
};

const AvatarTile = ({ avatar, size = 'md', playing }) => {
  // 3-letter monogram: first letter of first name + first two letters of last name
  const parts = avatar.contact.split(' ');
  const initials = (parts[0]?.[0] || '') + (parts[parts.length - 1] || '').slice(0, 2);
  const p = paletteForId(avatar.id);
  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: `radial-gradient(120% 100% at 50% 25%, color-mix(in srgb, ${p.bg} 60%, white 12%), ${p.bg} 70%, color-mix(in srgb, ${p.bg} 70%, black 18%))`,
      overflow: 'hidden',
      display: 'grid', placeItems: 'center'
    }}>
      {/* abstract figure */}
      <svg viewBox="0 0 200 200" style={{ width: '70%', height: '70%', position: 'absolute', bottom: '-12%' }}>
        <circle cx="100" cy="70" r="42" fill={p.fg} opacity="0.92" />
        <path d="M40 200 Q40 120 100 120 Q160 120 160 200 Z" fill={p.fg} opacity="0.92" />
        {/* small accent shoulder line */}
        <path d="M60 160 L140 160" stroke={p.tag} strokeWidth="3" opacity="0.5" />
      </svg>
      {/* initials chip */}
      <span style={{
        position: 'absolute',
        top: 10, left: 10,
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: 600,
        fontSize: size === 'lg' ? 22 : 13,
        color: p.bg,
        background: p.tag,
        padding: size === 'lg' ? '4px 10px' : '2px 7px',
        borderRadius: 4,
        letterSpacing: 0.5
      }}>{initials}</span>
      {playing && (
        <div style={{
          position: 'absolute', bottom: 10, right: 10,
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#fff',
          background: 'rgba(30,35,48,0.7)', padding: '3px 8px', borderRadius: 999,
          backdropFilter: 'blur(8px)',
          fontWeight: 500
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: '#f0b226', animation: 'blink 0.9s steps(2) infinite' }} />
          LIVE
        </div>
      )}
    </div>
  );
};

const StatusBadge = ({ status, progress }) => {
  if (status === 'ready')    return <span className="badge ok"><span className="dot" />Ready</span>;
  if (status === 'training') return <span className="badge training"><span className="dot" />Training {progress != null ? `${progress}%` : ''}</span>;
  if (status === 'consent')  return <span className="badge warn"><span className="dot" />Awaiting consent</span>;
  if (status === 'failed')   return <span className="badge err"><span className="dot" />Failed</span>;
  if (status === 'queued')   return <span className="badge"><span className="dot" />Queued</span>;
  return <span className="badge">{status}</span>;
};


export {
  Icon,
  CueLogo,
  Wordmark,
  EqualizerBars,
  Placeholder,
  AvatarTile,
  StatusBadge,
  paletteForId
};