import { describe, expect, it } from "vitest";
import { ToolCallError, parseToolResult, toToolCallError } from "../src/bridge/bridge";
import { errorCopy } from "../src/lib/errors";

const stockVelocity = {
  outlet_id: "100001",
  generated_at: "2026-09-15T03:00:00.000Z",
  truncated: false,
  truncated_reason: null,
  inventory_id: 5003,
  stock: 12,
  window_days: 30,
  sold: 45,
  refunded: 1,
  net_sold: 44,
  daily_rate: 1.47,
  days_of_cover: 8.16,
  oldest_scanned_at: null,
};

function thrown(fn: () => unknown): ToolCallError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ToolCallError);
    return err as ToolCallError;
  }
  throw new Error("expected a ToolCallError");
}

describe("parseToolResult", () => {
  it("returns structuredContent parsed with the contract, dropping unknown fields", () => {
    const data = parseToolResult("stock_velocity", { structuredContent: { ...stockVelocity, future_field: 1 } });
    expect(data.days_of_cover).toBe(8.16);
    expect("future_field" in data).toBe(false);
  });

  it("maps a JSON error body, including connect_url", () => {
    const err = thrown(() =>
      parseToolResult("stock_velocity", {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({ code: "QASIR_AUTH_EXPIRED", message: "Session expired", connect_url: "https://mcp.example/connect" }),
          },
        ],
      }),
    );
    expect(err.code).toBe("QASIR_AUTH_EXPIRED");
    expect(err.message).toBe("Session expired");
    expect(err.connectUrl).toBe("https://mcp.example/connect");
  });

  it("maps the SDK input-validation text to INVALID_INPUT", () => {
    const err = thrown(() =>
      parseToolResult("stock_page", {
        isError: true,
        content: [{ type: "text", text: "Input validation error: Invalid arguments for tool stock_page: page too big" }],
      }),
    );
    expect(err.code).toBe("INVALID_INPUT");
    expect(err.connectUrl).toBeUndefined();
  });

  it("maps any other error text (or a JSON body without code) to UPSTREAM_ERROR", () => {
    expect(thrown(() => parseToolResult("stock_page", { isError: true, content: [{ type: "text", text: "boom" }] })).code).toBe(
      "UPSTREAM_ERROR",
    );
    expect(
      thrown(() => parseToolResult("stock_page", { isError: true, content: [{ type: "text", text: '{"message":"x"}' }] })).code,
    ).toBe("UPSTREAM_ERROR");
    expect(thrown(() => parseToolResult("stock_page", { isError: true })).code).toBe("UPSTREAM_ERROR");
  });

  it("reports CONTRACT_MISMATCH when structuredContent is missing or malformed", () => {
    expect(thrown(() => parseToolResult("stock_velocity", {})).code).toBe("CONTRACT_MISMATCH");
    const err = thrown(() => parseToolResult("stock_velocity", { structuredContent: { ...stockVelocity, stock: "12" } }));
    expect(err.code).toBe("CONTRACT_MISMATCH");
    expect(err.message).toContain("stock");
  });
});

describe("toToolCallError", () => {
  it("keeps ToolCallErrors and maps SDK timeouts", () => {
    const original = new ToolCallError({ code: "FORBIDDEN", message: "no" });
    expect(toToolCallError(original)).toBe(original);
    expect(toToolCallError(Object.assign(new Error("Request timed out"), { code: "REQUEST_TIMEOUT" })).code).toBe("UPSTREAM_TIMEOUT");
    expect(toToolCallError(new Error("closed")).code).toBe("UPSTREAM_ERROR");
  });
});

describe("errorCopy", () => {
  const copy = (code: string, connect_url?: string) =>
    errorCopy(new ToolCallError({ code, message: "x", ...(connect_url ? { connect_url } : {}) }));

  it("offers the reconnect link only for auth expiry and never auto-retry", () => {
    expect(copy("QASIR_AUTH_EXPIRED", "https://mcp.example/connect")).toEqual({
      title: "Perlu menghubungkan ulang",
      body: "Sesi Qasir sudah berakhir. Pemilik perlu menghubungkan ulang.",
      retryable: false,
      connectUrl: "https://mcp.example/connect",
    });
    expect(copy("QASIR_AUTH_EXPIRED").connectUrl).toBeUndefined();
    expect(copy("QASIR_AUTH_EXPIRED", "javascript:alert(1)").connectUrl).toBeUndefined();
  });

  it("maps the remaining codes to the spec copy", () => {
    expect(copy("QASIR_RATE_LIMITED").body).toBe("Qasir sedang membatasi permintaan. Coba lagi sebentar lagi.");
    expect(copy("UPSTREAM_TIMEOUT").body).toBe("Data terlalu besar atau lambat. Persempit rentang tanggal.");
    expect(copy("RESULT_LIMIT_EXCEEDED").body).toBe("Data terlalu besar atau lambat. Persempit rentang tanggal.");
    expect(copy("FORBIDDEN").body).toBe("Akses ditolak untuk akun ini.");
    expect(copy("INVALID_INPUT").body).toBe("Filter tidak valid.");
    expect(copy("CONTRACT_MISMATCH").body).toBe("Terjadi kesalahan saat mengambil data Qasir.");
    expect(copy("UPSTREAM_ERROR")).toMatchObject({ retryable: true, title: "Gagal memuat data" });
  });
});
