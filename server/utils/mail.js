const nodemailer = require("nodemailer");

// "Eventify <me@gmail.com>" → { name: "Eventify", email: "me@gmail.com" }.
function parseAddress(value) {
  const match = String(value || "").match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return match ? { name: match[1] || undefined, email: match[2].trim() } : { email: String(value || "").trim() };
}

// Sends through Brevo's HTTP API when BREVO_API_KEY is set. Render's free plan blocks SMTP ports,
// but plain HTTPS gets through. MAIL_FROM must be a sender verified in Brevo.
async function sendWithBrevo({ to, bcc, subject, text }) {
  const list = (value) => [].concat(value || []).filter(Boolean).map(parseAddress);
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: parseAddress(process.env.MAIL_FROM || process.env.SMTP_USER),
      to: list(to),
      ...(list(bcc).length ? { bcc: list(bcc) } : {}),
      subject,
      textContent: text,
    }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
}

// Otherwise sends through the SMTP account in server/.env (e.g. Gmail with an app password).
// Without either, the message is printed in this console instead, so local demos still work.
async function sendMail({ to, bcc, subject, text }) {
  if (process.env.BREVO_API_KEY) return sendWithBrevo({ to, bcc, subject, text });
  if (!process.env.SMTP_HOST) {
    console.log(`\n[mail: SMTP not set, printing instead]\nTo: ${to}${bcc ? `\nBcc: ${[].concat(bcc).join(", ")}` : ""}\nSubject: ${subject}\n\n${text}\n`);
    return;
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, bcc, subject, text });
}

module.exports = { sendMail };
