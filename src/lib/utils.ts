import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isExpired(expiresAt: Date | string): boolean {
  return new Date(expiresAt) < new Date();
}

export const LINK_TYPES = {
  BANKING_INFO: "Banking Information",
  SSN_ONLY: "Social Security Number",
  FULL_INTAKE: "Full Intake Form",
  ID_UPLOAD: "Photo ID Upload",
} as const;

export type LinkType = keyof typeof LINK_TYPES;

export const LINK_STATUS_LABELS: Record<string, string> = {
  CREATED: "Created",
  OPENED: "Opened",
  SUBMITTED: "Submitted",
  EXPIRED: "Expired",
};

export const LINK_STATUS_COLORS: Record<string, string> = {
  CREATED: "bg-amber-50 text-amber-700 ring-amber-200/70",
  OPENED: "bg-amber-50 text-amber-700 ring-amber-200/70",
  SUBMITTED: "bg-blue-50 text-blue-700 ring-blue-200/70",
  EXPIRED: "bg-red-50 text-red-700 ring-red-200/70",
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
};
