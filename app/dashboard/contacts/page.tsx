"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Search, ArrowUpRight, UserPlus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import s from "./page.module.css";

interface ContactUser {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface Contact {
  id: string;
  nickname: string | null;
  user: ContactUser;
}

const sendSchema = z.object({
  amount: z.coerce.number().positive("Must be positive").max(100000),
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

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [recent, setRecent] = useState<ContactUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ContactUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  // Pay modal
  const [payTarget, setPayTarget] = useState<ContactUser | null>(null);
  const [payError, setPayError] = useState("");

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

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

  const fetchContacts = useCallback(async () => {
    const [contactsRes, recentRes] = await Promise.all([
      fetch("/api/contacts"),
      fetch("/api/contacts/recent"),
    ]);
    const { contacts } = await contactsRes.json();
    const { recent } = await recentRes.json();
    setContacts(contacts);
    setRecent(recent);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Debounced search
  useEffect(() => {
    clearTimeout(searchTimeout.current);
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const res = await fetch(
        `/api/contacts/search?q=${encodeURIComponent(searchQuery)}`,
      );
      const data = await res.json();
      setSearchResults(data.users);
      setSearching(false);
    }, 300);

    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery]);

  async function handleAddContact(user: ContactUser) {
    await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactUserId: user.id }),
    });
    showToast(`${user.name} added to contacts`);
    fetchContacts();
  }

  async function handleDeleteContact(contactId: string, name: string) {
    await fetch(`/api/contacts/${contactId}`, { method: "DELETE" });
    showToast(`${name} removed from contacts`);
    fetchContacts();
  }

  async function onPay(data: SendInput) {
    if (!payTarget) return;
    setPayError("");
    console.log(data);
    console.log(payTarget);
    try {
      const res = await fetch("/api/wallet/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toPhone: payTarget.phone, ...data }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || "Payment failed");
        // setPayError(json.error || "Payment failed");
        return;
      }
      setPayTarget(null);
      reset();
      showToast(`₹${formatAmount(data.amount)} sent to ${payTarget.name}`);
    } catch {
      setPayError("Something went wrong. Please try again.");
    }
  }

  console.log(recent);

  // Check if a user is already a contact
  const isContact = (userId: string) =>
    contacts.some((c) => c.user.id === userId);

  return (
    <div className={s.page}>
      <div className={s.topbar}>
        <div>
          <p className={s.topbarTitle}>Contacts</p>
          <p className={s.topbarSub}>Saved people and recent payees</p>
        </div>
      </div>

      <div className={s.content}>
        {/* Search */}
        <div className={s.searchBar}>
          <Search size={15} className={s.searchIcon} />
          <input
            type="text"
            placeholder="Search by name or email to add contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={s.searchInput}
          />
        </div>

        {/* Search results */}
        {searchQuery.length >= 2 && (
          <div className={s.searchResults}>
            {searching ? (
              <div className={s.emptyState}>
                <div
                  className={s.skeleton}
                  style={{ width: "100px", height: "12px" }}
                />
              </div>
            ) : searchResults.length === 0 ? (
              <div className={s.emptyState}>
                <p className={s.emptyTitle}>No users found</p>
              </div>
            ) : (
              searchResults.map((user) => (
                <div key={user.id} className={s.searchResultRow}>
                  <div className={s.contactLeft}>
                    <div className={s.avatar}>{initials(user.name)}</div>
                    <div>
                      <p className={s.contactName}>{user.name}</p>
                      <p className={s.contactPhone}>{user.phone}</p>
                    </div>
                  </div>
                  <div className={s.contactActions}>
                    <button
                      className={s.btnPay}
                      onClick={() => {
                        setPayTarget(user);
                        setPayError("");
                        reset();
                      }}
                    >
                      <ArrowUpRight size={12} strokeWidth={1.5} />
                      Pay
                    </button>
                    {!isContact(user.id) && (
                      <button
                        className={s.btnAdd}
                        onClick={() => handleAddContact(user)}
                      >
                        <UserPlus size={12} strokeWidth={1.5} />
                        Save
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <div className={s.grid}>
          {/* Saved contacts */}
          <div className={s.card}>
            <div className={s.cardHead}>
              <p className={s.cardTitle}>Saved contacts</p>
              <p className={s.cardCount}>{contacts.length}</p>
            </div>

            {loading ? (
              <div className={s.emptyState}>
                <div
                  className={s.skeleton}
                  style={{ width: "100px", height: "12px" }}
                />
              </div>
            ) : contacts.length === 0 ? (
              <div className={s.emptyState}>
                <p className={s.emptyTitle}>No saved contacts</p>
                <p className={s.emptySubtitle}>Search above to add people</p>
              </div>
            ) : (
              contacts.map((c) => (
                <div key={c.id} className={s.contactRow}>
                  <div className={s.contactLeft}>
                    <div className={s.avatar}>{initials(c.user.name)}</div>
                    <div>
                      <p className={s.contactName}>
                        {c.nickname ?? c.user.name}
                      </p>
                      <p className={s.contactPhone}>{c.user.phone}</p>
                    </div>
                  </div>
                  <div className={s.contactActions}>
                    <button
                      className={s.btnPay}
                      onClick={() => {
                        setPayTarget(c.user);
                        setPayError("");
                        reset();
                      }}
                    >
                      <ArrowUpRight size={12} strokeWidth={1.5} />
                      Pay
                    </button>
                    <button
                      className={`${s.btnIcon} ${s.btnIconDanger}`}
                      onClick={() => handleDeleteContact(c.id, c.user.name)}
                    >
                      <Trash2 size={13} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Recent payees */}
          <div className={s.card}>
            <div className={s.cardHead}>
              <p className={s.cardTitle}>Recent payees</p>
              <p className={s.cardCount}>Last 5</p>
            </div>

            {loading ? (
              <div className={s.emptyState}>
                <div
                  className={s.skeleton}
                  style={{ width: "100px", height: "12px" }}
                />
              </div>
            ) : recent.length === 0 ? (
              <div className={s.emptyState}>
                <p className={s.emptyTitle}>No recent payees</p>
                <p className={s.emptySubtitle}>Send money to see them here</p>
              </div>
            ) : (
              recent.map((user) => (
                <div key={user.id} className={s.contactRow}>
                  <div className={s.contactLeft}>
                    <div className={s.avatar}>{initials(user.name)}</div>
                    <div>
                      <p className={s.contactName}>{user.name}</p>
                      <p className={s.contactPhone}>{user.phone}</p>
                    </div>
                  </div>
                  <div className={s.contactActions}>
                    <button
                      className={s.btnPay}
                      onClick={() => {
                        setPayTarget(user);
                        setPayError("");
                        reset();
                      }}
                    >
                      <ArrowUpRight size={12} strokeWidth={1.5} />
                      Pay
                    </button>
                    {!isContact(user.id) && (
                      <button
                        className={s.btnAdd}
                        onClick={() => handleAddContact(user)}
                      >
                        <UserPlus size={12} strokeWidth={1.5} />
                        Save
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Pay modal */}
      {payTarget && (
        <div className={s.modalOverlay} onClick={() => setPayTarget(null)}>
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <div>
                <p className={s.modalTitle}>Pay {payTarget.name}</p>
                <p className={s.modalSubtitle}>{payTarget.email}</p>
              </div>
              <button
                className={s.modalCloseBtn}
                onClick={() => setPayTarget(null)}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSubmit(onPay)}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div>
                <label className={s.fieldLabel}>Amount (₹)</label>
                <input
                  {...register("amount")}
                  type="number"
                  placeholder="500"
                  min="1"
                  className={`${s.input} ${errors.amount ? s.errorBanner : ""}`}
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

              {payError && (
                <div className={s.errorBanner}>
                  <p className={s.errorText}>{payError}</p>
                </div>
              )}

              <div className={s.modalActions}>
                <button
                  type="button"
                  className={s.btnGhost}
                  onClick={() => setPayTarget(null)}
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
                    <>
                      <ArrowUpRight size={13} strokeWidth={1.5} /> Send
                    </>
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
