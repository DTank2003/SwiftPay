"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, X, Plus, ArrowDownLeft } from "lucide-react";
import s from "./page.module.css";

interface RequestUser {
  id: string;
  name: string;
  phone: string;
}

interface PaymentRequest {
  id: string;
  amount: number;
  note: string | null;
  status: "PENDING" | "PAID" | "REJECTED" | "EXPIRED";
  createdAt: string;
  fromUser: RequestUser;
  toUser: RequestUser;
}

type Tab = "incoming" | "outgoing";

const requestSchema = z.object({
  toPhone: z.string().regex(/^\d{10}$/, "Invalid phone number"),
  amount: z.coerce.number().positive("Must be positive").max(100000),
  note: z.string().max(100).optional(),
});
type RequestInput = z.infer<typeof requestSchema>;

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

export default function RequestsPage() {
  const [tab, setTab] = useState<Tab>("incoming");
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [toast, setToast] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RequestInput>({ resolver: zodResolver(requestSchema) as any });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }

  const fetchRequests = useCallback(async (t: Tab) => {
    setLoading(true);
    const res = await fetch(`/api/requests?tab=${t}`);
    const data = await res.json();
    setRequests(data.requests);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests(tab);
  }, [tab, fetchRequests]);

  async function handleAction(id: string, action: "accept" | "reject") {
    setActioningId(id);
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || "Action failed");
        return;
      }
      showToast(action === "accept" ? "Payment sent" : "Request rejected");
      fetchRequests(tab);
    } catch {
      showToast("Something went wrong");
    } finally {
      setActioningId(null);
    }
  }

  async function onCreateRequest(data: RequestInput) {
    setCreateError("");
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setCreateError(json.error || "Failed to send request");
        return;
      }
      setModalOpen(false);
      reset();
      showToast(`Request sent for ₹${formatAmount(data.amount)}`);
      if (tab === "outgoing") fetchRequests("outgoing");
      else setTab("outgoing");
    } catch {
      setCreateError("Something went wrong. Please try again.");
    }
  }

  const pendingIncoming = requests.filter((r) => r.status === "PENDING").length;

  function getBadgeClass(status: PaymentRequest["status"]) {
    switch (status) {
      case "PENDING":
        return s.badgePending;
      case "PAID":
        return s.badgePaid;
      case "REJECTED":
        return s.badgeRejected;
      case "EXPIRED":
        return s.badgeExpired;
    }
  }

  return (
    <div className={s.page}>
      <div className={s.topbar}>
        <div className={s.topbarLeft}>
          <p className={s.topbarTitle}>Payment requests</p>
          <p className={s.topbarSub}>Request and manage money from others</p>
        </div>
        <div className={s.topbarActions}>
          <button
            className={s.btnPrimary}
            onClick={() => {
              setModalOpen(true);
              setCreateError("");
              reset();
            }}
          >
            <Plus size={13} strokeWidth={1.5} />
            Request money
          </button>
        </div>
      </div>

      <div className={s.content}>
        {/* Tabs */}
        <div className={s.tabs}>
          <button
            className={`${s.tab} ${tab === "incoming" ? s.tabActive : ""}`}
            onClick={() => setTab("incoming")}
          >
            <ArrowDownLeft size={13} strokeWidth={1.5} />
            Incoming
            {tab === "incoming" && pendingIncoming > 0 && (
              <span className={s.tabBadge}>{pendingIncoming}</span>
            )}
          </button>
          <button
            className={`${s.tab} ${tab === "outgoing" ? s.tabActive : ""}`}
            onClick={() => setTab("outgoing")}
          >
            Outgoing
          </button>
        </div>

        {/* List */}
        <div className={s.requestList}>
          {loading ? (
            <div className={s.emptyState}>
              <div
                className={s.skeleton}
                style={{ width: "120px", height: "14px" }}
              />
            </div>
          ) : requests.length === 0 ? (
            <div className={s.emptyState}>
              <p className={s.emptyTitle}>No {tab} requests</p>
              <p className={s.emptySubtitle}>
                {tab === "incoming"
                  ? "When someone requests money, it appears here"
                  : "Click 'Request money' to send a request"}
              </p>
            </div>
          ) : (
            requests.map((req) => {
              const counterparty =
                tab === "incoming" ? req.fromUser : req.toUser;
              const isPending = req.status === "PENDING";
              const isActioning = actioningId === req.id;

              return (
                <div key={req.id} className={s.requestRow}>
                  <div className={s.requestLeft}>
                    <div className={s.avatar}>
                      {initials(counterparty.name)}
                    </div>
                    <div>
                      <p className={s.requestName}>
                        {tab === "incoming"
                          ? `${counterparty.name} requested`
                          : `You requested from ${counterparty.name}`}
                      </p>
                      <p className={s.requestMeta}>
                        {formatDate(req.createdAt)}
                        {req.note ? ` · ${req.note}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className={s.requestRight}>
                    <p className={s.requestAmount}>
                      ₹{formatAmount(req.amount)}
                    </p>

                    {tab === "incoming" && isPending ? (
                      <div className={s.requestActions}>
                        <button
                          className={s.btnAccept}
                          disabled={isActioning}
                          onClick={() => handleAction(req.id, "accept")}
                        >
                          {isActioning ? (
                            <span className={s.spinner} />
                          ) : (
                            <Check size={12} strokeWidth={2} />
                          )}
                          Accept
                        </button>
                        <button
                          className={s.btnReject}
                          disabled={isActioning}
                          onClick={() => handleAction(req.id, "reject")}
                        >
                          <X size={12} strokeWidth={2} />
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`${s.badge} ${getBadgeClass(req.status)}`}
                      >
                        {req.status.toLowerCase()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create request modal */}
      {modalOpen && (
        <div className={s.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <div>
                <p className={s.modalTitle}>Request money</p>
                <p className={s.modalSubtitle}>
                  They'll get notified instantly
                </p>
              </div>
              <button
                className={s.modalCloseBtn}
                onClick={() => setModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSubmit(onCreateRequest as any)}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div>
                <label className={s.fieldLabel}>Their phone number</label>
                <input
                  {...register("toPhone")}
                  type="tel"
                  placeholder="9876543210"
                  className={`${s.input} ${errors.toPhone ? s.inputError : ""}`}
                />
                {errors.toPhone && (
                  <p className={s.errorText}>{errors.toPhone.message}</p>
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

              <div>
                <label className={s.fieldLabel}>Note (optional)</label>
                <input
                  {...register("note")}
                  type="text"
                  placeholder="Dinner split, rent..."
                  className={s.input}
                />
              </div>

              {createError && (
                <div className={s.errorBanner}>
                  <p className={s.errorText}>{createError}</p>
                </div>
              )}

              <div className={s.modalActions}>
                <button
                  type="button"
                  className={s.btnGhost}
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
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
                    "Send request"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={s.toast}>
          <p className={s.toastText}>{toast}</p>
        </div>
      )}
    </div>
  );
}
