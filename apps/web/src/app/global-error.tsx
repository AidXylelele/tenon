'use client';

// The last boundary: the root layout itself failed, so it renders its own document and uses
// no stylesheet (docs, error.js › global-error).
export default function GlobalError({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'grid',
          placeItems: 'center',
          minHeight: '100vh',
          margin: 0,
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 18, margin: '0 0 8px' }}>
            The console could not start
          </h1>
          <p style={{ color: '#666', fontSize: 14, margin: '0 0 16px' }}>
            Reload in a few seconds. If it keeps happening, the console&apos;s
            server needs attention.
          </p>
          <button
            type="button"
            onClick={retry}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #ccc',
              background: 'white',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
