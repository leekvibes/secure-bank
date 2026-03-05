export function isPastRetention(deleteAt: Date, now = new Date()): boolean {
  return deleteAt.getTime() < now.getTime();
}

export function retentionDeleteAt(
  createdAt: Date,
  retentionDays: number,
  fallbackDays = 3650
): Date {
  const days = retentionDays > 0 ? retentionDays : fallbackDays;
  return new Date(createdAt.getTime() + days * 24 * 60 * 60 * 1000);
}
