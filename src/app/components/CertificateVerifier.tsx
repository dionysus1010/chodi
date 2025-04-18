"use client";
import React, { useState, FormEvent } from "react";
type Certificate = {
  certificate_id: string;
  course_id: string;
  issue_date: string;
  username: string;
};

type VerifyResponse =
  | { valid: true; certificate: Certificate }
  | { valid: false; error: string }
  | { error: string };

const CertificateVerifier: React.FC = () => {
  const [certificateId, setCertificateId] = useState("");
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch(
        `/api/certificates/verify?certificate_id=${encodeURIComponent(certificateId)}`
      );
      const data: VerifyResponse = await res.json();
      setResult(data);
    } catch {
      setResult({ error: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 400,
        margin: "2rem auto",
        padding: 24,
        background: "#1e293b",
        borderRadius: 8,
        color: "#fff",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      }}
    >
      <h1 style={{ marginBottom: 16 }}>Paste your certificate ID here to verify it.</h1>
      <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="text"
          placeholder="Enter Certificate ID"
          value={certificateId}
          onChange={e => setCertificateId(e.target.value)}
          style={{
            padding: 8,
            borderRadius: 4,
            border: "1px solid #7c3aed",
            fontSize: 16,
          }}
          required
        />
        <button
          type="submit"
          style={{
            padding: 10,
            background: "#7c3aed",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: 16,
          }}
          disabled={loading}
        >
          {loading ? "Verifying..." : "Verify"}
        </button>
      </form>
      {result && (
        <div style={{ marginTop: 20 }}>
          {"valid" in result && result.valid ? (
            <div>
              <strong style={{ color: "#10b981" }}>Certificate is valid!</strong>
              <div>Username: <b>{result.certificate.username}</b></div>
              <div>Course: <b>{result.certificate.course_id}</b></div>
              <div>
                Issue Date: <b>{new Date(result.certificate.issue_date).toLocaleString()}</b>
              </div>
              <div>Certificate ID: <b>{result.certificate.certificate_id}</b></div>
            </div>
          ) : (
            <div style={{ color: "#f43f5e" }}>
              {result.error || "Certificate not found"}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CertificateVerifier;