import Link from 'next/link';

interface LogoProps {
  reversed?: boolean;
  compact?: boolean;
  className?: string;
}

export function Logo({ reversed = false, compact = false, className = '' }: LogoProps) {
  return (
    <Link
      className={`logo ${reversed ? 'logo-reversed' : ''} ${className}`}
      href="/"
      aria-label="SortSense home"
    >
      <svg className="logo-symbol" viewBox="0 0 42 42" aria-hidden="true">
        <path
          d="M21 5.5c7.9 0 14.4 5.6 15.9 13.1l-6 1.2A10.2 10.2 0 0 0 21 11.6h-2.5l3.7 3.8-4.3 4.2-9.7-9.8L18 0l4.2 4.3-1.3 1.2Z"
          fill="currentColor"
        />
        <path
          d="M21 36.5c-7.9 0-14.4-5.6-15.9-13.1l6-1.2a10.2 10.2 0 0 0 9.9 8.2h2.5l-3.7-3.8 4.3-4.2 9.7 9.8L24 42l-4.2-4.3 1.3-1.2Z"
          fill="currentColor"
          opacity=".62"
        />
        <circle cx="21" cy="21" r="3.2" fill="currentColor" />
        <path
          d="M21 15.5v3M21 23.5v3M15.5 21h3M23.5 21h3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {!compact && (
        <span className="logo-word">
          <b>Sort</b>Sense
        </span>
      )}
    </Link>
  );
}

// Backwards-compatible export for existing dashboard usage
export const BrandLogo = Logo;
