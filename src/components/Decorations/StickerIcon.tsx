type StickerKind = 'leaf' | 'mushroom' | 'footprint'

interface StickerIconProps {
  kind: StickerKind
  className?: string
}

export function StickerIcon({ kind, className }: StickerIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      {kind === 'leaf' && (
        <>
          <path d="M20.5 3.5C11 3.5 4 7.5 4 15a5.5 5.5 0 0 0 5.5 5.5C17 20.5 20.5 13 20.5 3.5Z" fill="currentColor" />
          <path d="M4 21c3-6 7-9 12-12" stroke="#fffaf0" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
      {kind === 'mushroom' && (
        <>
          <path d="M8 12h8v7.5a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V12Z" fill="#f5d995" stroke="currentColor" strokeWidth="1.2" />
          <path d="M2.5 12a9.5 9.5 0 0 1 19 0 2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2Z" fill="currentColor" />
          <circle cx="8" cy="8.5" r="1.3" fill="#fffaf0" />
          <circle cx="15.5" cy="10.5" r="1.1" fill="#fffaf0" />
        </>
      )}
      {kind === 'footprint' && (
        <>
          <path d="M12 21c-3.4 0-6-1.7-6-4.4 0-2.2 2.3-3.4 3.9-4.5.8-.5 1.4-1.2 2.1-1.2s1.3.7 2.1 1.2c1.6 1.1 3.9 2.3 3.9 4.5 0 2.7-2.6 4.4-6 4.4Z" fill="currentColor" />
          <ellipse cx="4.6" cy="11" rx="1.6" ry="2.2" transform="rotate(-24 4.6 11)" fill="currentColor" />
          <ellipse cx="8.6" cy="6.8" rx="1.6" ry="2.2" transform="rotate(-10 8.6 6.8)" fill="currentColor" />
          <ellipse cx="15.4" cy="6.8" rx="1.6" ry="2.2" transform="rotate(10 15.4 6.8)" fill="currentColor" />
          <ellipse cx="19.4" cy="11" rx="1.6" ry="2.2" transform="rotate(24 19.4 11)" fill="currentColor" />
        </>
      )}
    </svg>
  )
}
