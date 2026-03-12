"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const linkStyle = (path: string) => ({
    display: "block",
    padding: "14px 20px",
    marginBottom: "16px",
    border: pathname === path ? "2px solid #333" : "2px solid #ccc",
    background: "#f5f5f5",
    textAlign: "center" as const,
    textDecoration: "none",
    color: "#333",
    fontWeight: pathname === path ? 700 : 500,
  });

  return (
    <div
      style={{
        width: "220px",
        borderRight: "1px solid #444",
        padding: "24px",
        minHeight: "calc(100vh - 72px)",
        background: "#efefef",
      }}
    >
      <Link href="/dashboard" style={linkStyle("/dashboard")}>
        Dashboard
      </Link>

      <Link href="/upload" style={linkStyle("/upload")}>
        Upload
      </Link>

      <Link href="/query" style={linkStyle("/query")}>
        My Queries
      </Link>
    </div>
  );
}