// Usab-4: generic loading placeholder shown while a lazy view's JS chunk loads.
// Mirrors the rough shape of a content view (title + a few blocks) using the
// existing .skel shimmer, so switching views never flashes a blank screen.
export function ViewSkeleton() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }} aria-busy="true" aria-live="polite">
      <span className="skel" style={{ width: 220, height: 28 }} />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="skel" style={{ width: 260, height: 120, borderRadius: 'var(--r)' }} />
        ))}
      </div>
      <span className="skel" style={{ width: '60%', height: 16 }} />
      <span className="skel" style={{ width: '45%', height: 16 }} />
    </div>
  );
}
