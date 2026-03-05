import { LINK_TYPES, type LinkType } from "@/lib/utils";

export function linkTypeLabel(linkType: string): string {
  return LINK_TYPES[linkType as LinkType] ?? "secure";
}

export function buildTrustMessage(input: {
  clientName?: string | null;
  destination?: string | null;
  linkType: string;
  url: string;
}) {
  const greeting = input.clientName?.trim()
    ? `Hello ${input.clientName.trim()},`
    : "Hello,";
  const destination = input.destination?.trim() || "Internal processing";
  const formType = linkTypeLabel(input.linkType).toLowerCase();

  return `${greeting}

Please complete the secure form below to submit your ${formType} information.

This information will be securely delivered to ${destination} for processing.

${input.url}`;
}
