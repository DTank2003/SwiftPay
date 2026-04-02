"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import s from "./analytics.module.css";

interface Summary {
  totalSent: number;
  totalReceived: number;
  txCount: number;
  netFlow: number;
}

interface DailyData {
  date: string;
  label: string;
  sent: number;
  received: number;
}

interface RecentTx {
  id: string;
  amount: number;
  status: string;
  type: "debit" | "credit";
  counterparty: string;
  createdAt: string;
  note?: string;
}

function formatAmount(n: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(n));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

// Custom tooltip for recharts — styled to match dark theme
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
          marginBottom: "0.375rem",
        }}
      >
        {label}
      </p>
      {payload.map((p: any) => (
        <p
          key={p.name}
          style={{ fontSize: "0.8125rem", color: p.color, fontWeight: 500 }}
        >
          {p.name === "sent" ? "Sent" : "Received"}: ₹{formatAmount(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [daily, setDaily] = useState<DailyData[]>([]);
  const [recent, setRecent] = useState<RecentTx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((data) => {
        setSummary(data.summary);
        setDaily(data.daily);
        setRecent(data.recent);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className={s.page}>
        <div
          className={`${s.skeleton}`}
          style={{ height: "120px", borderRadius: "0.75rem" }}
        />
        <div
          className={`${s.skeleton}`}
          style={{ height: "280px", borderRadius: "0.75rem" }}
        />
      </div>
    );
  }
console.log(recent)
  return (
    <div className={s.page}>
      <div>
        <p className={s.pageTitle}>Analytics</p>
        <p className={s.pageSubtitle}>Your activity this month</p>
      </div>

      {/* ── Summary cards ── */}
      <div className={s.summaryGrid}>
        <div className={s.summaryCard}>
          <p className={s.summaryLabel}>Total sent</p>
          <p className={s.summaryValue}>₹{formatAmount(summary!.totalSent)}</p>
          <p className={s.summaryMeta}>This month</p>
        </div>
        <div className={s.summaryCard}>
          <p className={s.summaryLabel}>Total received</p>
          <p className={s.summaryValue}>
            ₹{formatAmount(summary!.totalReceived)}
          </p>
          <p className={s.summaryMeta}>This month</p>
        </div>
        <div className={s.summaryCard}>
          <p className={s.summaryLabel}>Transactions</p>
          <p className={s.summaryValue}>{summary!.txCount}</p>
          <p className={s.summaryMeta}>Completed this month</p>
        </div>
        <div className={s.summaryCard}>
          <p className={s.summaryLabel}>Net flow</p>
          <p
            className={`${s.summaryValue} ${
              summary!.netFlow >= 0
                ? s.summaryValuePositive
                : s.summaryValueNegative
            }`}
          >
            {summary!.netFlow >= 0 ? "+" : "−"}₹{formatAmount(summary!.netFlow)}
          </p>
          <p className={s.summaryMeta}>Received minus sent</p>
        </div>
      </div>

      {/* ── Bar chart ── */}
      <div className={s.chartCard}>
        <div className={s.chartHeader}>
          <p className={s.chartTitle}>Daily activity — last 7 days</p>
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
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={daily} barGap={4} barCategoryGap="30%">
            <CartesianGrid
              vertical={false}
              stroke="#1f1f23"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "#a1a1aa", fontSize: 11, fontFamily: "inherit" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#a1a1aa", fontSize: 11, fontFamily: "inherit" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `₹${v >= 1000 ? `${v / 1000}k` : v}`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#18181b" }} />
            <Bar dataKey="sent" fill="#f87171" radius={[3, 3, 0, 0]} />
            <Bar dataKey="received" fill="#4ade80" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Bottom row ── */}
      <div className={s.bottomRow}>
        {/* Recent transactions */}
        <div className={s.recentCard}>
          <div className={s.recentHeader}>
            <p className={s.recentTitle}>Recent transactions</p>
          </div>
          {recent.map((tx) => (
            <div key={tx.id} className={s.recentRow}>
              <div>
                <p className={s.recentName}>{tx.counterparty}</p>
                <p className={s.txMeta}>
                  {tx.note ? `${tx.note} · ` : ""}
                  {formatDate(tx.createdAt)}
                </p>
              </div>
              <p
                className={
                  tx.type === "debit"
                    ? s.recentAmountDebit
                    : s.recentAmountCredit
                }
              >
                {tx.type === "debit" ? "−" : "+"} ₹{formatAmount(tx.amount)}
              </p>
            </div>
          ))}
        </div>

        {/* Quick stats */}
        <div className={s.statsCard}>
          <p className={s.statsCardTitle}>Breakdown</p>
          <div className={s.statRow}>
            <p className={s.statRowLabel}>Avg transaction size</p>
            <p className={s.statRowValue}>
              ₹
              {summary!.txCount > 0
                ? formatAmount(
                    (summary!.totalSent + summary!.totalReceived) /
                      summary!.txCount,
                  )
                : 0}
            </p>
          </div>
          <div className={s.statRow}>
            <p className={s.statRowLabel}>Largest single flow</p>
            <p className={s.statRowValue}>
              ₹
              {formatAmount(
                Math.max(...daily.map((d) => Math.max(d.sent, d.received)), 0),
              )}
            </p>
          </div>
          <div className={s.statRow}>
            <p className={s.statRowLabel}>Most active day</p>
            <p className={s.statRowValue}>
              {
                daily.reduce(
                  (best, d) =>
                    d.sent + d.received > best.sent + best.received ? d : best,
                  daily[0] ?? { label: "—", sent: 0, received: 0 },
                ).label
              }
            </p>
          </div>
          <div className={s.statRow}>
            <p className={s.statRowLabel}>Send/receive ratio</p>
            <p className={s.statRowValue}>
              {summary!.totalReceived > 0
                ? (summary!.totalSent / summary!.totalReceived).toFixed(2)
                : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
