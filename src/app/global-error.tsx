'use client';

/** Last-resort boundary (root layout failed). Self-contained: no app CSS is guaranteed here. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#06070a',
          color: '#f3f5f5',
          fontFamily: 'system-ui, sans-serif',
          padding: '2rem',
        }}
      >
        <main style={{ maxWidth: 520 }}>
          <p style={{ letterSpacing: '0.24em', fontSize: 12, color: '#aab4bc' }}>THE INTELLIGENCE UNIVERSE</p>
          <h1 style={{ fontSize: 32, margin: '0.5rem 0 1rem' }}>Something went wrong.</h1>
          <p style={{ color: '#aab4bc' }}>The site failed to load. Please try again.</p>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: '12px 18px',
                borderRadius: 10,
                border: 0,
                background: '#7ef7c9',
                color: '#04120c',
                fontWeight: 700,
              }}
            >
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- the app router may be broken here */}
            <a
              href="/"
              style={{
                padding: '12px 18px',
                borderRadius: 10,
                border: '1px solid #2c333d',
                color: '#f3f5f5',
              }}
            >
              Home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
