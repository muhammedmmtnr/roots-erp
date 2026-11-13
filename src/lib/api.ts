import { NextResponse } from "next/server";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(error: unknown) {
  console.error("ERP API request failed:", error);
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const code = error instanceof Error && "code" in error ? String(error.code) : "";
  const status = message === "Not found"
    ? 404
    : message.startsWith("Invalid ") || message.startsWith("Insufficient stock")
      ? 400
      : code === "23505"
        ? 409
        : 500;
  const responseMessage = code === "23505"
    ? "A product with this SKU or barcode already exists"
    : message;
  return json({ error: responseMessage }, status);
}

export async function readJson(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new Error("Invalid request body");
  }
}

export function requiredText(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid ${field}`);
  return value.trim();
}

export function optionalText(value: unknown, field: string, fallback = "") {
  if (value === undefined) return fallback;
  if (typeof value !== "string") throw new Error(`Invalid ${field}`);
  return value.trim();
}

export function numberValue(value: unknown, field: string, fallback?: number) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}
