import React from 'react';

const CFG = {
  Low:      { c: '#76b900', bg: 'rgba(118,185,0,0.06)',   b: 'rgba(118,185,0,0.2)'  },
  Moderate: { c: '#f5a623', bg: 'rgba(245,166,35,0.06)',  b: 'rgba(245,166,35,0.2)' },
  High:     { c: '#ff4136', bg: 'rgba(255,65,54,0.06)',   b: 'rgba(255,65,54,0.2)'  },
  Imminent: { c: '#ff0033', bg: 'rgba(255,0,51,0.08)',    b: 'rgba(255,0,51,0.25)'  },
};

export default function RiskBadge({ level = 'Low', large = false }) {
  const cfg = CFG[level] || CFG.Low;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: large ? '6px 14px' : '3px 9px',
      background: cfg.bg, color: cfg.c,
      border: `1px solid ${cfg.b}`,
      borderRadius: '4px',
      fontWeight: 700,
      fontSize: large ? '0.78rem' : '0.65rem',
      letterSpacing: '0.8px',
      textTransform: 'uppercase',
      fontFamily: "'JetBrains Mono', monospace",
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: large ? 7 : 5, height: large ? 7 : 5,
        borderRadius: '50%', background: cfg.c,
        flexShrink: 0,
        boxShadow: `0 0 6px ${cfg.c}`,
      }} />
      {level}
    </span>
  );
}