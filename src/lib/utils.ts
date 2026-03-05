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
  SSN_DOB: "SSN / Date of Birth",
  SSN_ONLY: "SSN (Secure)",
  FULL_INTAKE: "Full Intake Form",
} as const;

export type LinkType = keyof typeof LINK_TYPES;

export const LINK_STATUS_LABELS: Record<string, string> = {
  CREATED: "Created",
  OPENED: "Opened",
  SUBMITTED: "Submitted",
  EXPIRED: "Expired",
};

export const LINK_STATUS_COLORS: Record<string, string> = {
  CREATED: "bg-blue-50 text-blue-700 border-blue-200",
  OPENED: "bg-yellow-50 text-yellow-700 border-yellow-200",
  SUBMITTED: "bg-green-50 text-green-700 border-green-200",
  EXPIRED: "bg-gray-100 text-gray-500 border-gray-200",
};
