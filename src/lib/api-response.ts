import { NextResponse } from "next/server";
import { NO_STORE_HEADERS } from "@/lib/http";

type ErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  const payload: ErrorPayload = {
    error: details ? { code, message, details } : { code, message },
  };
  return NextResponse.json(payload, { status, headers: NO_STORE_HEADERS });
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS });
}
