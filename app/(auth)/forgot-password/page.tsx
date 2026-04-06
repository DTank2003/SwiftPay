"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";
import s from "../auth.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error);
      setLoading(false);
      return;
    }
    setSubmitted(true);
    setLoading(false);
  }

  return (
    <div className={s.page}>
      <div className={s.right} style={{ gridColumn: "1 / -1" }}>
        <div className={s.formCard}>
          <div className={s.sidebarBrand} style={{ marginBottom: "2rem" }}>
            <div className={s.brandIcon}>
              <Zap size={16} color="#a1a1aa" strokeWidth={1.5} />
            </div>
            <span className={s.brandName}>SwiftPay</span>
          </div>

          {submitted ? (
            <div className={s.formHead}>
              <h2 className={s.formTitle}>Check your email</h2>
              <p className={s.formSubtitle}>
                We sent a password reset link to{" "}
                <strong style={{ color: "#d4d4d8" }}>{email}</strong>. It
                expires in 15 minutes.
              </p>
              <p className={s.footerText} style={{ marginTop: "1.5rem" }}>
                <Link href="/login" className={s.footerLink}>
                  Back to sign in
                </Link>
              </p>
            </div>
          ) : (
            <>
              <div className={s.formHead}>
                <h2 className={s.formTitle}>Forgot password</h2>
                <p className={s.formSubtitle}>
                  Enter your email and we'll send a reset link
                </p>
              </div>

              <form className={s.form} onSubmit={handleSubmit}>
                <div className={s.field}>
                  <label className={s.label}>Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={s.input}
                    required
                  />
                </div>

                {error && (
                  <div className={s.errorBanner}>
                    <p className={s.errorText}>{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={s.btnPrimary}
                >
                  {loading ? (
                    <>
                      <span className={s.spinner} /> Sending...
                    </>
                  ) : (
                    "Send reset link"
                  )}
                </button>
              </form>

              <p className={s.footerText}>
                Remember it?{" "}
                <Link href="/login" className={s.footerLink}>
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
