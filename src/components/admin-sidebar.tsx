"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { Shield, LayoutDashboard, Users, AlertTriangle, Menu, X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  user: { name: string; email: string };
}

const NAV = [
  { href: "/admin", label: "Mission Control", icon: LayoutDashboard, exact: true },
  { href: "/admin/accounts", label: "Accounts", icon: Users, exact: false },
  { href: "/admin/fraud", label: "Fraud Signals", icon: AlertTriangle, exact: false },
];

export function AdminSidebar({ user }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 w-60 bg-sidebar-bg flex-col z-30 hidden lg:flex border-r border-sidebar-border">
        <div className="h-16 flex items-center px-5 border-b border-sidebar-border shrink-0 gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-600 shadow-sm">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-foreground tracking-tight text-sm leading-tight">Admin</p>
            <p className="text-[10px] text-muted-foreground leading-tight">SecureLink Control</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "nav-item group relative",
                  active ? "nav-item-active" : "nav-item-inactive"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-active" />
                )}
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0 transition-colors",
                    active ? "text-sidebar-active" : "text-sidebar-fg group-hover:text-foreground"
                  )}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border shrink-0">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-red-600/10 text-red-600 font-bold text-xs flex items-center justify-center shrink-0 ring-1 ring-red-600/20">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate leading-tight">{user.name}</p>
              <p className="text-[10px] text-red-600 font-semibold uppercase tracking-wide">Admin</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              title="Sign out"
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <header className="lg:hidden fixed top-0 inset-x-0 h-14 bg-sidebar-bg border-b border-sidebar-border z-30 flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <Shield className="w-5 h-5 text-red-600" />
        <span className="font-semibold text-foreground text-sm flex-1">Admin</span>
        <button onClick={() => signOut({ callbackUrl: "/" })} className="text-muted-foreground hover:text-foreground p-1.5">
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-20">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <nav className="absolute top-14 left-0 right-0 bg-sidebar-bg border-b border-sidebar-border p-3 space-y-0.5 shadow-lg">
            {NAV.map(({ href, label, icon: Icon, exact }) => {
              const active = isActive(href, exact);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn("nav-item relative", active ? "nav-item-active" : "nav-item-inactive")}
                >
                  {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-active" />}
                  <Icon className={cn("w-4 h-4 shrink-0", active ? "text-sidebar-active" : "text-sidebar-fg")} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
