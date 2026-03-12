import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

export default function DashboardPage() {
  return (
    <div style={{ background: "#efefef", minHeight: "100vh" }}>
      <Navbar />
      <div style={{ display: "flex" }}>
        <Sidebar />

        <main style={{ flex: 1, padding: "48px" }}>
          <h1
            style={{
              textAlign: "center",
              fontSize: "56px",
              fontWeight: 700,
              marginBottom: "36px",
            }}
          >
            What property data do you need?
          </h1>

          <div
            style={{
              maxWidth: "900px",
              margin: "0 auto 40px auto",
              border: "2px solid #444",
              borderRadius: "999px",
              padding: "18px 28px",
              fontSize: "22px",
              color: "#666",
              background: "#fafafa",
            }}
          >
            Ask a natural language question across all permitted documents...
          </div>

          <div
            style={{
              maxWidth: "900px",
              margin: "0 auto",
              border: "1px solid #bbb",
              background: "#f8f8f8",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Document Name</th>
                  <th style={thStyle}>Property ID</th>
                  <th style={thStyle}>Access Level</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle}>Dallas_Lease_2025.pdf</td>
                  <td style={tdStyle}>TX-402</td>
                  <td style={tdStyle}>Admin</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Austin_Appraisal.pdf</td>
                  <td style={tdStyle}>TX-405</td>
                  <td style={tdStyle}>Analyst</td>
                </tr>
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}

const thStyle = {
  border: "1px solid #bbb",
  textAlign: "left" as const,
  padding: "16px",
  fontSize: "18px",
  fontWeight: 700,
};

const tdStyle = {
  border: "1px solid #bbb",
  padding: "16px",
  fontSize: "18px",
};