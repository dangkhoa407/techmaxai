export default function AdminLoading() {
  return (
    <div className="route-loading-overlay" role="status" aria-live="polite" aria-label="Dang tai">
      <div className="route-loading-spinner">
        <span />
        <span />
      </div>
    </div>
  );
}
