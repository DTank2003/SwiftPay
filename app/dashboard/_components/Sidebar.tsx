"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Zap, History, BarChart2, LogOut } from "lucide-react";
import s from "../layout.module.css";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <aside className={s.sidebar}>
      <div className={s.sidebarBrand}>
        <div className={s.sidebarBrandIcon}>
          <Zap size={14} color="#a1a1aa" strokeWidth={1.5} />
        </div>
        <span className={s.sidebarBrandName}>SwiftPay</span>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <Link
          href="/dashboard"
          className={`${s.navItem} ${pathname === "/dashboard" ? s.navItemActive : ""}`}
        >
          <History size={14} strokeWidth={1.5} />
          Dashboard
        </Link>
        <Link
          href="/dashboard/analytics"
          className={`${s.navItem} ${pathname === "/dashboard/analytics" ? s.navItemActive : ""}`}
        >
          <BarChart2 size={14} strokeWidth={1.5} />
          Analytics
        </Link>
      </nav>

      <div className={s.sidebarFooter}>
        <button className={s.navItem} onClick={logout}>
          <LogOut size={14} strokeWidth={1.5} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
