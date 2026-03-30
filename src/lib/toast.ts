// src/lib/toast.ts
// Thin wrapper around use-toast for convenient global usage
import { toast as radixToast } from "@/components/ui/use-toast";

export const toast = {
  error: (message: string) =>
    radixToast({ description: message, variant: "destructive" }),
  success: (message: string) =>
    radixToast({ description: message }),
  info: (message: string) =>
    radixToast({ description: message }),
};
