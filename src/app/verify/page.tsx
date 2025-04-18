import CertificateVerifier from "@/app/components/CertificateVerifier";

export default function VerifyCertificatePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        minWidth: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f172a", // optional: matches your app background
      }}
    >
      <CertificateVerifier />
    </div>
  );
}