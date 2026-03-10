import { requireAdmin } from "@/lib/auth/require-admin";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { AccountActions } from "./account-actions";

export const metadata = { title: "Accounts — Admin" };

const VERIFICATION_LABELS: Record<string, { label: string; color: string }> = {
  UNVERIFIED: { label: "Unverified", color: "text-gray-500 bg-gray-100" },
  LICENSED: { label: "Licensed", color: "text-blue-600 bg-blue-50" },
  CERTIFIED: { label: "Certified", color: "text-emerald-600 bg-emerald-50" },
  REGULATED: { label: "Regulated", color: "text-purple-600 bg-purple-50" },
};

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const auth = await requireAdmin();
  if ("error" in auth) redirect("/dashboard");

  const q = searchParams.q?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const limit = 50;
  const skip = (page - 1) * limit;

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { displayName: { contains: q, mode: "insensitive" as const } },
          { company: { contains: q, mode: "insensitive" as const } },
          { agencyName: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        displayName: true,
        company: true,
        agencyName: true,
        industry: true,
        verificationStatus: true,
        role: true,
        bannedAt: true,
        banReason: true,
        createdAt: true,
        _count: { select: { links: true } },
      },
    }),
    db.user.count({ where }),
  ]);

  const pages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">{total.toLocaleString()} total</p>
        </div>
        <form method="GET">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, email, company…"
            className="h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 w-64"
          />
        </form>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Company</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Links</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Verification</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => {
                const verification = VERIFICATION_LABELS[user.verificationStatus] ?? VERIFICATION_LABELS.UNVERIFIED;
                const isBanned = !!user.bannedAt;
                const isAdmin = user.role === "ADMIN";
                return (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                          {user.displayName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground truncate max-w-[140px]">{user.displayName}</p>
                          {isAdmin && <span className="text-[10px] text-red-600 font-semibold uppercase">Admin</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[180px]">{user.email}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell truncate max-w-[140px]">{user.company ?? user.agencyName ?? "—"}</td>
                    <td className="px-4 py-3 text-foreground tabular-nums hidden lg:table-cell">{user._count.links}</td>
                    <td className="px-4 py-3">
                      {isBanned ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">Banned</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${verification.color}`}>
                        {verification.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell tabular-nums">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Link
                          href={`/admin/accounts/${user.id}`}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors font-medium"
                        >
                          View
                        </Link>
                        <AccountActions userId={user.id} isBanned={isBanned} isAdmin={isAdmin} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">No accounts found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {pages}</p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/admin/accounts?q=${q}&page=${page - 1}`} className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
                Previous
              </Link>
            )}
            {page < pages && (
              <Link href={`/admin/accounts?q=${q}&page=${page + 1}`} className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
