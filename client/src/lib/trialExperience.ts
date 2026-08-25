export type TrialStatus = {
  isActive: boolean;
  daysRemaining: number;
  endsAt: Date;
};

export function getTrialStatus(createdAt?: string | Date | null, now = new Date()): TrialStatus | null {
  if (!createdAt) return null;
  const startedAt = new Date(createdAt);
  if (Number.isNaN(startedAt.getTime())) return null;
  const endsAt = new Date(startedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const remainingMs = endsAt.getTime() - now.getTime();
  return {
    isActive: remainingMs > 0,
    daysRemaining: Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000))),
    endsAt,
  };
}
