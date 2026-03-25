"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Zap,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  QrCode,
  LogOut,
} from "lucide-react";
import s from "./dashboard.module.css";

// ── Types ──────────────────────────────────────────────
interface User {
  id: string;
  name: string;
  email: string;
}

interface Transaction {
  id: string;
  amount: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  type: "debit" | "credit";
  note: string | null;
  createdAt: string;
  counterparty: { name: string; email: string };
}

interface Pagination {
  page: number;
  totalPages: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ── Send form schema ───────────────────────────────────
const sendSchema = z.object({
  toEmail: z.string().email("Invalid email"),
  amount: z.coerce
    .number()
    .positive("Must be positive")
    .max(100000, "Max ₹1,00,000"),
  note: z.string().max(100).optional(),
});
type SendInput = z.infer<typeof sendSchema>;

// ── Helpers ────────────────────────────────────────────
function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ── Component ──────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SendInput>({ resolver: zodResolver(sendSchema) });

  // ── Fetch user + balance ──
  useEffect(() => {
    async function bootstrap() {
      const [userRes, balRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/wallet/balance"),
      ]);
      if (!userRes.ok) {
        router.push("/login");
        return;
      }
      const { user } = await userRes.json();
      const { balance } = await balRes.json();
      setUser(user);
      setBalance(balance);
      setLoading(false);
    }
    bootstrap();
  }, [router]);

  // ── Fetch transactions ──
  const fetchTransactions = useCallback(async (p: number) => {
    setTxLoading(true);
    const res = await fetch(`/api/wallet/transactions?page=${p}`);
    const data = await res.json();
    setTransactions(data.transactions);
    setPagination(data.pagination);
    setTxLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) fetchTransactions(page);
  }, [loading, page, fetchTransactions]);

  // ── Send money ──
  async function onSend(data: SendInput) {
    setSendError("");
    setSendSuccess("");
    const res = await fetch("/api/wallet/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      setSendError(json.error || "Payment failed");
      return;
    }
    setSendSuccess(`₹${formatAmount(data.amount)} sent to ${json.recipient}`);
    reset();
    // Refresh balance + transactions
    const balRes = await fetch("/api/wallet/balance");
    const { balance } = await balRes.json();
    setBalance(balance);
    fetchTransactions(1);
    setPage(1);
  }

  // ── Logout ──
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  // ── Skeleton while loading ──
  if (loading) {
    return (
      <div className={s.shell}>
        <aside className={s.sidebar} />
        <main className={s.main}>
          <div className={s.content}>
            <div className={s.topRow}>
              <div
                className={`${s.balanceCard} ${s.skeleton}`}
                style={{ height: "160px" }}
              />
              <div
                className={`${s.sendCard} ${s.skeleton}`}
                style={{ height: "160px" }}
              />
            </div>
            <div
              className={`${s.historyCard} ${s.skeleton}`}
              style={{ height: "320px" }}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={s.shell}>
      {/* ── Sidebar ── */}
      <aside className={s.sidebar}>
        <div className={s.sidebarBrand}>
          <div className={s.sidebarBrandIcon}>
            <Zap size={14} color="#a1a1aa" strokeWidth={1.5} />
          </div>
          <span className={s.sidebarBrandName}>SwiftPay</span>
        </div>

        <Link href="/dashboard" className={`${s.navItem} ${s.navItemActive}`}>
          <History size={14} strokeWidth={1.5} />
          Dashboard
        </Link>
        <Link href="/dashboard/qr" className={s.navItem}>
          <QrCode size={14} strokeWidth={1.5} />
          QR Code
        </Link>

        <div className={s.sidebarFooter}>
          <button className={s.navItem} onClick={logout}>
            <LogOut size={14} strokeWidth={1.5} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className={s.main}>
        {/* Topbar */}
        <div className={s.topbar}>
          <div>
            <p className={s.topbarGreeting}>Good {getTimeOfDay()},</p>
            <p className={s.topbarName}>{user?.name}</p>
          </div>
          <div className={s.topbarActions}>
            <div className={s.avatar}>{user ? initials(user.name) : "—"}</div>
          </div>
        </div>

        <div className={s.content}>
          {/* ── Top row ── */}
          <div className={s.topRow}>
            {/* Balance */}
            <div className={s.balanceCard}>
              <p className={s.balanceLabel}>Wallet balance</p>
              <p className={s.balanceAmount}>
                ₹<span>{balance !== null ? formatAmount(balance) : "—"}</span>
              </p>
              <p className={s.balanceMeta}>{user?.email}</p>
              <div className={s.balanceActions}>
                <button className={s.btnGhost}>
                  <ArrowDownLeft size={13} strokeWidth={1.5} />
                  Add money
                </button>
              </div>
            </div>

            {/* Send money */}
            <div className={s.sendCard}>
              <p className={s.sendCardTitle}>Send money</p>
              <form className={s.sendForm} onSubmit={handleSubmit(onSend)}>
                <div className={s.sendRow}>
                  <div>
                    <label className={s.fieldLabel}>Recipient email</label>
                    <input
                      {...register("toEmail")}
                      type="email"
                      placeholder="friend@example.com"
                      className={`${s.input} ${errors.toEmail ? s.inputError : ""}`}
                    />
                    {errors.toEmail && (
                      <p className={s.errorText}>{errors.toEmail.message}</p>
                    )}
                  </div>
                  <div>
                    <label className={s.fieldLabel}>Amount (₹)</label>
                    <input
                      {...register("amount")}
                      type="number"
                      placeholder="500"
                      min="1"
                      className={`${s.input} ${errors.amount ? s.inputError : ""}`}
                    />
                    {errors.amount && (
                      <p className={s.errorText}>{errors.amount.message}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className={s.fieldLabel}>Note (optional)</label>
                  <input
                    {...register("note")}
                    type="text"
                    placeholder="Dinner split, rent..."
                    className={s.input}
                  />
                </div>
                {sendError && (
                  <div className={s.errorBanner}>
                    <p className={s.errorText}>{sendError}</p>
                  </div>
                )}
                {sendSuccess && (
                  <div className={s.successBanner}>
                    <p className={s.successText}>{sendSuccess}</p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`${s.btnPrimary} ${s.btnPrimaryFull}`}
                >
                  {isSubmitting ? (
                    <>
                      <span className={s.spinner} /> Sending...
                    </>
                  ) : (
                    <>
                      <ArrowUpRight size={13} strokeWidth={1.5} /> Send
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* ── Transaction history ── */}
          <div className={s.historyCard}>
            <div className={s.historyHeader}>
              <p className={s.historyTitle}>Transaction history</p>
              {pagination && (
                <p className={s.historyCount}>
                  {pagination.total} transactions
                </p>
              )}
            </div>

            {txLoading ? (
              <div className={s.emptyState}>
                <span
                  className={s.skeleton}
                  style={{ width: "120px", height: "14px" }}
                />
              </div>
            ) : transactions.length === 0 ? (
              <div className={s.emptyState}>
                <p className={s.emptyTitle}>No transactions yet</p>
                <p className={s.emptySubtitle}>
                  Send money to someone to get started
                </p>
              </div>
            ) : (
              <>
                {transactions.map((tx) => (
                  <div key={tx.id} className={s.txRow}>
                    <div className={s.txLeft}>
                      <div className={s.txAvatar}>
                        {initials(tx.counterparty.name)}
                      </div>
                      <div>
                        <p className={s.txName}>{tx.counterparty.name}</p>
                        <p className={s.txMeta}>
                          {formatDate(tx.createdAt)}
                          {tx.note ? ` · ${tx.note}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className={s.txRight}>
                      <p
                        className={
                          tx.type === "debit"
                            ? s.txAmountDebit
                            : s.txAmountCredit
                        }
                      >
                        {tx.type === "debit" ? "−" : "+"} ₹
                        {formatAmount(tx.amount)}
                      </p>
                      <span
                        className={`${s.badge} ${
                          tx.status === "COMPLETED"
                            ? s.badgeCompleted
                            : tx.status === "PENDING"
                              ? s.badgePending
                              : s.badgeFailed
                        }`}
                      >
                        {tx.status.toLowerCase()}
                      </span>
                    </div>
                  </div>
                ))}

                {pagination && (
                  <div className={s.pagination}>
                    <p className={s.paginationInfo}>
                      Page {pagination.page} of {pagination.totalPages}
                    </p>
                    <div className={s.paginationControls}>
                      <button
                        className={s.pageBtn}
                        disabled={!pagination.hasPrev}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        ← Prev
                      </button>
                      <span className={s.pageCurrent}>{pagination.page}</span>
                      <button
                        className={s.pageBtn}
                        disabled={!pagination.hasNext}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
      {/* ── Bottom nav (mobile only) ── */}
      <nav className={s.bottomNav}>
        <Link
          href="/dashboard"
          className={`${s.bottomNavItem} ${s.bottomNavItemActive}`}
        >
          <History size={18} strokeWidth={1.5} />
          Home
        </Link>
        <Link href="/dashboard/qr" className={s.bottomNavItem}>
          <QrCode size={18} strokeWidth={1.5} />
          QR Pay
        </Link>
        <button className={s.bottomNavItem} onClick={logout}>
          <LogOut size={18} strokeWidth={1.5} />
          Sign out
        </button>
      </nav>
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
