import { db } from "@/lib/db";
import Link from "next/link";
import { Search, Shield, Ban } from "lucide-react";

const PLAN_COLORS: Record<string, string> = { FREE: "bg-gray-500/20 text-gray-400", BEGINNER: "bg-blue-500/20 text-blue-400", PRO: "bg-[#00A3FF]/20 text-[#00A3FF]", AGENCY: "bg-purple-500/20 text-purple-400" };

export default async function AdminnnUsersPage({
  searchParams,
}: {
  searchParams: { search?: string; plan?: string; page?: string };
}) {
  const search = searchParams.search ?? "";
  const plan = searchParams.plan ?? "";
  const page = parseInt(searchParams.page ?? "1");
  const limit = 25;

  const where: Record<string, unknown> = { role: "AGENT" };
  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { displayName: { contains: search, mode: "insensitive" } },
    ];
  }
  if (plan) where.plan = plan;

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true, email: true, displayName: true, plan: true, planOverride: true,
        emailVerified: true, bannedAt: true, createdAt: true, stripeCustomerId: true,
        _count: { select: { links: true, forms: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.user.count({ where }),
  ]);

  const pages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Users</h1>
          <p className="text-sm text-white/40 mt-0.5">{total.toLocaleString()} total accounts</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <form className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              name="search"
              defaultValue={search}
              placeholder="Search email or name..."
              className="w-full h-10 bg-[#0D1425] border border-white/10 rounded-xl pl-9 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#00A3FF]/40"
            />
          </div>
          <select
            name="plan"
            defaultValue={plan}
            className="h-10 bg-[#0D1425] border border-white/10 rounded-xl px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00A3FF]/40"
          >
            <option value="">All plans</option>
            <option value="FREE">Free</option>
            <option value="BEGINNER">Beginner</option>
            <option value="PRO">Pro</option>
            <option value="AGENCY">Agency</option>
          </select>
          <button type="submit" className="h-10 px-5 bg-[#00A3FF] text-white text-sm font-semibold rounded-xl hover:bg-[#0091E6] transition-colors">
            Filter
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-[#0D1425] rounded-2xl border border-white/10 overflow-hidden">
        <div className="grid grid-cols-[1fr_140px_100px_80px_80px_50px] gap-4 px-5 py-3 border-b border-white/10 text-xs font-semibold text-white/40 uppercase tracking-wide">
          <span>User</span>
          <span>Plan</span>
          <span>Links</span>
          <span>Verified</span>
          <span>Status</span>
          <span />
        </div>
        {users.map((user) => (
          <Link
            key={user.id}
            href={`/adminn/users/${user.id}`}
            className="grid grid-cols-[1fr_140px_100px_80px_80px_50px] gap-4 px-5 py-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors items-center group"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate group-hover:text-[#00A3FF] transition-colors">{user.displayName}</p>
              <p className="text-xs text-white/40 truncate">{user.email}</p>
            </div>
            <div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${PLAN_COLORS[user.plan] ?? "bg-white/10 text-white/60"}`}>
                {user.plan}
                {user.planOverride && <span className="ml-1 opacity-60">&#10022;</span>}
              </span>
            </div>
            <span className="text-sm text-white/60 tabular-nums">{user._count.links}</span>
            <span className={`text-xs font-medium ${user.emailVerified ? "text-emerald-400" : "text-amber-400"}`}>
              {user.emailVerified ? "✓" : "Pending"}
            </span>
            <span>
              {user.bannedAt ? (
                <span className="text-xs text-red-400 font-medium flex items-center gap-1"><Ban className="w-3 h-3" />Banned</span>
              ) : (
                <span className="text-xs text-emerald-400 flex items-center gap-1"><Shield className="w-3 h-3" />Active</span>
              )}
            </span>
            <span className="text-white/20 group-hover:text-white/60 text-sm">→</span>
          </Link>
        ))}
        {users.length === 0 && (
          <div className="px-5 py-12 text-center text-white/30 text-sm">No users found.</div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/40">Page {page} of {pages} · {total} users</p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/adminn/users?search=${search}&plan=${plan}&page=${page - 1}`} className="h-9 px-4 bg-[#0D1425] border border-white/10 rounded-lg text-sm text-white hover:border-white/30 transition-colors flex items-center">
                ← Prev
              </Link>
            )}
            {page < pages && (
              <Link href={`/adminn/users?search=${search}&plan=${plan}&page=${page + 1}`} className="h-9 px-4 bg-[#0D1425] border border-white/10 rounded-lg text-sm text-white hover:border-white/30 transition-colors flex items-center">
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
