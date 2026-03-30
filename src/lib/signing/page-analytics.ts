type AuditLike = {
  event: string;
  recipientId: string | null;
  metadata: string | null;
  createdAt: Date;
};

type PageLike = { page: number };

type RecipientLike = {
  id: string;
  name: string;
  email: string;
  status?: string;
  completedAt?: Date | null;
};

type ParsedPageView = {
  eventId: string | null;
  page: number;
  dwellMs: number;
  maxScrollPct: number;
  startedAt: Date;
  endedAt: Date;
};

type PageAggregate = {
  page: number;
  totalDwellMs: number;
  maxScrollPct: number;
  viewCount: number;
  firstViewedAt: Date | null;
  lastViewedAt: Date | null;
  completed: boolean;
};

function asDate(value: unknown, fallback: Date): Date {
  if (typeof value !== "string") return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function parsePageView(log: AuditLike): ParsedPageView | null {
  if (log.event !== "PAGE_VIEW" || !log.metadata) return null;
  try {
    const meta = JSON.parse(log.metadata) as Record<string, unknown>;
    const page = Number(meta.page ?? 0);
    const dwellMs = Number(meta.dwellMs ?? 0);
    const maxScrollPct = Math.max(0, Math.min(100, Number(meta.maxScrollPct ?? 0)));
    if (!Number.isInteger(page) || page <= 0) return null;
    if (!Number.isFinite(dwellMs) || dwellMs <= 0) return null;
    const startedAt = asDate(meta.startedAt, log.createdAt);
    const endedAt = asDate(meta.endedAt, log.createdAt);
    return {
      eventId: typeof meta.eventId === "string" ? meta.eventId : null,
      page,
      dwellMs: Math.max(0, Math.round(dwellMs)),
      maxScrollPct,
      startedAt,
      endedAt,
    };
  } catch {
    return null;
  }
}

function isPageCompleted(stats: { totalDwellMs: number; maxScrollPct: number }): boolean {
  // Default heuristic: at least 8s viewing + 80% scroll depth.
  return stats.totalDwellMs >= 8000 && stats.maxScrollPct >= 80;
}

export function buildReadingAnalytics(args: {
  auditLogs: AuditLike[];
  pages: PageLike[];
  recipients: RecipientLike[];
}) {
  const { auditLogs, pages, recipients } = args;
  const validPages = Array.from(
    new Set(pages.map((p) => p.page).filter((p) => Number.isInteger(p) && p > 0))
  ).sort((a, b) => a - b);
  const pageSet = new Set(validPages);

  const byRecipient = new Map<string, Map<number, PageAggregate>>();

  for (const log of auditLogs) {
    if (!log.recipientId) continue;
    const event = parsePageView(log);
    if (!event) continue;
    if (!pageSet.has(event.page)) continue;

    let pageMap = byRecipient.get(log.recipientId);
    if (!pageMap) {
      pageMap = new Map<number, PageAggregate>();
      byRecipient.set(log.recipientId, pageMap);
    }
    const current = pageMap.get(event.page) ?? {
      page: event.page,
      totalDwellMs: 0,
      maxScrollPct: 0,
      viewCount: 0,
      firstViewedAt: null,
      lastViewedAt: null,
      completed: false,
    };

    current.totalDwellMs += event.dwellMs;
    current.maxScrollPct = Math.max(current.maxScrollPct, event.maxScrollPct);
    current.viewCount += 1;
    current.firstViewedAt =
      !current.firstViewedAt || event.startedAt < current.firstViewedAt ? event.startedAt : current.firstViewedAt;
    current.lastViewedAt =
      !current.lastViewedAt || event.endedAt > current.lastViewedAt ? event.endedAt : current.lastViewedAt;
    current.completed = isPageCompleted(current);
    pageMap.set(event.page, current);
  }

  const recipientsOut = recipients.map((recipient) => {
    const pageMap = byRecipient.get(recipient.id) ?? new Map<number, PageAggregate>();
    const pagesOut = validPages.map((page) => {
      const found = pageMap.get(page);
      return (
        found ?? {
          page,
          totalDwellMs: 0,
          maxScrollPct: 0,
          viewCount: 0,
          firstViewedAt: null,
          lastViewedAt: null,
          completed: false,
        }
      );
    });
    const pagesViewed = pagesOut.filter((p) => p.viewCount > 0).length;
    const pagesCompleted = pagesOut.filter((p) => p.completed).length;
    const totalDwellMs = pagesOut.reduce((sum, p) => sum + p.totalDwellMs, 0);
    const unreadPages = pagesOut.filter((p) => !p.completed).map((p) => p.page);
    const readCompletenessPct = validPages.length > 0 ? Math.round((pagesCompleted / validPages.length) * 100) : 0;

    return {
      recipientId: recipient.id,
      recipientName: recipient.name,
      recipientEmail: recipient.email,
      status: recipient.status ?? null,
      completedAt: recipient.completedAt ?? null,
      pagesTotal: validPages.length,
      pagesViewed,
      pagesCompleted,
      totalDwellMs,
      readCompletenessPct,
      unreadPages,
      signedWithUnreadPages: Boolean(recipient.completedAt) && unreadPages.length > 0,
      pages: pagesOut,
    };
  });

  const totalDwellMs = recipientsOut.reduce((sum, r) => sum + r.totalDwellMs, 0);
  const avgReadCompletenessPct =
    recipientsOut.length > 0
      ? Math.round(recipientsOut.reduce((sum, r) => sum + r.readCompletenessPct, 0) / recipientsOut.length)
      : 0;
  const signedWithUnreadCount = recipientsOut.filter((r) => r.signedWithUnreadPages).length;

  return {
    pages: validPages,
    recipients: recipientsOut,
    summary: {
      totalDwellMs,
      avgReadCompletenessPct,
      signedWithUnreadCount,
      recipientCount: recipientsOut.length,
    },
  };
}
