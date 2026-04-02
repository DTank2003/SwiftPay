"use client";

import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { useDashboard } from "./DashboardProvider";
import s from "../layout.module.css";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
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

export function Topbar() {
  const { user, notifications, markNotificationsAsRead } = useDashboard();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggleNotif() {
    setNotifOpen((v) => !v);
  }

  return (
    <header className={s.topbar}>
      <div>
        <p className={s.topbarGreeting}>Good {getTimeOfDay()},</p>
        <p className={s.topbarName}>{user?.name}</p>
      </div>

      <div className={s.topbarActionsInner} ref={notifRef}>
        <button className={s.topbarBtn} onClick={toggleNotif}>
          <Bell size={14} strokeWidth={1.5} />
          {unreadCount > 0 && (
            <span className={s.notifBadge}>{unreadCount}</span>
          )}
        </button>

        {notifOpen && (
          <div className={s.notifDropdown}>
            <div className={s.notifDropdownHead}>
              <p className={s.notifDropdownTitle}>Notifications</p>
              {notifications.length > 0 && (
                <button
                  className={s.notifClearBtn}
                  onClick={markNotificationsAsRead}
                >
                  Mark all as read
                </button>
              )}
            </div>
            <div className={s.notifList}>
              {notifications.filter((n) => !n.read).length === 0 ? (
                <p className={s.notifEmpty}>No notifications yet</p>
              ) : (
                notifications
                  .filter((n) => !n.read)
                  .map((n) => (
                    <div
                      key={n.id}
                      className={`${s.notifItem} ${
                        n.type === "payment_received"
                          ? s.notifItemReceived
                          : s.notifItemSent
                      }`}
                    >
                      <p className={s.notifItemText}>{n.text}</p>
                      <p className={s.notifItemTime}>{timeAgo(n.createdAt)}</p>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        <div className={s.avatar}>{user ? initials(user.name) : "—"}</div>
      </div>
    </header>
  );
}
