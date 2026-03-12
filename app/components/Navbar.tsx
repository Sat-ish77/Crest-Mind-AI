export default function Navbar() {
  return (
    <div
      style={{
        height: "72px",
        borderBottom: "1px solid #444",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        background: "#f4f4f4",
      }}
    >
      <div style={{ fontWeight: 700 }}>[Woodcrest Logo]</div>
      <div style={{ fontSize: "28px", fontWeight: 700 }}>
        Document Analysis Workspace
      </div>
      <div
        style={{
          width: "40px",
          height: "40px",
          border: "2px solid #333",
          borderRadius: "999px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
        }}
      >
        U
      </div>
    </div>
  );
}