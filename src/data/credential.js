// Certificate credential IDs look like CERT-NU-2026-AB12CD34 (server/utils/certificates.js).
// People type them in any case, with spaces, and sometimes without the CERT-NU- start.
export function cleanCredentialId(text) {
  const id = String(text || "").toUpperCase().replace(/\s+/g, "");
  if (!id || id.startsWith("CERT-")) return id;
  return (id.startsWith("NU-") ? "CERT-" : "CERT-NU-") + id;
}

// A scanned QR: the certificate's /verify/<id> link, or the ID itself. Null for anything else.
export function credentialFromQr(text) {
  const raw = String(text || "").trim();
  try {
    const match = /^\/verify\/([^/]+)\/?$/.exec(new URL(raw).pathname);
    return match ? cleanCredentialId(decodeURIComponent(match[1])) : null;
  } catch {
    return /^CERT-/i.test(raw) ? cleanCredentialId(raw) : null;
  }
}
