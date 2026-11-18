import { useId } from "react";

/** The FieldBasket "Woven Field" mark. */
export function LogoMark({ size = 30, onDark = true }: { size?: number; onDark?: boolean }) {
  const clipId = useId();
  const stem = onDark ? "#c5ef62" : "#06633b";
  const rightLeaf = onDark ? "#ffffff" : "#087f4b";
  const rim = onDark ? "#c5ef62" : "#06633b";

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <path d="M16 60 Q20 106 60 108 Q100 106 104 60 Z" />
        </clipPath>
      </defs>
      <path d="M60 52 L60 30" stroke={stem} strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M60 42 C58 30 50 22 36 20 C36 34 44 42 60 42 Z" fill={stem} />
      <path d="M60 34 C62 22 70 14 84 12 C84 26 76 34 60 34 Z" fill={rightLeaf} />
      <path d="M16 60 Q20 106 60 108 Q100 106 104 60 Z" fill="#087f4b" />
      <g clipPath={`url(#${clipId})`} fill="none" stroke="#c5ef62" strokeWidth="5" strokeLinecap="round">
        <path d="M6 76 Q60 64 114 76" />
        <path d="M6 90 Q60 78 114 90" />
      </g>
      <rect x="10" y="50" width="100" height="12" rx="6" fill={rim} />
    </svg>
  );
}

export function Logo({ onDark = true, size = 30 }: { onDark?: boolean; size?: number }) {
  return (
    <span className={`logo ${onDark ? "logo--dark" : ""}`}>
      <LogoMark size={size} onDark={onDark} />
      <span className="logo__word">FieldBasket</span>
    </span>
  );
}
