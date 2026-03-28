"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { Shield, LayoutDashboard, Users, Activity, Server, Menu, X, LogOut, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  user: { name?: string | null; email?: string | null };
}

const NAV = [
  { href: "/adminn", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/adminn/users", label: "Users", icon: Users, exact: false },
  { href: "/adminn/activity", label: "Activity", icon: Activity, exact: false },
  { href: "/adminn/system", label: "System Health", icon: Server, exact: false },
];

export function AdminnnSidebar({ user }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="h-16 flex items-center px-5 border-b border-white/10 shrink-0 gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#00A3FF] flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="font-bold text-white text-sm leading-tight">Mission Control</p>
          <p className="text-[10px] text-white/40 leading-tight">mysecurelink.co/adminn</p>
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
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-[#00A3FF]/15 text-[#00A3FF]"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-[#00A3FF]/20 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-[#00A3FF]">
              {(user.name ?? user.email ?? "A")[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user.name ?? "Admin"}</p>
            <p className="text-[10px] text-white/40 truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/auth" })}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/40 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
        <Link href="/dashboard" className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/40 hover:text-white hover:bg-white/5 transition-colors">
          <Zap className="w-3.5 h-3.5" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-[#0D1425] border-r border-white/10 z-30 hidden lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile toggle */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden w-9 h-9 bg-[#0D1425] border border-white/10 rounded-lg flex items-center justify-center"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-4 h-4 text-white" /> : <Menu className="w-4 h-4 text-white" />}
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-64 bg-[#0D1425] border-r border-white/10 z-50 lg:hidden">
            <SidebarContent />
          </aside>
        </>
      )}
    </>
  );
}
