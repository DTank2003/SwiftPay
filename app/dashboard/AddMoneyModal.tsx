"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import s from "./dashboard.module.css";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);
const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

function CheckoutForm({
  amount,
  onSuccess,
  onCancel,
}: {
  amount: number;
  onSuccess: (newBalance: number) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    if (loading) return;
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError("");

    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment(
        {
          elements,
          redirect: "if_required",
          confirmParams: {
            return_url: `${window.location.origin}/dashboard`,
          },
        },
      );

      if (stripeError) {
        setError(stripeError.message ?? "Payment failed");
        setLoading(false);
        return;
      }

      if (paymentIntent?.status === "succeeded") {
        const res = await fetch("/api/wallet/add-money/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
        });

        // Ensure we handle non-JSON responses (e.g. 500 errors)
        let json;
        try {
          json = await res.json();
        } catch (e) {
          throw new Error("Server returned an invalid response");
        }

        if (!res.ok) {
          setError(json.error || "Failed to credit wallet");
          setLoading(false);
          return;
        }
        onSuccess(json.newBalance);
        setError("");
      }
    } catch (err: any) {
      console.error("[SUBMIT_PAYMENT_ERROR]", err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={s.checkoutForm}>
      <PaymentElement />
      {error && (
        <div className={s.errorBanner}>
          <p className={s.errorText}>{error}</p>
        </div>
      )}
      <div className={s.modalActions}>
        <button type="button" className={s.btnGhost} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          className={s.btnPrimary}
        >
          {loading ? (
            <>
              <span className={s.spinner} /> Processing...
            </>
          ) : (
            `Pay ₹${amount.toLocaleString("en-IN")}`
          )}
        </button>
      </div>
    </form>
  );
}

export function AddMoneyModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
}) {
  const [amount, setAmount] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleProceed() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (amt > 100000) {
      setError("Max ₹1,00,000 per transaction");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/wallet/add-money/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt }),
      });

      let json;
      try {
        json = await res.json();
      } catch (e) {
        throw new Error("Server returned an invalid response");
      }

      if (!res.ok) {
        setError(json.error || "Failed to initiate payment");
        return;
      }
      setClientSecret(json.clientSecret);
    } catch (err: any) {
      console.error("[PROCEED_PAYMENT_ERROR]", err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  const stripeOptions = {
    clientSecret: clientSecret!,
    appearance: {
      theme: "night" as const,
      variables: {
        colorBackground: "#18181b",
        colorSurface: "#111113",
        colorText: "#fafafa",
        colorTextSecondary: "#71717a",
        colorTextPlaceholder: "#3f3f46",
        colorIcon: "#a1a1aa",
        colorDanger: "#f87171",
        borderRadius: "8px",
        fontFamily: "JetBrains Mono, monospace",
        fontSizeBase: "13px",
        spacingUnit: "4px",
      },
    },
    paymentMethodCreation: "manual" as const,
  };

  return (
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <div className={s.modalHeader}>
          <div>
            <p className={s.modalTitle}>Add money</p>
            <p className={s.modalSubtitle}>
              {clientSecret
                ? `Paying ₹${parseFloat(amount).toLocaleString("en-IN")}`
                : "Select or enter amount"}
            </p>
          </div>
          <button className={s.modalCloseBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {!clientSecret ? (
          <>
            <div className={s.quickAmounts}>
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  className={`${s.quickAmount} ${amount === String(amt) ? s.quickAmountActive : ""}`}
                  onClick={() => {
                    setAmount(String(amt));
                    setError("");
                  }}
                >
                  ₹{amt.toLocaleString("en-IN")}
                </button>
              ))}
            </div>

            <div>
              <label className={s.fieldLabel}>Custom amount (₹)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError("");
                }}
                placeholder="Enter amount"
                className={s.input}
                min="1"
                max="100000"
              />
            </div>

            {error && (
              <div className={s.errorBanner}>
                <p className={s.errorText}>{error}</p>
              </div>
            )}

            <div className={s.modalActions}>
              <button className={s.btnGhost} onClick={onClose}>
                Cancel
              </button>
              <button
                className={s.btnPrimary}
                onClick={handleProceed}
                disabled={!amount || loading}
              >
                {loading ? (
                  <>
                    <span className={s.spinner} /> Loading...
                  </>
                ) : (
                  "Continue"
                )}
              </button>
            </div>
          </>
        ) : (
          <Elements stripe={stripePromise} options={stripeOptions}>
            <CheckoutForm
              amount={parseFloat(amount)}
              onSuccess={(newBalance) => {
                onSuccess(newBalance);
                onClose();
              }}
              onCancel={onClose}
            />
          </Elements>
        )}
      </div>
    </div>
  );
}
