import React from "react";
import { Sidebar } from "./_components/Sidebar";
import { Topbar } from "./_components/Topbar";
import { BottomNav } from "./_components/BottomNav";
import { DashboardProvider } from "./_components/DashboardProvider";
import s from "./layout.module.css";

export const metadata = {
  title: "SwiftPay | Dashboard",
  description: "Manage your wallet and transactions.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardProvider>
      <div className={s.shell}>
        <Sidebar />
        <main className={s.main}>
          <Topbar />
          {children}
        </main>
        <BottomNav />
      </div>
    </DashboardProvider>
  );
}
