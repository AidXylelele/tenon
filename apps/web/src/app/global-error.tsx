"use client";

export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en" style={{ colorScheme: "light dark" }}>
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
          background: "light-dark(#fbfbfe, #0f0f13)",
          color: "light-dark(#15151d, #f1f1f4)",
        }}
      >
        <title>Tenon could not start</title>
        <main style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 20, lineHeight: "28px", margin: "0 0 8px" }}>
            Tenon could not start
          </h1>
          <p
            style={{
              color: "light-dark(#62626c, #a3a4ac)",
              fontSize: 14,
              lineHeight: "20px",
              margin: "0 0 16px",
            }}
          >
            Reload in a few seconds. If it keeps happening, the console&apos;s
            server needs attention.
          </p>
          <button
            type="button"
            onClick={retry}
            style={{
              height: 32,
              padding: "0 12px",
              borderRadius: 8,
              border: "none",
              background: "light-dark(#5d4bdb, #9797ff)",
              color: "light-dark(#fbfbfe, #0f0f23)",
              font: "inherit",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
