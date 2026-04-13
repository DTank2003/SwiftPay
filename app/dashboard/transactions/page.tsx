"use client";

import { useEffect, useState, useCallback } from "react";
import s from "./page.module.css";

interface Transaction {
  id: string;
  amount: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  type: "debit" | "credit" | "failed" | "topup";
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

type TypeFilter = "all" | "sent" | "received";
type StatusFilter = "all" | "PENDING" | "COMPLETED" | "FAILED";

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(
    async (p: number, type: TypeFilter, status: StatusFilter) => {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(p),
        type,
        status,
      });
      const res = await fetch(`/api/wallet/transactions?${params}`);
      const data = await res.json();
      setTransactions(data.transactions);
      setPagination(data.pagination);
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    fetchTransactions(page, typeFilter, statusFilter);
  }, [page, typeFilter, statusFilter, fetchTransactions]);

  // Reset to page 1 when filters change
  function handleTypeFilter(f: TypeFilter) {
    setTypeFilter(f);
    setPage(1);
  }

  function handleStatusFilter(f: StatusFilter) {
    setStatusFilter(f);
    setPage(1);
  }

  return (
    <div className={s.page}>
      <div className={s.topbar}>
        <div>
          <p className={s.topbarTitle}>Transactions</p>
          <p className={s.topbarSub}>Your full payment history</p>
        </div>
      </div>

      <div className={s.content}>
        {/* Filters */}
        <div className={s.filters}>
          {/* Type filter */}
          <div className={s.filterGroup}>
            <span className={s.filterLabel}>Show</span>
            <select
              className={s.filterSelect}
              value={typeFilter}
              onChange={(e) => handleTypeFilter(e.target.value as TypeFilter)}
            >
              <option value="all">All</option>
              <option value="sent">Sent</option>
              <option value="received">Received</option>
            </select>
          </div>

          {/* Status filter */}
          <div className={s.filterGroup}>
            <span className={s.filterLabel}>Status</span>
            <select
              className={s.filterSelect}
              value={statusFilter}
              onChange={(e) =>
                handleStatusFilter(e.target.value as StatusFilter)
              }
            >
              <option value="all">All</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          {pagination && (
            <span className={s.resultCount}>
              {pagination.total} transaction{pagination.total !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Table */}
        <div className={s.tableCard}>
          {loading ? (
            <div className={s.emptyState}>
              <div
                className={s.skeleton}
                style={{ width: "120px", height: "14px" }}
              />
            </div>
          ) : transactions.length === 0 ? (
            <div className={s.emptyState}>
              <p className={s.emptyTitle}>No transactions found</p>
              <p className={s.emptySubtitle}>Try adjusting your filters</p>
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
                          : tx.type === "credit"
                            ? s.txAmountCredit
                            : tx.type === "topup"
                              ? s.txAmountCredit
                              : s.txAmountFailed
                      }
                    >
                      {tx.type === "debit"
                        ? "− "
                        : tx.type === "credit" || tx.type === "topup"
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
    </div>
  );
}
