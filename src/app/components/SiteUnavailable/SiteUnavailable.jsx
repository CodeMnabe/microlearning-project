export default function SiteUnavailable() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        textAlign: "center",
        background: "#fff",
        color: "#111",
      }}
    >
      <div style={{ maxWidth: "600px" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "12px" }}>
          Website currently unavailable
        </h1>
        <p style={{ fontSize: "1rem", lineHeight: 1.6 }}>
          We are making some updates right now. Please come back in a little
          while.
        </p>
      </div>
    </main>
  );
}
