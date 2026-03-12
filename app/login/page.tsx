"use client";

export default function LoginPage() {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f4f4f4"
      }}
    >
      <div
        style={{
          background: "white",
          padding: "40px",
          borderRadius: "10px",
          width: "350px",
          boxShadow: "0 5px 15px rgba(0,0,0,0.1)"
        }}
      >
        <h2 style={{ textAlign: "center", marginBottom: "20px" }}>
          CrestMind AI Portal
        </h2>

        <input
          type="email"
          placeholder="Employee Email"
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "15px"
          }}
        />

        <input
          type="password"
          placeholder="Password"
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "20px"
          }}
        />

        <button
          style={{
            width: "100%",
            padding: "12px",
            background: "#0a2540",
            color: "white",
            border: "none",
            cursor: "pointer"
          }}
        >
          Secure Log In
        </button>
      </div>
    </div>
  );
}