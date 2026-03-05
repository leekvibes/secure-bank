export function isRevealBlocked(
  viewOnce: boolean,
  revealedAt: Date | null
): boolean {
  return viewOnce && revealedAt !== null;
}

