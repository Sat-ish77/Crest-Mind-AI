const USE_MOCK = true;
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
export interface Citation { document_name: string; page: number; snippet: string; type: string; }
export interface QueryResult { answer: string; confidence: number; citations: Citation[]; }
export async function uploadDocument(file: File, onProgress: (pct: number) => void) {
  if (USE_MOCK) {
    for (let p = 10; p <= 100; p += Math.floor(Math.random() * 20 + 8)) { await delay(160); onProgress(Math.min(p, 100)); }
    await delay(200);
    if (Math.random() < 0.08) throw new Error("Upload failed");
    return { success: true, document_id: `doc_${Math.random().toString(36).slice(2)}` };
  }
  const form = new FormData(); form.append("file", file);
  const res = await fetch("/api/documents/upload", { method: "POST", body: form });
  return res.json();
}
export async function queryDocuments(params: { question: string; property: string; suite: string; tenant: string }): Promise<QueryResult> {
  if (USE_MOCK) {
    await delay(1800);
    const pool: QueryResult[] = [
      { answer: "The lease for Suite 101 at Pinecrest Plaza is held by Apex Corp and expires on December 31, 2026. Base rent is $4,850/month with a 3% annual escalation clause.", confidence: 0.91, citations: [{ document_name: "Apex_Corp_Lease_2024.pdf", page: 3, snippet: "Lease term: Jan 1, 2024 - Dec 31, 2026", type: "pdf" },{ document_name: "PinecrestPlaza_RentRoll_Q1.xlsx", page: 1, snippet: "Suite 101 - $4,850/mo base rent", type: "xlsx" }] },
      { answer: "The fire suppression system at Riverside Tower was last inspected on November 12, 2025. All suppression heads on floors 2-5 are operational. Next inspection due May 2026.", confidence: 0.87, citations: [{ document_name: "Riverside_FireSuppression_Nov2025.pdf", page: 2, snippet: "Inspection date: Nov 12, 2025 - PASS", type: "pdf" }] },
      { answer: "There are 3 open work orders at Pinecrest Plaza: HVAC filter replacement in Suite 202 (overdue 14 days), roof drainage inspection (March 20), and elevator annual service (April 1, 2026).", confidence: 0.78, citations: [{ document_name: "Pinecrest_MaintenanceLog_2026.xlsx", page: 4, snippet: "WO#2041 - HVAC Filter 202 - OVERDUE", type: "xlsx" }] },
    ];
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const res = await fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) });
  return res.json();
}
