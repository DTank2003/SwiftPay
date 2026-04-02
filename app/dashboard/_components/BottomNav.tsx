"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { History, BarChart2, LogOut } from "lucide-react";
import s from "../layout.module.css";

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <nav className={s.bottomNav}>
      <Link
        href="/dashboard"
        className={`${s.bottomNavItem} ${pathname === "/dashboard" ? s.bottomNavItemActive : ""}`}
      >
        <History size={18} strokeWidth={1.5} />
        Home
      </Link>
      <Link
        href="/dashboard/analytics"
        className={`${s.bottomNavItem} ${pathname === "/dashboard/analytics" ? s.bottomNavItemActive : ""}`}
      >
        <BarChart2 size={18} strokeWidth={1.5} />
        Analytics
      </Link>
      <button className={s.bottomNavItem} onClick={logout}>
        <LogOut size={18} strokeWidth={1.5} />
        Sign out
      </button>
    </nav>
  );
}
