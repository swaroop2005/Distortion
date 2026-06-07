export default function OptimizerPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #e3e9f0', flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#16202c', letterSpacing: '-.02em' }}>
          Supply Command Center
        </h1>
        <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#6b7a8d' }}>
          L1 optimizer — national stock map, shortage forecast, redistribution plan, donor mobilization
        </p>
      </div>
      <iframe
        src="/optimizer-dashboard.html"
        title="Supply Command Center"
        style={{ flex: 1, border: 'none', width: '100%' }}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
