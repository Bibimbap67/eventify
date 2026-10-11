const nodemailer = require("nodemailer");

// Sends through the SMTP account in server/.env (e.g. Gmail with an app password).
// Without SMTP_HOST the message is printed in this console instead, so local demos still work.
async function sendMail({ to, subject, text }) {
  if (!process.env.SMTP_HOST) {
    console.log(`\n[mail: SMTP not set, printing instead]\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return;
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
}

module.exports = { sendMail };
