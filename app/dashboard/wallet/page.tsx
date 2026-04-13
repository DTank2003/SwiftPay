"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, Plus, Wallet } from "lucide-react";
import { AddMoneyModal } from "../AddMoneyModal";
import s from "./page.module.css";

interface TopUp {
  id: string;
  amount: number;
  note: string | null;
  createdAt: string;
}

function formatAmount(n: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WalletPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [topups, setTopups] = useState<TopUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMoneyOpen, setAddMoneyOpen] = useState(false);

  async function fetchData() {
    const [balRes, userRes, txRes] = await Promise.all([
      fetch("/api/wallet/balance"),
      fetch("/api/auth/me"),
      fetch("/api/wallet/topups"),
    ]);
    const { balance } = await balRes.json();
    const { user } = await userRes.json();
    const { topups } = await txRes.json();
    setBalance(balance);
    setEmail(user.email);
    setTopups(topups);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className={s.page}>
        <div className={s.content}>
          <div
            className={`${s.balanceHero} ${s.skeleton}`}
            style={{ height: "140px" }}
          />
          <div
            className={`${s.historyCard} ${s.skeleton}`}
            style={{ height: "300px" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <div className={s.topbar}>
        <div>
          <p className={s.topbarTitle}>Wallet</p>
          <p className={s.topbarSub}>Manage your balance and top-ups</p>
        </div>
      </div>

      <div className={s.content}>
        {/* Balance hero */}
        <div className={s.balanceHero}>
          <div className={s.balanceLeft}>
            <p className={s.balanceLabel}>Available balance</p>
            <p className={s.balanceAmount}>
              ₹{balance !== null ? formatAmount(balance) : "—"}
            </p>
            <p className={s.balanceEmail}>{email}</p>
          </div>
          <div className={s.balanceActions}>
            <button
              className={s.btnGhost}
              onClick={() => setAddMoneyOpen(true)}
            >
              <ArrowDownLeft size={13} strokeWidth={1.5} />
              Add money
            </button>
          </div>
        </div>

        {/* Top-up history */}
        <div className={s.historyCard}>
          <div className={s.historyHead}>
            <p className={s.historyTitle}>Top-up history</p>
            <p className={s.historyCount}>{topups.length} top-ups</p>
          </div>

          {topups.length === 0 ? (
            <div className={s.emptyState}>
              <p className={s.emptyTitle}>No top-ups yet</p>
              <p className={s.emptySubtitle}>
                Add money to your wallet to get started
              </p>
            </div>
          ) : (
            topups.map((tx) => (
              <div key={tx.id} className={s.txRow}>
                <div className={s.txLeft}>
                  <div className={s.txIcon}>
                    <Wallet size={14} color="#60a5fa" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className={s.txName}>Wallet top-up</p>
                    <p className={s.txMeta}>{formatDate(tx.createdAt)}</p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p className={s.txAmount}>+ ₹{formatAmount(tx.amount)}</p>
                  <span className={s.badgeTopup}>via Stripe</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {addMoneyOpen && (
        <AddMoneyModal
          onClose={() => setAddMoneyOpen(false)}
          onSuccess={(newBalance) => {
            setBalance(newBalance);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
