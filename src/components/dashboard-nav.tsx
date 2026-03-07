"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Lock, LayoutDashboard, Plus, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  user: { name: string; email: string; agentSlug: string };
}

export function DashboardNav({ user }: Props) {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", label: "Links", icon: LayoutDashboard },
    { href: "/dashboard/new", label: "New link", icon: Plus },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
  ];

  return (
    <header className="bg-card/95 border-b border-border backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center">
              <Lock className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-foreground text-sm">
              Secure Links
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  (href === "/dashboard" ? pathname === href : pathname.startsWith(href))
                    ? "bg-primary/15 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-muted-foreground truncate max-w-[160px]">
              {user.name}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4" />
              <span className="sr-only">Sign out</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
