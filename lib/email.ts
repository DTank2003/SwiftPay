import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string
): Promise<void> {
  await transporter.sendMail({
    from: `"SwiftPay" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Reset your SwiftPay password",
    html: `
      <div style="font-family: monospace; max-width: 480px; margin: 0 auto; padding: 2rem; background: #0c0c0e; color: #fafafa;">
        <div style="margin-bottom: 2rem;">
          <span style="font-size: 1.25rem; font-weight: 600; color: #fafafa;">SwiftPay</span>
        </div>
        <h1 style="font-size: 1.25rem; font-weight: 600; color: #fafafa; margin: 0 0 0.5rem;">
          Reset your password
        </h1>
        <p style="color: #71717a; font-size: 0.875rem; margin: 0 0 2rem;">
          Hi ${name}, we received a request to reset your SwiftPay password.
        </p>
        <a href="${resetUrl}"
           style="display: inline-block; background: #fafafa; color: #09090b; padding: 0.75rem 1.5rem;
                  border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.875rem;">
          Reset password
        </a>
        <p style="color: #71717a; font-size: 0.75rem; margin: 2rem 0 0;">
          This link expires in 15 minutes. If you didn't request this, ignore this email.
        </p>
      </div>
    `,
  });
}