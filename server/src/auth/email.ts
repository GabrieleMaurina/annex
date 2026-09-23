import { createTransport } from 'nodemailer';

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;

const transporter =
  SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && EMAIL_FROM
    ? createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        requireTLS: true,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      })
    : null;

export function sendEmail(
  to: string,
  subject: string,
  html: string,
  callback: (error: Error | null) => void,
) {
  if (!transporter) {
    console.log(`email to ${to}\nsubject: ${subject}\n${html}`);
    callback(null);
    return;
  }
  transporter.sendMail({ from: EMAIL_FROM, to, subject, html }, callback);
}
