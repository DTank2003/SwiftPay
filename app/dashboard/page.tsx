"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUpRight, Bell } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import s from "./page.module.css";

interface User {
  id: string;
  name: string;
  email: string;
}

interface RecentTx {
  id: string;
  amount: number;
  status: string;
  type: "debit" | "credit" | "failed" | "topup";
  counterparty: string;
  createdAt: string;
}

interface DailyData {
  label: string;
  sent: number;
  received: number;
}

interface Summary {
  totalSent: number;
  totalReceived: number;
  txCount: number;
  netFlow: number;
}

interface Notification {
  id: string;
  type: string;
  text: string;
  time: string;
  read: boolean;
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

function formatAmount(n: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatAmountShort(n: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(n));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#18181b",
        border: "0.5px solid #27272a",
        borderRadius: "0.5rem",
        padding: "0.625rem 0.875rem",
        fontFamily: "inherit",
      }}
    >
      <p
        style={{
          fontSize: "0.75rem",
          color: "#71717a",
          marginBottom: "0.25rem",
        }}
      >
        {label}
      </p>
      {payload.map((p: any) => (
        <p
          key={p.name}
          style={{ fontSize: "0.8125rem", color: p.color, fontWeight: 500 }}
        >
          {p.name === "sent" ? "Sent" : "Received"}: ₹
          {formatAmountShort(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [daily, setDaily] = useState<DailyData[]>([]);
  const [recent, setRecent] = useState<RecentTx[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendError, setSendError] = useState("");
  const [toast, setToast] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SendInput>({ resolver: zodResolver(sendSchema) });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }

  // ── Bootstrap ──
  const fetchAll = useCallback(async () => {
    const [userRes, balRes, analyticsRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/wallet/balance"),
      fetch("/api/analytics"),
    ]);

    if (!userRes.ok) {
      router.push("/login");
      return;
    }

    const { user } = await userRes.json();
    const { balance } = await balRes.json();
    const { summary, daily, recent } = await analyticsRes.json();

    setUser(user);
    setBalance(balance);
    setSummary(summary);
    setDaily(daily);
    setRecent(recent);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── SSE ──
  useEffect(() => {
    if (loading) return;
    const es = new EventSource("/api/notifications/sse");
    es.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (event.type === "connected") return;

      fetch("/api/wallet/balance")
        .then((r) => r.json())
        .then(({ balance }) => setBalance(balance));
      fetchAll();

      if (event.type === "payment_received") {
        setNotifications((prev) => [
          {
            id: crypto.randomUUID(),
            type: "payment_received",
            text: `₹${formatAmount(event.amount)} received from ${event.fromName}`,
            time: new Date().toISOString(),
            read: false,
          },
          ...prev,
        ]);
      }

      if (event.type === "balance_credited") {
        setNotifications((prev) => [
          {
            id: crypto.randomUUID(),
            type: "balance_credited",
            text: `₹${formatAmount(event.amount)} added to your wallet`,
            time: new Date().toISOString(),
            read: false,
          },
          ...prev,
        ]);
      }
    };
    es.onerror = () => console.warn("[SSE] retrying...");
    return () => es.close();
  }, [loading, fetchAll]);

  // ── Close notif on outside click ──
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // ── Send ──
  async function onSend(data: SendInput) {
    setSendError("");
    try {
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
      showToast(`₹${formatAmount(data.amount)} sent to ${json.recipient}`);
      fetchAll();
    } catch {
      setSendError("Something went wrong. Please try again.");
    }
  }

  if (loading) {
    return (
      <div className={s.page}>
        <div className={s.content}>
          <div className={s.statsRow}>
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className={`${s.statCard} ${s.skeleton}`}
                style={{ height: "90px" }}
              />
            ))}
          </div>
          <div className={s.midRow}>
            <div
              className={`${s.sendCard} ${s.skeleton}`}
              style={{ height: "220px" }}
            />
            <div
              className={`${s.chartCard} ${s.skeleton}`}
              style={{ height: "220px" }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={s.page}>
      {/* Topbar */}
      <div className={s.topbar}>
        <div className={s.topbarLeft}>
          <p>Good {getTimeOfDay()},</p>
          <p>{user?.name}</p>
        </div>
        <div className={s.topbarRight} ref={notifRef}>
          <button
            className={s.iconBtn}
            onClick={() => {
              setNotifOpen((v) => !v);
              setNotifications((prev) =>
                prev.map((n) => ({ ...n, read: true })),
              );
            }}
          >
            <Bell size={14} strokeWidth={1.5} />
            {unreadCount > 0 && (
              <span className={s.notifBadge}>{unreadCount}</span>
            )}
          </button>

          {notifOpen && (
            <div className={s.notifDropdown}>
              <div className={s.notifHead}>
                <p className={s.notifTitle}>Notifications</p>
                {notifications.length > 0 && (
                  <button
                    className={s.notifClear}
                    onClick={() => {
                      setNotifications([]);
                      setNotifOpen(false);
                    }}
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className={s.notifList}>
                {notifications.length === 0 ? (
                  <p className={s.notifEmpty}>No notifications yet</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`${s.notifItem} ${
                        n.type === "payment_received"
                          ? s.notifItemReceived
                          : s.notifItemSent
                      }`}
                    >
                      <p className={s.notifItemText}>{n.text}</p>
                      <p className={s.notifItemTime}>{timeAgo(n.time)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className={s.avatar}>{user ? initials(user.name) : "—"}</div>
        </div>
      </div>

      <div className={s.content}>
        {/* Stats row */}
        <div className={s.statsRow}>
          <div className={s.statCard}>
            <p className={s.statLabel}>Wallet balance</p>
            <p className={s.statValue}>
              ₹{balance !== null ? formatAmountShort(balance) : "—"}
            </p>
            <p className={s.statMeta}>Available</p>
          </div>
          <div className={s.statCard}>
            <p className={s.statLabel}>Sent this month</p>
            <p className={s.statValue}>
              ₹{formatAmountShort(summary?.totalSent ?? 0)}
            </p>
            <p className={s.statMeta}>{summary?.txCount ?? 0} transactions</p>
          </div>
          <div className={s.statCard}>
            <p className={s.statLabel}>Received this month</p>
            <p className={s.statValue}>
              ₹{formatAmountShort(summary?.totalReceived ?? 0)}
            </p>
            <p className={s.statMeta}>This month</p>
          </div>
          <div className={s.statCard}>
            <p className={s.statLabel}>Net flow</p>
            <p
              className={`${s.statValue} ${
                (summary?.netFlow ?? 0) >= 0
                  ? s.statValuePositive
                  : s.statValueNegative
              }`}
            >
              {(summary?.netFlow ?? 0) >= 0 ? "+" : "−"}₹
              {formatAmountShort(summary?.netFlow ?? 0)}
            </p>
            <p className={s.statMeta}>Received minus sent</p>
          </div>
        </div>

        {/* Mid row — send + chart */}
        <div className={s.midRow}>
          {/* Send money */}
          <div className={s.sendCard}>
            <p className={s.cardTitle}>Send money</p>
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
                className={s.btnPrimary}
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

          {/* Chart */}
          <div className={s.chartCard}>
            <div className={s.chartHeader}>
              <p className={s.cardTitle} style={{ margin: 0 }}>
                Last 7 days
              </p>
              <div className={s.chartLegend}>
                <div className={s.legendItem}>
                  <div className={`${s.legendDot} ${s.legendDotSent}`} />
                  Sent
                </div>
                <div className={s.legendItem}>
                  <div className={`${s.legendDot} ${s.legendDotReceived}`} />
                  Received
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={daily} barGap={4} barCategoryGap="30%">
                <CartesianGrid
                  vertical={false}
                  stroke="#1f1f23"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="label"
                  tick={{
                    fill: "#a1a1aa",
                    fontSize: 11,
                    fontFamily: "inherit",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{
                    fill: "#a1a1aa",
                    fontSize: 11,
                    fontFamily: "inherit",
                  }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${v >= 1000 ? `${v / 1000}k` : v}`}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "#18181b" }}
                />
                <Bar dataKey="sent" fill="#f87171" radius={[3, 3, 0, 0]} />
                <Bar dataKey="received" fill="#4ade80" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom row — recent txns + breakdown */}
        <div className={s.bottomRow}>
          {/* Recent transactions */}
          <div className={s.recentCard}>
            <div className={s.recentHead}>
              <p className={s.recentHeadTitle}>Recent transactions</p>
              <Link href="/dashboard/transactions" className={s.viewAll}>
                View all →
              </Link>
            </div>
            {recent.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center" }}>
                <p className={s.recentDate}>No transactions yet</p>
              </div>
            ) : (
              recent.map((tx) => (
                <div key={tx.id} className={s.recentRow}>
                  <div className={s.recentLeft}>
                    <div className={s.recentAvatar}>
                      {initials(tx.counterparty)}
                    </div>
                    <div>
                      <p className={s.recentName}>{tx.counterparty}</p>
                      <p className={s.recentDate}>{formatDate(tx.createdAt)}</p>
                    </div>
                  </div>
                  <p
                    className={
                      tx.type === "debit"
                        ? s.recentAmountDebit
                        : tx.type === "credit"
                          ? s.recentAmountCredit
                          : tx.type === "topup"
                            ? s.recentAmountCredit
                            : s.recentAmountFailed
                    }
                  >
                    {tx.type === "debit"
                      ? "− "
                      : tx.type === "credit" || tx.type === "topup"
                        ? "+ "
                        : ""}
                    ₹{formatAmountShort(tx.amount)}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Breakdown */}
          <div className={s.breakdownCard}>
            <p className={s.cardTitle}>Breakdown</p>
            <div className={s.breakdownRow}>
              <p className={s.breakdownLabel}>Avg transaction</p>
              <p className={s.breakdownValue}>
                ₹
                {(summary?.txCount ?? 0) > 0
                  ? formatAmountShort(
                      ((summary?.totalSent ?? 0) +
                        (summary?.totalReceived ?? 0)) /
                        (summary?.txCount ?? 1),
                    )
                  : 0}
              </p>
            </div>
            <div className={s.breakdownRow}>
              <p className={s.breakdownLabel}>Most active day</p>
              <p className={s.breakdownValue}>
                {daily.length > 0
                  ? daily.reduce((best, d) =>
                      d.sent + d.received > best.sent + best.received
                        ? d
                        : best,
                    ).label
                  : "—"}
              </p>
            </div>
            <div className={s.breakdownRow}>
              <p className={s.breakdownLabel}>Send / receive ratio</p>
              <p className={s.breakdownValue}>
                {(summary?.totalReceived ?? 0) > 0
                  ? (
                      (summary?.totalSent ?? 0) / (summary?.totalReceived ?? 1)
                    ).toFixed(2)
                  : "—"}
              </p>
            </div>
            <div className={s.breakdownRow}>
              <p className={s.breakdownLabel}>Total transactions</p>
              <p className={s.breakdownValue}>{summary?.txCount ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className={s.toast}>
          <p className={s.toastText}>{toast}</p>
        </div>
      )}
    </div>
  );
}
