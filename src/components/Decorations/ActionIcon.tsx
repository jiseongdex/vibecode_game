type ActionIconKind = 'door' | 'arrow-left' | 'arrow-right'

export function ActionIcon({ kind }: { kind: ActionIconKind }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {kind === 'door' ? (
        <>
          <path d="M5 20V4.5L15 3v18L5 19.5Z" />
          <path d="M15 4h4v16h-4" />
          <circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <path d={kind === 'arrow-left' ? 'M19 12H5' : 'M5 12h14'} />
          <path d={kind === 'arrow-left' ? 'm11 6-6 6 6 6' : 'm13 6 6 6-6 6'} />
        </>
      )}
    </svg>
  )
}
