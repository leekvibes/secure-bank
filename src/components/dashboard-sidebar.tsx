"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import {
  Lock, LayoutDashboard, Inbox,
  Upload, Settings, LogOut, Link2, Menu, X, FolderUp, FileSignature, MessageSquare, CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  user: { name: string; email: string };
}

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/links", label: "Secure Links", icon: Link2, exact: false },
  { href: "/dashboard/submissions", label: "Submissions", icon: Inbox },
  { href: "/dashboard/uploads", label: "Uploads", icon: Upload },
  { href: "/dashboard/transfers", label: "Transfers", icon: FolderUp, beta: true },
  { href: "/dashboard/docsign", label: "Signing", icon: FileSignature, beta: true },
  { href: "/dashboard/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/pricing", label: "Upgrade Plan", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardSidebar({ user }: Props) {
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
    if (href === "/dashboard/links")
      return pathname.startsWith("/dashboard/links") || pathname === "/dashboard/new" || pathname.startsWith("/dashboard/forms");
    return pathname.startsWith(href);
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 w-60 bg-sidebar-bg flex-col z-30 hidden lg:flex border-r border-sidebar-border">
        <div className="h-16 flex items-center px-5 border-b border-sidebar-border shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary shadow-sm">
            <Lock className="w-4 h-4 text-white" />
          </div>
          <span className="ml-2.5 font-semibold text-foreground tracking-tight text-sm">
            Secure Link
          </span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon, exact, beta }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "nav-item group relative",
                  active
                    ? "nav-item-active"
                    : "nav-item-inactive"
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
                <span>{label}</span>
                {beta ? (
                  <span className="ml-auto rounded-full border border-amber-300/60 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    Beta
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border shrink-0">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 ring-1 ring-primary/20">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate leading-tight">
                {user.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
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
          className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors shrink-0"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary shrink-0">
          <Lock className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-semibold text-foreground text-sm flex-1">Secure Link</span>

        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-muted-foreground hover:text-foreground p-1.5 shrink-0 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-20">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <nav className="absolute top-14 left-0 right-0 bg-sidebar-bg border-b border-sidebar-border p-3 space-y-0.5 animate-slide-up shadow-lg">
            {NAV.map(({ href, label, icon: Icon, exact, beta }) => {
              const active = isActive(href, exact);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "nav-item relative",
                    active
                      ? "nav-item-active"
                      : "nav-item-inactive"
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-active" />
                  )}
                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0",
                      active ? "text-sidebar-active" : "text-sidebar-fg"
                    )}
                  />
                  <span>{label}</span>
                  {beta ? (
                    <span className="ml-auto rounded-full border border-amber-300/60 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      Beta
                    </span>
                  ) : null}
                </Link>
              );
            })}
            <div className="pt-2 mt-2 border-t border-sidebar-border">
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
