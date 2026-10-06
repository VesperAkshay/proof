import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "HANDLE_TAKEN"
  | "HANDLE_RESERVED"
  | "HANDLE_INVALID"
  | "USER_NOT_FOUND"
  | "RATE_LIMITED"
  | "ILLEGAL_TRANSITION"
  | "SLUG_TAKEN"
  | "INVALID_SLUG"
  | "INVALID_PROOF_LIST"
  | "INTERNAL_ERROR";

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    request_id?: string;
    details?: Record<string, unknown>;
  };
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  const requestId = crypto.randomUUID();
  return NextResponse.json(
    {
      error: {
        code,
        message,
        request_id: requestId,
        details: details || {},
      },
    },
    { status }
  );
}

export function apiSuccess<T>(data: T, status = 200, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, { status, ...init });
}
