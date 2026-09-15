import { AppError, ErrorCodes } from "../errors/codes";
import { isApiTokenShape } from "./extract-token";

export interface PasteSessionInput {
  apiToken: string;
  csrfToken: string;
  cookie: string;
  outletId?: string;
  merchantSlug?: string;
}

export interface ValidatedPaste {
  apiToken: string;
  csrfToken: string;
  cookieJar: string;
  outletId: string;
  merchantSlug?: string;
}

export function validatePasteInput(input: PasteSessionInput): ValidatedPaste {
  const apiToken = input.apiToken?.trim() ?? "";
  const csrfToken = input.csrfToken?.trim() ?? "";
  const cookieJar = input.cookie?.trim() ?? "";
  const outletId = input.outletId?.trim() ?? "";
  const merchantSlug = input.merchantSlug?.trim() || undefined;

  if (!isApiTokenShape(apiToken)) {
    throw new AppError(
      ErrorCodes.INVALID_INPUT,
      "API_TOKEN must be exactly 32 alphanumeric characters",
    );
  }
  if (!csrfToken) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "CSRF token is required");
  }
  if (!cookieJar) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "Cookie string is required");
  }
  if (merchantSlug && !/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i.test(merchantSlug)) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "Invalid merchant slug");
  }
  return { apiToken, csrfToken, cookieJar, outletId, merchantSlug };
}
