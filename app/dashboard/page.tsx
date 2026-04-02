"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { useDashboard } from "./_components/DashboardProvider";
import s from "./dashboard.module.css";

interface Transaction {
  id: string;
  amount: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  type: "debit" | "credit" | "failed";
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

const sendSchema = z.object({
  toEmail: z.string().email("Invalid email"),
  amount: z.coerce
    .number()
    .positive("Must be positive")
    .max(100000, "Max ₹1,00,000"),
  note: z.string().max(100).optional(),
});
type SendInput = z.infer<typeof sendSchema>;

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

export default function DashboardPage() {
  const { user, balance, loading, refreshBalance } = useDashboard();
  console.log("WEB DB:", process.env.DATABASE_URL);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [txLoading, setTxLoading] = useState(false);
  const [sendError, setSendError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SendInput>({ resolver: zodResolver(sendSchema) });

  // ── Transactions ──
  const fetchTransactions = useCallback(async (p: number) => {
    setTxLoading(true);
    try {
      const res = await fetch(`/api/wallet/transactions?page=${p}`);
      const data = await res.json();
      setTransactions(data.transactions);
      setPagination(data.pagination);
    } catch (err) {
      console.error("Failed to fetch transactions", err);
    } finally {
      setTxLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) fetchTransactions(page);
  }, [loading, page, fetchTransactions]);

  // ── Sync with Provider's SSE ──
  useEffect(() => {
    const handleWalletUpdate = () => {
      fetchTransactions(1);
      setPage(1);
    };

    window.addEventListener("wallet_update", handleWalletUpdate);
    return () => window.removeEventListener("wallet_update", handleWalletUpdate);
  }, [fetchTransactions]);

  // ── Send ──
  async function onSend(data: SendInput) {
    console.log(data)
    setSendError("");
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
    reset();
    refreshBalance();
    fetchTransactions(1);
    setPage(1);
  }

  if (loading) {
    return (
      <div className={s.content}>
        <div className={s.topRow}>
          <div
            className={`${s.balanceCard} ${s.skeleton}`}
            style={{ height: "160px" }}
          />
          <div
            className={`${s.sendCard}   ${s.skeleton}`}
            style={{ height: "160px" }}
          />
        </div>
        <div
          className={`${s.historyCard} ${s.skeleton}`}
          style={{ height: "320px" }}
        />
      </div>
    );
  }

  return (
    <div className={s.content}>
      {/* Top row */}
      <div className={s.topRow}>
        {/* Balance */}
        <div className={s.balanceCard}>
          <p className={s.balanceLabel}>Wallet balance</p>
          <p className={s.balanceAmount}>
            ₹{balance !== null ? formatAmount(balance) : "—"}
          </p>
          <p className={s.balanceMeta}>{user?.email}</p>
          <div className={s.balanceActions}>
            <button className={s.btnGhost}>
              <ArrowDownLeft size={13} strokeWidth={1.5} />
              Add money
            </button>
          </div>
        </div>

        {/* Send */}
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

      {/* Transaction history */}
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
                      {tx.note ? `${tx.note} · ` : ""}
                      {formatDate(tx.createdAt)}
                    </p>
                  </div>
                </div>
                <div className={s.txRight}>
                  <p
                    className={
                      tx.type === "debit"
                        ? s.txAmountDebit
                        : tx.type === "credit"
                          ? s.txAmountCredit
                          : s.txAmountFailed
                    }
                  >
                    {tx.type === "debit"
                      ? "− "
                      : tx.type === "credit"
                        ? "+ "
                        : ""}
                    ₹{formatAmount(tx.amount)}
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
  );
}
