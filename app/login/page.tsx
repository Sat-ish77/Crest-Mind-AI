export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#efefef",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "520px",
          background: "#f8f8f8",
          border: "2px solid #444",
          padding: "48px",
          boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            border: "2px dashed #aaa",
            padding: "16px",
            textAlign: "center",
            marginBottom: "28px",
            fontWeight: 700,
          }}
        >
          [Woodcrest Logo]
        </div>

        <h1
          style={{
            textAlign: "center",
            fontSize: "38px",
            fontWeight: 700,
            marginBottom: "36px",
          }}
        >
          CrestMind AI Portal
        </h1>

        <input
          type="email"
          placeholder="Employee Email"
          style={{
            width: "100%",
            padding: "16px",
            marginBottom: "18px",
            border: "2px solid #ccc",
            fontSize: "18px",
          }}
        />

        <input
          type="password"
          placeholder="Password"
          style={{
            width: "100%",
            padding: "16px",
            marginBottom: "18px",
            border: "2px solid #ccc",
            fontSize: "18px",
          }}
        />

        <button
          style={{
            width: "100%",
            padding: "16px",
            border: "2px solid #333",
            background: "#f1f1f1",
            fontSize: "20px",
            fontWeight: 700,
            marginBottom: "16px",
            cursor: "pointer",
          }}
        >
          Secure Log In
        </button>

        <div style={{ marginBottom: "32px" }}>
          <a href="#" style={{ color: "#456", fontSize: "16px" }}>
            Forgot Password?
          </a>
        </div>

        <hr style={{ marginBottom: "32px" }} />

        <button
          style={{
            width: "100%",
            padding: "16px",
            border: "2px dashed #aaa",
            background: "white",
            fontSize: "18px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Log in with Corporate SSO
        </button>
      </div>
    </div>
  );
}