"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  name: string;
  email: string;
}

interface Notification {
  id: string;
  type: "payment_received" | "payment_sent";
  text: string;
  createdAt: string;
  read: boolean;
}

interface DashboardContextType {
  user: User | null;
  balance: number | null;
  notifications: Notification[];
  loading: boolean;
  refreshBalance: () => Promise<void>;
  markNotificationsAsRead: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(
  undefined,
);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet/balance");
      if (res.ok) {
        const { balance } = await res.json();
        setBalance(balance);
      }
    } catch (err) {
      console.error("Failed to refresh balance", err);
    }
  }, []);

  const bootstrap = useCallback(async () => {
    try {
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


      const notifRes = await fetch("/api/notifications/list");
      const { notifications } = await notifRes.json();
      setNotifications(notifications);
    } catch (err) {
      console.error("Dashboard bootstrap failed", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // SSE for notifications
  useEffect(() => {
    if (loading || !user) return;
    const es = new EventSource("/api/notifications/sse");
    es.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (event.type === "connected") return;
      // Refresh balance
      refreshBalance();
      // Trigger a custom event so pages can refresh their data (like transactions)
      window.dispatchEvent(new CustomEvent("wallet_update", { detail: event }));

      if (event.type !== "payment_received") return;

      // Add to notifications
      const notif: Notification = {
        id: crypto.randomUUID(),
        type: event.type,
        text: `₹${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 }).format(event.amount)} received from ${event.fromName}`,
        time: event.timestamp,
        read: false,
      };

      setNotifications((prev) => [notif, ...prev]);
    };
    return () => es.close();
  }, [loading, user, refreshBalance]);

  const markNotificationsAsRead = async () => {
    try {
      await fetch("/api/notifications/mark-read", {
        method: "PATCH",
      });

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error("Failed to mark notifications as read", err);
    }
  };

  return (
    <DashboardContext.Provider
      value={{
        user,
        balance,
        notifications,
        loading,
        refreshBalance,
        markNotificationsAsRead,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
