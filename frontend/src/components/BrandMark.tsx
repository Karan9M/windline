export function BrandMark() {
  return (
    <div className="brand-lockup" aria-label="Windline">
      <div className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 36 36" fill="none">
          <circle cx="18" cy="18" r="16.3" stroke="currentColor" strokeOpacity=".22" />
          <path d="M18 18 18 5.5M18 18 29 24.2M18 18 7 24.2" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
          <circle cx="18" cy="18" r="3.2" fill="#D4F46B" />
          <path d="M18 18 18 5.5M18 18 29 24.2M18 18 7 24.2" stroke="#D4F46B" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </div>
      <div className="brand-name">windline<span>.</span></div>
    </div>
  )
}
