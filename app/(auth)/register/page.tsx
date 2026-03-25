"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, RegisterInput } from "@/lib/validations/auth";
import { Zap } from "lucide-react";
import s from "../auth.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(data: RegisterInput) {
    setServerError("");
    const res = await fetch("/api/auth/register", {
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
      <div className={s.left}>
        <div className={s.brand}>
          <div className={s.brandIcon}>
            <Zap size={16} color="#a1a1aa" strokeWidth={1.5} />
          </div>
          <span className={s.brandName}>SwiftPay</span>
        </div>

        <div className={s.leftBody}>
          <div>
            <h1 className={s.tagline}>
              Join millions.
              <br />
              <span className={s.taglineMuted}>Pay smarter.</span>
            </h1>
            <p className={s.taglineSub}>
              Create your free account and start sending money in under two
              minutes.
            </p>
          </div>
        </div>

        <p className={s.copyright}>© 2025 SwiftPay Technologies Pvt. Ltd.</p>
      </div>

      <div className={s.right}>
        <div className={s.formCard}>
          <div className={s.formHead}>
            <h2 className={s.formTitle}>Create account</h2>
            <p className={s.formSubtitle}>Get started with SwiftPay for free</p>
          </div>

          <form className={s.form} onSubmit={handleSubmit(onSubmit)}>
            <div className={s.field}>
              <label className={s.label}>Full name</label>
              <input
                {...register("name")}
                type="text"
                placeholder="Dhyey Shah"
                className={`${s.input} ${errors.name ? s.inputError : ""}`}
              />
              {errors.name && (
                <p className={s.fieldError}>{errors.name.message}</p>
              )}
            </div>

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
              <label className={s.label}>Phone number</label>
              <input
                {...register("phone")}
                type="tel"
                placeholder="9876543210"
                className={`${s.input} ${errors.phone ? s.inputError : ""}`}
              />
              {errors.phone && (
                <p className={s.fieldError}>{errors.phone.message}</p>
              )}
            </div>

            <div className={s.field}>
              <label className={s.label}>Password</label>
              <input
                {...register("password")}
                type="password"
                placeholder="Min 8 chars, 1 uppercase, 1 number"
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
                  <span className={s.spinner} /> Creating account...
                </>
              ) : (
                "Create account"
              )}
            </button>
          </form>

          <p className={s.footerText}>
            Already have an account?{" "}
            <Link href="/login" className={s.footerLink}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
