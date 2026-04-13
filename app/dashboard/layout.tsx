"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Zap,
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Users,
  Bell,
  LogOut,
  HandCoins,
} from "lucide-react";
import s from "./layout.module.css";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  {
    href: "/dashboard/transactions",
    label: "Transactions",
    icon: ArrowLeftRight,
  },
  { href: "/dashboard/contacts", label: "Contacts", icon: Users },
  { href: "/dashboard/requests", label: "Requests", icon: HandCoins },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className={s.shell}>
      <aside className={s.sidebar}>
        <div className={s.brand}>
          <div className={s.brandIcon}>
            <Zap size={14} color="#a1a1aa" strokeWidth={1.5} />
          </div>
          <span className={s.brandName}>SwiftPay</span>
        </div>

        <nav className={s.nav}>
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`${s.navItem} ${pathname === href ? s.navItemActive : ""}`}
            >
              <Icon size={14} strokeWidth={1.5} />
              {label}
            </Link>
          ))}
        </nav>

        <div className={s.sidebarFooter}>
          <button className={s.navItem} onClick={logout}>
            <LogOut size={14} strokeWidth={1.5} />
            Sign out
          </button>
        </div>
      </aside>

      <div className={s.main}>{children}</div>

      {/* Mobile bottom nav */}
      <nav className={s.bottomNav}>
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`${s.bottomNavItem} ${pathname === href ? s.bottomNavItemActive : ""}`}
          >
            <Icon size={18} strokeWidth={1.5} />
            {label}
          </Link>
        ))}
        <button className={s.bottomNavItem} onClick={logout}>
          <LogOut size={18} strokeWidth={1.5} />
          Out
        </button>
      </nav>
    </div>
  );
}
