"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginInput } from "@/lib/validations/auth";
import { Zap, Globe } from "lucide-react";
import s from "../auth.module.css";

const stats = [
  { value: "₹2.4B+", label: "Processed monthly" },
  { value: "1.2M+", label: "Active users" },
  { value: "<2s", label: "Avg transfer time" },
  { value: "99.9%", label: "Uptime SLA" },
];

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginInput) {
    setServerError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      const json = await res.json();
      setServerError(json.error || "Something went wrong");
    }
  }

  return (
    <div className={s.page}>
      {/* Left panel */}
      <div className={s.left}>
        <div className={s.brand}>
          <div className={s.brandIcon}>
            <Zap size={16} color="#a1a1aa" strokeWidth={1.5} />
          </div>
          <span className={s.brandName}>SwiftPay</span>
        </div>

        <div className={s.leftBody}>
          <div className={s.statusBadge}>
            <span className={s.statusDot} />
            <span className={s.statusText}>All systems operational</span>
          </div>

          <div>
            <h1 className={s.tagline}>
              Move money.
              <br />
              <span className={s.taglineMuted}>Instantly.</span>
            </h1>
            <p className={s.taglineSub}>
              Send, receive and manage your money with bank-grade security and
              zero hassle.
            </p>
          </div>

          <div className={s.statsGrid}>
            {stats.map((stat) => (
              <div key={stat.label} className={s.statCard}>
                <p className={s.statValue}>{stat.value}</p>
                <p className={s.statLabel}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className={s.copyright}>© 2025 SwiftPay Technologies Pvt. Ltd.</p>
      </div>

      {/* Right panel */}
      <div className={s.right}>
        <div className={s.formCard}>
          <div className={s.formHead}>
            <h2 className={s.formTitle}>Welcome back</h2>
            <p className={s.formSubtitle}>
              Sign in to your account to continue
            </p>
          </div>

          <form className={s.form} onSubmit={handleSubmit(onSubmit)}>
            <div className={s.field}>
              <label className={s.label}>Email address</label>
              <input
                {...register("email")}
                type="email"
                placeholder="you@example.com"
                className={`${s.input} ${errors.email ? s.inputError : ""}`}
              />
              {errors.email && (
                <p className={s.fieldError}>{errors.email.message}</p>
              )}
            </div>

            <div className={s.field}>
              <div className={s.fieldRow}>
                <label className={s.label}>Password</label>
                <Link href="/forgot-password" className={s.forgotLink}>
                  Forgot password?
                </Link>
              </div>
              <input
                {...register("password")}
                type="password"
                placeholder="Enter your password"
                className={`${s.input} ${errors.password ? s.inputError : ""}`}
              />
              {errors.password && (
                <p className={s.fieldError}>{errors.password.message}</p>
              )}
            </div>

            {serverError && (
              <div className={s.errorBanner}>
                <p className={s.errorText}>{serverError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={s.btnPrimary}
            >
              {isSubmitting ? (
                <>
                  <span className={s.spinner} /> Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className={s.divider}>
            <div className={s.dividerLine} />
            <span className={s.dividerText}>or continue with</span>
            <div className={s.dividerLine} />
          </div>

          <button className={s.btnGhost}>
            <Globe size={15} strokeWidth={1.5} />
            Continue with SSO
          </button>

          <p className={s.footerText}>
            Don&apos;t have an account?{" "}
            <Link href="/register" className={s.footerLink}>
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
