import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

export default function QueryPage() {
  return (
    <div style={{ background: "#efefef", minHeight: "100vh" }}>
      <Navbar />
      <div style={{ display: "flex" }}>
        <Sidebar />

        <main style={{ flex: 1, display: "flex", minHeight: "calc(100vh - 72px)" }}>
          <section
            style={{
              flex: 1.1,
              borderRight: "1px solid #444",
              padding: "32px",
            }}
          >
            <h2
              style={{
                fontSize: "42px",
                fontWeight: 700,
                marginBottom: "28px",
                textAlign: "center",
              }}
            >
              Dallas_Lease_2025.pdf
            </h2>

            <div style={fakeLineLong} />
            <div style={fakeLineMedium} />
            <div style={fakeLineShort} />
            <div style={{ height: "80px" }} />
            <div style={fakeLineLong} />
            <div style={fakeLineMedium} />
            <div style={fakeLineLong} />
          </section>

          <section
            style={{
              width: "420px",
              padding: "24px",
            }}
          >
            <div
              style={{
                border: "1px solid #bbb",
                background: "#f7f7f7",
                minHeight: "520px",
                padding: "14px",
                marginBottom: "14px",
              }}
            >
              <div
                style={{
                  marginLeft: "auto",
                  width: "80%",
                  border: "2px solid #444",
                  borderRadius: "14px",
                  padding: "16px",
                  background: "white",
                  fontSize: "16px",
                  marginBottom: "16px",
                }}
              >
                What is the termination date?
              </div>

              <div
                style={{
                  width: "85%",
                  border: "2px solid #aaa",
                  borderRadius: "14px",
                  padding: "16px",
                  background: "#f0f0f0",
                  fontSize: "16px",
                }}
              >
                Based on Section 4 of the document, the termination date is
                December 31, 2028.
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <input
                placeholder="Ask CrestMind AI about this doc."
                style={{
                  flex: 1,
                  border: "2px solid #444",
                  padding: "14px",
                  fontSize: "18px",
                  background: "white",
                }}
              />
              <button
                style={{
                  border: "2px solid #333",
                  padding: "14px 18px",
                  fontSize: "18px",
                  fontWeight: 700,
                  background: "#f7f7f7",
                  cursor: "pointer",
                }}
              >
                Send
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

const fakeLineLong = {
  height: "8px",
  width: "85%",
  background: "#d4d4d4",
  margin: "22px auto",
};

const fakeLineMedium = {
  height: "8px",
  width: "72%",
  background: "#d4d4d4",
  margin: "22px auto",
};

const fakeLineShort = {
  height: "8px",
  width: "56%",
  background: "#d4d4d4",
  margin: "22px auto",
};