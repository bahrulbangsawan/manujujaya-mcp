import type { ToolCallError } from "../bridge/bridge";

export interface ErrorCopy {
  title: string;
  body: string;
  /** Whether to offer "Coba lagi". */
  retryable: boolean;
  /** Reconnect page (QASIR_AUTH_EXPIRED only, http(s) URLs only). */
  connectUrl?: string;
}

function safeHttpUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

/** Indonesian copy for a failed tool call (spec §5). */
export function errorCopy(err: ToolCallError): ErrorCopy {
  switch (err.code) {
    case "QASIR_AUTH_EXPIRED": {
      const connectUrl = safeHttpUrl(err.connectUrl);
      return {
        title: "Perlu menghubungkan ulang",
        body: "Sesi Qasir sudah berakhir. Pemilik perlu menghubungkan ulang.",
        retryable: false,
        ...(connectUrl ? { connectUrl } : {}),
      };
    }
    case "QASIR_RATE_LIMITED":
      return { title: "Qasir sedang sibuk", body: "Qasir sedang membatasi permintaan. Coba lagi sebentar lagi.", retryable: true };
    case "UPSTREAM_TIMEOUT":
    case "RESULT_LIMIT_EXCEEDED":
      return { title: "Data terlalu besar", body: "Data terlalu besar atau lambat. Persempit rentang tanggal.", retryable: true };
    case "FORBIDDEN":
      return { title: "Akses ditolak", body: "Akses ditolak untuk akun ini.", retryable: true };
    case "INVALID_INPUT":
      return { title: "Filter tidak valid", body: "Filter tidak valid.", retryable: true };
    default:
      return { title: "Gagal memuat data", body: "Terjadi kesalahan saat mengambil data Qasir.", retryable: true };
  }
}
