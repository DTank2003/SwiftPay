"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Zap } from "lucide-react";
import { z } from "zod";
import s from "../auth.module.css";

const schema = z.object({
  token: z.string().min(1, "Invalid reset link"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[0-9]/, "Must contain a number"),
});

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    const result = schema.safeParse({ token, password });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error || json.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  if (!token) {
    return (
      <div className={s.formHead}>
        <h2 className={s.formTitle}>Invalid link</h2>
        <p className={s.formSubtitle}>This reset link is missing a token.</p>
        <p className={s.footerText}>
          <Link href="/forgot-password" className={s.footerLink}>
            Request a new one
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={s.formHead}>
        <h2 className={s.formTitle}>
          {done ? "Password updated" : "Set new password"}
        </h2>
        <p className={s.formSubtitle}>
          {done ? "Redirecting you to sign in..." : "Choose a strong password"}
        </p>
      </div>

      {!done && (
        <form className={s.form} onSubmit={handleSubmit}>
          <div className={s.field}>
            <label className={s.label}>New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              className={s.input}
              required
            />
          </div>
          <div className={s.field}>
            <label className={s.label}>Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your password"
              className={s.input}
              required
            />
          </div>

          {error && (
            <div className={s.errorBanner}>
              <p className={s.errorText}>{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading} className={s.btnPrimary}>
            {loading ? (
              <>
                <span className={s.spinner} /> Updating...
              </>
            ) : (
              "Update password"
            )}
          </button>
        </form>
      )}

      <p className={s.footerText}>
        <Link href="/login" className={s.footerLink}>
          Back to sign in
        </Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
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
          <Suspense fallback={<p className={s.formSubtitle}>Loading...</p>}>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
