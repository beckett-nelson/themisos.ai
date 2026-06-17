export default function TermsPage() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#05090F',
      color: '#EDE6D0',
      fontFamily: "'Syne', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,600&family=Syne:wght@400;500;600;700&display=swap');
      `}</style>

      <main style={{ padding: '64px 32px', maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#C9962B', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-block', width: '20px', height: '1px', background: '#C9962B', opacity: 0.6 }}></span>
          Legal
        </div>

        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.25rem', fontWeight: 600, color: '#ffffff', marginBottom: '24px', lineHeight: 1.1 }}>
          Terms of Service
        </h1>

        <div style={{
          background: '#0A1220',
          border: '1px solid #1A2E4A',
          borderRadius: '3px',
          padding: '32px',
          marginBottom: '32px',
        }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', color: '#9A927E', fontSize: '16px', lineHeight: 1.7, marginBottom: '16px' }}>
            ThemisOS's full Terms of Service are currently being finalized.
          </p>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", color: '#6E7D94', fontSize: '15px', lineHeight: 1.7 }}>
            Use of the platform during this period is governed by your firm's signed engagement letter and retainer agreement. If you have questions in the meantime, please reach out via the Support link below.
          </p>
        </div>

        <a href="/support" style={{
          display: 'inline-block',
          background: 'transparent',
          border: '1px solid #1A2E4A',
          color: '#6E7D94',
          padding: '10px 22px',
          borderRadius: '2px',
          fontSize: '11px',
          textDecoration: 'none',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontFamily: "'Syne', sans-serif",
        }}>
          ← Back to Support
        </a>
      </main>
    </div>
  )
}