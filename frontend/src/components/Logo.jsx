import React from 'react';

export default function Logo({ size = 32, animated = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={animated ? { animation: 'logo-coffee 3s ease-in-out infinite' } : {}}
    >
      {/* Outer ring — c05 caramel latte */}
      <polygon
        points="16,2 28,9 28,23 16,30 4,23 4,9"
        fill="none"
        stroke="rgba(200,164,120,0.45)"
        strokeWidth="1"
      />
      {/* Inner hex — c03 light cappuccino fill */}
      <polygon
        points="16,7 24,11.5 24,20.5 16,25 8,20.5 8,11.5"
        fill="rgba(184,132,74,0.1)"
        stroke="rgba(160,104,48,0.7)"
        strokeWidth="1"
      />
      {/* Center — c06 caramel */}
      <circle cx="16" cy="16" r="2.5" fill="#B8844A" />
      <circle cx="16" cy="16" r="2.5" fill="#B8844A" opacity="0.3">
        <animate attributeName="r"       values="2.5;5;2.5"   dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0;0.3"   dur="3s" repeatCount="indefinite" />
      </circle>
      {/* Spokes — c06 */}
      <line x1="16" y1="16" x2="16"  y2="7"    stroke="rgba(184,132,74,0.6)" strokeWidth="0.75" />
      <line x1="16" y1="16" x2="24"  y2="11.5" stroke="rgba(184,132,74,0.6)" strokeWidth="0.75" />
      <line x1="16" y1="16" x2="24"  y2="20.5" stroke="rgba(184,132,74,0.6)" strokeWidth="0.75" />
      <line x1="16" y1="16" x2="16"  y2="25"   stroke="rgba(184,132,74,0.6)" strokeWidth="0.75" />
      <line x1="16" y1="16" x2="8"   y2="20.5" stroke="rgba(184,132,74,0.6)" strokeWidth="0.75" />
      <line x1="16" y1="16" x2="8"   y2="11.5" stroke="rgba(184,132,74,0.6)" strokeWidth="0.75" />
      {/* Corner nodes — c07 rich caramel */}
      <circle cx="16"  cy="7"    r="1.5" fill="rgba(160,104,48,0.9)" />
      <circle cx="24"  cy="11.5" r="1.5" fill="rgba(160,104,48,0.9)" />
      <circle cx="24"  cy="20.5" r="1.5" fill="rgba(160,104,48,0.9)" />
      <circle cx="16"  cy="25"   r="1.5" fill="rgba(160,104,48,0.9)" />
      <circle cx="8"   cy="20.5" r="1.5" fill="rgba(160,104,48,0.9)" />
      <circle cx="8"   cy="11.5" r="1.5" fill="rgba(160,104,48,0.9)" />
      {/* Cross lines — c03 barely visible */}
      <line x1="16" y1="7"    x2="24" y2="20.5" stroke="rgba(184,132,74,0.1)" strokeWidth="0.5" />
      <line x1="16" y1="7"    x2="8"  y2="20.5" stroke="rgba(184,132,74,0.1)" strokeWidth="0.5" />
      <line x1="24" y1="11.5" x2="8"  y2="11.5" stroke="rgba(184,132,74,0.1)" strokeWidth="0.5" />
      <line x1="24" y1="20.5" x2="8"  y2="20.5" stroke="rgba(184,132,74,0.1)" strokeWidth="0.5" />
      <style>{`
        @keyframes logo-coffee {
          0%, 100% { filter: drop-shadow(0 0 0px rgba(184,132,74,0)); }
          50%       { filter: drop-shadow(0 0 7px rgba(184,132,74,0.5)); }
        }
      `}</style>
    </svg>
  );
}