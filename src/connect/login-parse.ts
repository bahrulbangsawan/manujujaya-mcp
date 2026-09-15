export type LoginNextStep =
  | "redirect"
  | "select_merchant"
  | "select_outlet"
  | "verify_otp"
  | "unknown";

export interface ParsedLoginResponse {
  ok: boolean;
  status: number;
  message: string;
  nextStep: LoginNextStep | null;
  redirectUrl?: string;
  merchants?: unknown[];
  outlets?: unknown[];
  merchant?: unknown;
  mobile?: string;
  merchantId?: number;
  verifyKey?: string;
  raw: unknown;
}

/**
 * Parse Qasir auth envelope `{ status, message, next_step, data }`.
 * status === 1 is success (unlike POS code: 200).
 */
export function parseLoginResponse(json: unknown): ParsedLoginResponse {
  if (!json || typeof json !== "object") {
    return {
      ok: false,
      status: 0,
      message: "Non-object login response",
      nextStep: null,
      raw: json,
    };
  }
  const o = json as Record<string, unknown>;
  const status = typeof o.status === "number" ? o.status : 0;
  const message = typeof o.message === "string" ? o.message : "";
  const next =
    typeof o.next_step === "string" ? (o.next_step as LoginNextStep) : null;
  const data =
    o.data && typeof o.data === "object"
      ? (o.data as Record<string, unknown>)
      : {};

  const base: ParsedLoginResponse = {
    ok: status === 1,
    status,
    message,
    nextStep: next,
    raw: json,
  };

  if (next === "redirect") {
    const redirectUrl =
      typeof data.redirect_url === "string" ? data.redirect_url : undefined;
    return { ...base, redirectUrl };
  }
  if (next === "select_merchant") {
    return {
      ...base,
      merchants: Array.isArray(data.merchants) ? data.merchants : [],
    };
  }
  if (next === "select_outlet") {
    return {
      ...base,
      outlets: Array.isArray(data.outlets) ? data.outlets : [],
      merchant: data.merchant,
    };
  }
  if (next === "verify_otp") {
    return {
      ...base,
      mobile: typeof data.mobile === "string" ? data.mobile : undefined,
      merchantId:
        typeof data.merchant_id === "number" ? data.merchant_id : undefined,
      verifyKey:
        typeof data.verify_key === "string" ? data.verify_key : undefined,
    };
  }
  return base;
}

export function normalizeUsername(input: string): string {
  const t = input.trim();
  if (t.includes("@")) return t.toLowerCase();
  // Phone: digits only; ensure leading 62 if starts with 8
  let digits = t.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (digits.startsWith("8")) digits = `62${digits}`;
  return digits;
}

export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}
