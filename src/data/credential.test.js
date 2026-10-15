import { cleanCredentialId, credentialFromQr } from "./credential.js";

test("cleans up a typed credential ID", () => {
  expect(cleanCredentialId(" cert-nu-2026-ab12cd34 ")).toBe("CERT-NU-2026-AB12CD34");
  expect(cleanCredentialId("2026-AB12 CD34")).toBe("CERT-NU-2026-AB12CD34");
  expect(cleanCredentialId("nu-2026-ab12cd34")).toBe("CERT-NU-2026-AB12CD34");
  expect(cleanCredentialId("")).toBe("");
});

test("reads the certificate QR, or a QR holding just the ID", () => {
  expect(credentialFromQr("https://eventifys.vercel.app/verify/CERT-NU-2026-AB12CD34")).toBe("CERT-NU-2026-AB12CD34");
  expect(credentialFromQr("CERT-NU-2026-AB12CD34")).toBe("CERT-NU-2026-AB12CD34");
  expect(credentialFromQr("https://eventifys.vercel.app/exit/ev1?code=ab")).toBe(null);
  expect(credentialFromQr("EVENTIFY-TICKET:0123456789abcdef0123456789abcdef")).toBe(null);
});
