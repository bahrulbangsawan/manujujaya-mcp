# MCP App Widgets (TanStack) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve six interactive Bahasa Indonesia MCP App views (penjualan, produk, stok, pembelian, transaksi, piutang) from the existing Cloudflare Worker, backed by typed read-only Qasir tools.

**Architecture:**
- **Server:** `src/widgets/` adds a shared zod contract, date/value helpers, a budgeted tool wrapper, 6 model-visible view tools with `_meta.ui.resourceUri`, 9 app-only data tools with `_meta.ui.visibility ["app"]`, and six `ui://manujujaya/<view>.html` resources.
- **Widget:** `widgets/` is a React 19 + TanStack (Router, Query, Table v9, Virtual, Form, Pacer) + Tailwind 4 SPA. Vite and `vite-plugin-singlefile` build it into one HTML string, committed as `src/widgets/bundled.ts`.

**Tech Stack:**
- **Worker:** TypeScript 7.0.2, zod 4.6.5, `@modelcontextprotocol/server` 2.0.0, `@modelcontextprotocol/ext-apps` 2.0.0, agents 0.23, wrangler 4, vitest 5, bun 1.4.
- **Widget:** React 19.3.0, @tanstack/react-router 1.170.36, @tanstack/react-query 5.102.8, @tanstack/react-table 9.2.4, @tanstack/react-virtual 3.14.13, @tanstack/react-form 1.33.5, @tanstack/react-pacer 0.23.0, vite 8.3.0, @vitejs/plugin-react 6.1.1, vite-plugin-singlefile 2.3.3, tailwindcss + @tailwindcss/vite 4.3.3, happy-dom 20.14.5, @testing-library/react 16.3.3, @testing-library/dom 10.4.2; smoke test: playwright-core 1.63.0 (drives the installed Google Chrome).

**Spec:** `docs/superpowers/specs/2026-09-15-mcp-app-widgets-design.md` (read §2 "Verified facts" before touching any upstream projection).

## Global Constraints

**Scope and safety**
- Read-only: never pass `allowMutation`; every tool hard-codes its `operationId`s.
- Every new tool calls `requireScope(principal, SCOPES.READ)` inside a try/catch. On failure it returns `widgetErrorResult(err, env)`, which is `{code,message}` JSON plus `connect_url` for `QASIR_AUTH_EXPIRED` only, and logs `log("warn", "tool.<name>.error", { code: errorCodeOf(err) })`. Never log arguments or results.
- Input bounds:
  - dates `YYYY-MM-DD` with `start_date ≤ end_date` and a range of at most 366 days (inclusive)
  - `page` 1–500
  - ids positive safe integers
  - `search` 1–100 chars after trim
  - `outlet_id` matches `^[1-9]\d{0,11}$`
- Outlet resolution: input `outlet_id` → `(await sessions.getSession()).defaultOutletId`.

**Tool results**
- Per tool call: concurrency 4, deadline 30,000 ms, cumulative response budget 8,000,000 chars, `maxRequests` per tool as listed in each task.
- Tool result = exactly one text block (≤ 2,000 chars, Bahasa Indonesia) + `structuredContent` that parses with the tool's contract schema. The serialized `structuredContent` is ≤ 250,000 chars.
- No `outputSchema` on any new tool.
- `structuredContent` never contains credentials. Text blocks never contain phone numbers.

**Registration and dates**
- View tool descriptions start with `Open an interactive` and are ≤ 600 chars. App-only tool descriptions start with `Widget helper:` and are ≤ 300 chars.
- Resource URIs: `ui://manujujaya/<view>.html`, mime `text/html;profile=mcp-app`.
- Timezone for "today", overdue and aging: `Asia/Jakarta`. Debt scans start at `2015-01-01`.

**Widget**
- No `<form>` elements; buttons are `type="button"`; Enter is handled with `onKeyDown`.
- No `localStorage`/`sessionStorage`/cookies, no `fetch`, no `dangerouslySetInnerHTML`, no `<a target>` (use `app.openLink`).
- Money: `Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })`. All UI copy is Bahasa Indonesia.

**Tests and commits**
- Tests: `bun run test` (vitest; never `bun test`). Types: `bun run check-types`. Widget tests: `bun run widgets:test`. Widget types: `bun run widgets:check-types`.
- Commit messages end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`. Never stage `README.md`, `docs/install-prompts.md`, `GATES.md`, `q.md` or `manujujaya-mcp.pen` (owner's uncommitted work).

## File Structure

```
src/widgets/contract.ts                 T1  zod schemas, tool names, labels, constants (DOM-free; imported by widgets)
src/widgets/qasir-dates.ts              T1  Jakarta today, ranges, Indonesian dates, Qasir datetimes, aging buckets
src/widgets/qasir-values.ts             T1  number/percent/string coercion of upstream values
src/widgets/budget.ts                   T2  RequestBudget (count, concurrency, response chars, deadline)
src/widgets/tools/define.ts             T2  registerWidgetTool + ToolContext + widgetErrorResult
src/widgets/tools/shared.ts             T2  envelope/pagination readers, payload meta, structured cap, text helpers
src/widgets/tools/sales.ts              T3  show_sales_dashboard, show_product_ranking, product_ranking_page
src/widgets/tools/stock.ts              T4  show_stock_browser, stock_page, stock_history, stock_velocity
src/widgets/tools/purchases.ts          T5  show_purchase_orders, purchase_orders_page, purchase_order_items
src/widgets/tools/transactions.ts       T6  show_transactions, transactions_page, order_detail
src/widgets/tools/debts.ts              T7  show_customer_debts, customer_debt_detail
src/widgets/tools/index.ts              T11 registerWidgetTools(server, deps)
src/widgets/resources.ts                T11 registerWidgetResources(server, html)
src/widgets/bundled.ts                  T10 GENERATED: WIDGET_HTML, WIDGET_SOURCE_HASH; regenerated + committed by T12, T13, T14, T15, T16
src/mcp/server.ts                       T11 wire tools/resources behind ENABLE_WIDGETS; capabilities
src/mcp/resources.ts                    T11 capabilities payload lists widgets
worker-configuration.d.ts, wrangler.jsonc  T11 ENABLE_WIDGETS var; version 0.3.0
tests/unit/widgets-dates.test.ts        T1
tests/unit/widgets-contract.test.ts     T1
tests/unit/widgets-budget.test.ts       T2
tests/unit/widgets-define.test.ts       T2
tests/stubs/widget-harness.ts           T2  envelope, fakeSessions, callWidgetTool (synthetic fixtures live in each test file)
tests/unit/widgets-sales.test.ts        T3
tests/unit/widgets-stock.test.ts        T4
tests/unit/widgets-purchases.test.ts    T5
tests/unit/widgets-transactions.test.ts T6
tests/unit/widgets-debts.test.ts        T7
tests/unit/widgets-bundle.test.ts       T10
tests/security/widget-tools.test.ts     T11
tests/protocol/mcp-wire.test.ts         T11 (modify)
tests/protocol/capabilities.test.ts     T11 (modify)
widgets/index.html, vite.config.ts, tsconfig.json, vitest.config.ts   T8
widgets/src/main.tsx                    T8
widgets/src/app/{AppShell,router,queryClient,viewPaths,search}.tsx|ts  T8
widgets/src/routes/index.ts             T8 (empty VIEW_ROUTES), T12–T14 (append)
widgets/test/setup.ts                   T8
widgets/src/bridge/{bridge,extAppsBridge,mockBridge,initialResult,useToolQuery}.ts  T8
widgets/src/lib/{format,dates,errors}.ts  T8
widgets/src/styles.css                  T8
widgets/src/components/*.tsx            T9
widgets/src/routes/viewHelpers.ts       T12
widgets/src/routes/penjualan.tsx, produk.tsx       T12
widgets/src/routes/stok.tsx, pembelian.tsx         T13
widgets/src/routes/transaksi.tsx, piutang.tsx      T14
widgets/src/components/OrderDetailSheet.tsx        T14
widgets/test/**                         T8, T9, T12–T14
widgets/dev/fixtures.ts                 T8  fixture payloads for mockBridge + smoke test
scripts/lib/widget-source-hash.ts       T10
scripts/bundle-widgets.ts               T10
scripts/widgets-smoke.ts                T15
scripts/widgets-smoke-host.ts           T15
scripts/e2e-mcp.ts                      T15 (modify: --live widget checks)
package.json, bun.lock                  T8 (deps, widgets:* scripts), T10 (widgets:bundle), T15 (playwright-core, widgets:smoke), T16 (version)
docs/mcp-tools.md, docs/architecture/{overview,security,setup}.md  T16
```

## Execution lanes

- **Lane S (server), in order:** T1 → T2 → T3 → T4 → T5 → T6 → T7.
- **Lane W (widget), in order:** T8 → T9 → T10 → T12 → T13 → T14. T8 depends on T1 (it imports `src/widgets/contract.ts`), so Lane W starts after T1 is committed.
- **Worktrees:** run Lane S and Lane W in separate git worktrees (superpowers:using-git-worktrees), each branched from the T1 commit. Merge both into `feat/mcp-app-widgets` before T11. Never run the two lanes at the same time in one working tree: T8 extends `check-types` to `widgets/`, and T10 adds a source-hash test that fails while `widgets/src` has uncommitted edits.
- **Join, in order:** T11 (needs T7 + T10) → T15 (needs T11 + T14) → T16 (needs T15).
- **Shared files:** the lanes otherwise touch disjoint files. The exceptions are `package.json`/`bun.lock` (T8, T10, T15, T16) and `src/widgets/bundled.ts`, which T10 generates and T12, T13, T14, T15 and T16 regenerate and commit, because widget sources, `package.json` and `bun.lock` feed the source hash.
- **After merging Lane W:** rerun `bun run widgets:bundle` so `WIDGET_SOURCE_HASH` reflects the merged `bun.lock` and `package.json`.

---

### Task 1: Shared contract, date and value helpers

**Files:**
- Create: `src/widgets/contract.ts`
- Create: `src/widgets/qasir-dates.ts`
- Create: `src/widgets/qasir-values.ts`
- Test: `tests/unit/widgets-dates.test.ts`
- Test: `tests/unit/widgets-contract.test.ts`

**Interfaces:**
- Consumes: `AppError`, `ErrorCodes` from `src/errors/codes.ts`.
- Produces: every export below. Later tasks import these exact names; do not rename.

- [ ] **Step 1: Write the failing date/value tests**

`tests/unit/widgets-dates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { AppError } from "../../src/errors/codes";
import {
  addDays,
  agingBucket,
  assertDateRange,
  bucketSaleDateRange,
  daysBetween,
  jakartaToday,
  parseIndonesianDate,
  parseQasirDateTime,
  previousRange,
} from "../../src/widgets/qasir-dates";
import { parsePercent, toNumber, toText } from "../../src/widgets/qasir-values";

describe("jakartaToday", () => {
  it("uses Asia/Jakarta, not UTC", () => {
    // 2026-09-14T18:30Z is 01:30 on 15 Sep in Jakarta (UTC+7).
    expect(jakartaToday(new Date("2026-09-14T18:30:00Z"))).toBe("2026-09-15");
    expect(jakartaToday(new Date("2026-09-14T16:59:59Z"))).toBe("2026-09-14");
  });
});

describe("day arithmetic", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });
  it("counts whole days from a to b", () => {
    expect(daysBetween("2026-09-01", "2026-09-15")).toBe(14);
    expect(daysBetween("2026-09-15", "2026-09-01")).toBe(-14);
  });
});

describe("assertDateRange", () => {
  it("accepts ranges up to 366 inclusive days", () => {
    expect(() => assertDateRange("2025-09-15", "2026-09-15")).not.toThrow(); // 366 days inclusive
  });
  it("rejects reversed or over-long ranges with INVALID_INPUT", () => {
    for (const [s, e] of [["2026-09-02", "2026-09-01"], ["2025-09-14", "2026-09-15"]] as const) {
      let err: unknown;
      try {
        assertDateRange(s, e);
      } catch (caught) {
        err = caught;
      }
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("INVALID_INPUT");
    }
  });
});

describe("previousRange", () => {
  it("returns the immediately preceding range of equal length", () => {
    expect(previousRange("2026-09-08", "2026-09-14")).toEqual({ start_date: "2026-09-01", end_date: "2026-09-07" });
    expect(previousRange("2026-09-14", "2026-09-14")).toEqual({ start_date: "2026-09-13", end_date: "2026-09-13" });
  });
});

describe("parseIndonesianDate", () => {
  it("parses every Indonesian month name", () => {
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    months.forEach((m, i) => {
      expect(parseIndonesianDate(`02 ${m} 2026`)).toBe(`2026-${String(i + 1).padStart(2, "0")}-02`);
    });
  });
  it("returns null for empty or unknown values", () => {
    expect(parseIndonesianDate("")).toBeNull();
    expect(parseIndonesianDate("02 Foo 2026")).toBeNull();
    expect(parseIndonesianDate("0001-01-01")).toBeNull();
  });
});

describe("parseQasirDateTime", () => {
  it("treats 'YYYY-MM-DD HH:MM:SS' as Jakarta local time", () => {
    expect(parseQasirDateTime("2026-09-12 13:27:33")).toBe("2026-09-12T06:27:33.000Z");
  });
  it("parses Go UTC strings and ISO strings", () => {
    expect(parseQasirDateTime("2026-09-07 01:02:14.608837 +0000 +0000")).toBe("2026-09-07T01:02:14.608Z");
    expect(parseQasirDateTime("2026-08-27T01:02:09.878703Z")).toBe("2026-08-27T01:02:09.878Z");
  });
  it("returns null for empty and zero dates", () => {
    expect(parseQasirDateTime("")).toBeNull();
    expect(parseQasirDateTime("0001-01-01")).toBeNull();
    expect(parseQasirDateTime(undefined)).toBeNull();
  });
});

describe("aging buckets", () => {
  it("assigns boundaries to the lower bucket", () => {
    expect(agingBucket(0)).toBe("0-7");
    expect(agingBucket(7)).toBe("0-7");
    expect(agingBucket(8)).toBe("8-30");
    expect(agingBucket(30)).toBe("8-30");
    expect(agingBucket(90)).toBe("31-90");
    expect(agingBucket(180)).toBe("91-180");
    expect(agingBucket(365)).toBe("181-365");
    expect(agingBucket(730)).toBe("366-730");
    expect(agingBucket(731)).toBe("gt-730");
  });
  it("maps a bucket to the sale-date range it covers", () => {
    const today = "2026-09-15";
    expect(bucketSaleDateRange("0-7", today)).toEqual({ start_date: "2026-09-08", end_date: "2026-09-15" });
    expect(bucketSaleDateRange("8-30", today)).toEqual({ start_date: "2026-08-16", end_date: "2026-09-07" });
    expect(bucketSaleDateRange("gt-730", today)).toEqual({ start_date: "2015-01-01", end_date: "2024-09-14" });
  });
});

describe("value coercion", () => {
  it("parses Qasir percent strings with comma decimals", () => {
    expect(parsePercent("43,37%")).toBe(43.37);
    expect(parsePercent("3496,08%")).toBe(3496.08);
    expect(parsePercent("")).toBeNull();
    expect(parsePercent(undefined)).toBeNull();
  });
  it("coerces numbers and decimal strings, defaulting to 0", () => {
    expect(toNumber("220000.00")).toBe(220000);
    expect(toNumber(15)).toBe(15);
    expect(toNumber("x")).toBe(0);
    expect(toNumber(null)).toBe(0);
  });
  it("trims strings and maps non-strings to ''", () => {
    expect(toText("  SKU-1  ")).toBe("SKU-1");
    expect(toText(12)).toBe("12");
    expect(toText(null)).toBe("");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test tests/unit/widgets-dates.test.ts`
Expected: FAIL with `Error: Cannot find module '../../src/widgets/qasir-dates' imported from …/tests/unit/widgets-dates.test.ts`.

- [ ] **Step 3: Implement `src/widgets/qasir-values.ts`**

```ts
/** Coercion of loosely typed Qasir response values. Never throws. */

/** Numbers and numeric strings ("220000.00") → number; anything else → 0. */
export function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Like toNumber, but null when the value is absent or not numeric. */
export function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Strings are trimmed; finite numbers are stringified; everything else → "". */
export function toText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

/** "43,37%" → 43.37; "" or malformed → null. Qasir sends unsigned values plus a separate status. */
export function parsePercent(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace("%", "").replace(/\./g, "").replace(",", ".").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Plain object guard for upstream JSON. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

- [ ] **Step 4: Implement `src/widgets/qasir-dates.ts`**

```ts
import { AppError, ErrorCodes } from "../errors/codes";
import { AGING_BUCKET_KEYS, DEBT_SCAN_START_DATE, MAX_RANGE_DAYS, type AgingBucketKey } from "./contract";

export const JAKARTA_TZ = "Asia/Jakarta";
const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const MONTHS: Record<string, number> = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
};

function utcDay(iso: string): number {
  const m = ISO_DATE.exec(iso);
  if (!m) throw new AppError(ErrorCodes.INVALID_INPUT, `Invalid date: ${iso}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function isoFromUtcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Calendar date (YYYY-MM-DD) in Asia/Jakarta for the given instant. */
export function jakartaToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: JAKARTA_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(iso: string, days: number): string {
  return isoFromUtcDay(utcDay(iso) + days * DAY_MS);
}

/** Whole days from `a` to `b` (negative when b is earlier). */
export function daysBetween(a: string, b: string): number {
  return Math.round((utcDay(b) - utcDay(a)) / DAY_MS);
}

/** Throws INVALID_INPUT unless start ≤ end and the inclusive range is ≤ maxDays. */
export function assertDateRange(start: string, end: string, maxDays: number = MAX_RANGE_DAYS): void {
  const span = daysBetween(start, end);
  if (span < 0) throw new AppError(ErrorCodes.INVALID_INPUT, "start_date must be on or before end_date");
  if (span + 1 > maxDays) {
    throw new AppError(ErrorCodes.INVALID_INPUT, `Date range may cover at most ${maxDays} days`);
  }
}

/** The equal-length range that ends the day before `start`. */
export function previousRange(start: string, end: string): { start_date: string; end_date: string } {
  const length = daysBetween(start, end) + 1;
  return { start_date: addDays(start, -length), end_date: addDays(start, -1) };
}

/** "02 Oktober 2026" → "2026-10-02"; "", "0001-01-01" and unknown months → null. */
export function parseIndonesianDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const month = MONTHS[m[2]!.toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${String(month).padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
}

/**
 * Qasir timestamps → ISO 8601 UTC, or null for empty / zero values.
 * - "YYYY-MM-DD HH:MM:SS" is dashboard local time (Asia/Jakarta, UTC+7, no DST).
 * - "YYYY-MM-DD HH:MM:SS.ffffff +0000 +0000" is Go UTC.
 * - ISO strings with Z or an offset are parsed as-is.
 */
export function parseQasirDateTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (v === "" || v.startsWith("0001-01-01")) return null;
  const go = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(\.\d+)? \+0000/.exec(v);
  if (go) {
    const frac = (go[3] ?? ".0").slice(0, 4).padEnd(4, "0");
    return new Date(`${go[1]}T${go[2]}${frac}Z`).toISOString();
  }
  const local = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)$/.exec(v);
  if (local) {
    const time = local[2]!.length === 5 ? `${local[2]}:00` : local[2];
    return new Date(`${local[1]}T${time}+07:00`).toISOString();
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Jakarta calendar date of a parsed ISO instant. */
export function jakartaDateOf(isoInstant: string): string {
  return jakartaToday(new Date(isoInstant));
}

const BUCKET_BOUNDS: Record<AgingBucketKey, { min: number; max: number | null }> = {
  "0-7": { min: 0, max: 7 },
  "8-30": { min: 8, max: 30 },
  "31-90": { min: 31, max: 90 },
  "91-180": { min: 91, max: 180 },
  "181-365": { min: 181, max: 365 },
  "366-730": { min: 366, max: 730 },
  "gt-730": { min: 731, max: null },
};

/** Aging bucket for a debt that is `ageDays` old (negative ages count as 0). */
export function agingBucket(ageDays: number): AgingBucketKey {
  const age = Math.max(0, ageDays);
  for (const key of AGING_BUCKET_KEYS) {
    const { max } = BUCKET_BOUNDS[key];
    if (max === null || age <= max) return key;
  }
  return "gt-730";
}

/** Sale-date range (inclusive) whose debts fall in `bucket` as of `today`. */
export function bucketSaleDateRange(bucket: AgingBucketKey, today: string): { start_date: string; end_date: string } {
  const { min, max } = BUCKET_BOUNDS[bucket];
  return {
    start_date: max === null ? DEBT_SCAN_START_DATE : addDays(today, -max),
    end_date: addDays(today, -min),
  };
}
```

- [ ] **Step 5: Implement `src/widgets/contract.ts`**

```ts
/**
 * Shared contract between the Worker widget tools and the widget SPA.
 * DOM-free and Worker-free: imported by src/widgets/** and widgets/src/**.
 * Changes must be additive (hosts may cache older widget HTML for up to 10 minutes).
 */
import { z } from "zod";

// ── Views and tool names ────────────────────────────────────────────────────

export const VIEWS = ["penjualan", "produk", "stok", "pembelian", "transaksi", "piutang"] as const;
export type ViewName = (typeof VIEWS)[number];

export function viewResourceUri(view: ViewName): string {
  return `ui://manujujaya/${view}.html`;
}

/** MCP Apps constants (ext-apps 2.0.0 values, inlined so the Worker does not depend on the package). */
export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";
export const MCP_APP_LEGACY_RESOURCE_URI_KEY = "ui/resourceUri";
/** Replaced with the view name when a ui:// resource is read. */
export const VIEW_MARKER = "__MJ_VIEW__";

export const VIEW_TOOL = {
  penjualan: "show_sales_dashboard",
  produk: "show_product_ranking",
  stok: "show_stock_browser",
  pembelian: "show_purchase_orders",
  transaksi: "show_transactions",
  piutang: "show_customer_debts",
} as const satisfies Record<ViewName, string>;

export const APP_TOOL = {
  productRankingPage: "product_ranking_page",
  stockPage: "stock_page",
  stockHistory: "stock_history",
  stockVelocity: "stock_velocity",
  purchaseOrdersPage: "purchase_orders_page",
  purchaseOrderItems: "purchase_order_items",
  transactionsPage: "transactions_page",
  orderDetail: "order_detail",
  customerDebtDetail: "customer_debt_detail",
} as const;

export const WIDGET_TOOL_NAMES: readonly string[] = [...Object.values(VIEW_TOOL), ...Object.values(APP_TOOL)];

// ── Constants ───────────────────────────────────────────────────────────────

export const MAX_RANGE_DAYS = 366;
export const STRUCTURED_MAX_CHARS = 250_000;
export const DEBT_SCAN_START_DATE = "2015-01-01";
export const PAGE_SIZE = {
  products: 50,
  categories: 20,
  stock: 50,
  stockHistory: 50,
  purchases: 100,
  transactions: 100,
  installments: 100,
} as const;
export const INSTALLMENT_MAX_PAGES = 12;
export const CUSTOMER_INSTALLMENT_MAX_PAGES = 3;
export const DEBT_DETAIL_MAX_INVOICES = 40;
export const PO_STATUS_SCAN_PAGES = 5;
export const VELOCITY_WINDOW_DAYS = 30;
export const VELOCITY_MAX_PAGES = 5;

// ── Labels (Bahasa Indonesia) ───────────────────────────────────────────────

export const AGING_BUCKET_KEYS = ["0-7", "8-30", "31-90", "91-180", "181-365", "366-730", "gt-730"] as const;
export type AgingBucketKey = (typeof AGING_BUCKET_KEYS)[number];
export const AGING_BUCKET_LABEL: Record<AgingBucketKey, string> = {
  "0-7": "0–7 hari",
  "8-30": "8–30 hari",
  "31-90": "1–3 bulan",
  "91-180": "3–6 bulan",
  "181-365": "6–12 bulan",
  "366-730": "1–2 tahun",
  "gt-730": "> 2 tahun",
};

export const PRODUCT_ORDERS = ["terlaris", "kurang_laris", "omzet_tertinggi", "omzet_terendah"] as const;
export type ProductOrder = (typeof PRODUCT_ORDERS)[number];
export const PRODUCT_ORDER_LABEL: Record<ProductOrder, string> = {
  terlaris: "Terlaris",
  kurang_laris: "Kurang laris",
  omzet_tertinggi: "Omzet tertinggi",
  omzet_terendah: "Omzet terendah",
};
/** Upstream reports.products `sort` token per order. */
export const PRODUCT_ORDER_SORT: Record<ProductOrder, string> = {
  terlaris: "-quantity",
  kurang_laris: "quantity",
  omzet_tertinggi: "-total_gross",
  omzet_terendah: "total_gross",
};

export const PO_STATUSES = ["order_processed", "completed", "canceled"] as const;
export type PoStatus = (typeof PO_STATUSES)[number];
export const PO_STATUS_FILTERS = ["semua", ...PO_STATUSES] as const;
export type PoStatusFilter = (typeof PO_STATUS_FILTERS)[number];
const PO_STATUS_LABEL: Record<string, string> = {
  order_processed: "Diproses",
  completed: "Selesai",
  canceled: "Dibatalkan",
};
export function poStatusLabel(status: string): string {
  return PO_STATUS_LABEL[status] ?? status;
}

const WEB_STATUS_LABEL: Record<number, string> = { 2: "Selesai", 3: "Refund", 4: "Kredit belum lunas", 6: "Refund sebagian" };
export function salesStatusLabel(status: number): string {
  return WEB_STATUS_LABEL[status] ?? `Status ${status}`;
}

export const STOCK_MOVEMENT_TYPES = ["sales", "purchase", "transfer", "adjustment-plus", "adjustment-minus", "refund"] as const;
const STOCK_MOVEMENT_LABEL: Record<string, string> = {
  sales: "Penjualan",
  purchase: "Pembelian",
  transfer: "Transfer",
  "adjustment-plus": "Penyesuaian +",
  "adjustment-minus": "Penyesuaian −",
  refund: "Refund",
};
export function stockMovementLabel(type: string): string {
  return STOCK_MOVEMENT_LABEL[type] ?? type;
}

// ── Input primitives ────────────────────────────────────────────────────────

export const isoDate = z.iso.date();
export const outletIdInput = z
  .string()
  .regex(/^[1-9]\d{0,11}$/, "outlet_id must be a numeric outlet id")
  .describe("Qasir outlet id; defaults to the connected outlet");
export const positiveId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const pageInput = z.number().int().min(1).max(500);
export const searchInput = z.string().trim().min(1).max(100);
const startDate = isoDate.describe("First day, YYYY-MM-DD (Asia/Jakarta)");
const endDate = isoDate.describe("Last day, YYYY-MM-DD, inclusive; range at most 366 days");

// ── Output primitives ───────────────────────────────────────────────────────

const payloadFields = {
  outlet_id: z.string(),
  generated_at: z.string(),
  truncated: z.boolean(),
  truncated_reason: z.string().nullable(),
};
export const payloadBase = z.object(payloadFields);
function viewPayload<V extends ViewName>(view: V) {
  return z.object({ view: z.literal(view), ...payloadFields });
}

export const dateRange = z.object({ start_date: isoDate, end_date: isoDate });
export const changeSchema = z.object({ percent: z.number().nullable(), direction: z.enum(["up", "down"]).nullable() });
export const nextPage = z.number().int().positive().nullable();

export const categoryRow = z.object({ id: z.number(), name: z.string(), quantity: z.number(), gross: z.number(), collected: z.number() });
export const productRankRow = z.object({
  rank: z.number().int().positive(),
  id: z.number(),
  name: z.string(),
  category: z.string(),
  sku: z.string(),
  quantity: z.number(),
  unit: z.string(),
  gross: z.number(),
  collected: z.number(),
});

// ── penjualan ───────────────────────────────────────────────────────────────

export const salesDashboardInput = z.object({ start_date: startDate, end_date: endDate, outlet_id: outletIdInput.optional() });
export const salesDashboardData = viewPayload("penjualan").extend({
  range: dateRange,
  comparison: dateRange,
  kpis: z.object({
    sales_before_discount: z.number(),
    discount: z.number(),
    gross_sales: z.number(),
    profit: z.number(),
    capital: z.number(),
    tax: z.number(),
    transactions: z.number(),
    quantity: z.number(),
    average_ticket: z.number(),
  }),
  changes: z.object({ gross: changeSchema, profit: changeSchema, transactions: changeSchema, quantity: changeSchema }),
  trend: z.array(
    z.object({ date: isoDate, amount: z.number(), comparison_date: isoDate.nullable(), comparison_amount: z.number().nullable() }),
  ),
  payment_methods: z.array(z.object({ name: z.string(), quantity: z.number(), amount: z.number() })),
  categories: z.array(categoryRow),
  top_products: z.array(productRankRow),
  receivable: z.object({ total: z.number(), customers: z.number() }),
});

// ── produk ──────────────────────────────────────────────────────────────────

export const productRankingInput = z.object({
  start_date: startDate,
  end_date: endDate,
  order: z.enum(PRODUCT_ORDERS).optional().describe("terlaris (default), kurang_laris, omzet_tertinggi or omzet_terendah"),
  outlet_id: outletIdInput.optional(),
});
export const productRankingPageInput = z.object({
  start_date: startDate,
  end_date: endDate,
  order: z.enum(PRODUCT_ORDERS),
  page: pageInput,
  outlet_id: outletIdInput.optional(),
});
export const productRankingData = viewPayload("produk").extend({
  range: dateRange,
  order: z.enum(PRODUCT_ORDERS),
  rows: z.array(productRankRow),
  categories: z.array(categoryRow),
  manual_transactions: z.object({ quantity: z.number(), gross: z.number() }).nullable(),
  next_page: nextPage,
});
export const productRankingPageData = payloadBase.extend({
  order: z.enum(PRODUCT_ORDERS),
  page: z.number().int().positive(),
  rows: z.array(productRankRow),
  next_page: nextPage,
});

// ── stok ────────────────────────────────────────────────────────────────────

export const stockRow = z.object({
  inventory_id: z.number(),
  name: z.string(),
  stock: z.number(),
  price_sell: z.number(),
  last_sale_at: z.string().nullable(),
  days_since_sale: z.number().nullable(),
  last_adjustment_at: z.string().nullable(),
  days_since_adjustment: z.number().nullable(),
});
export const stockBrowserInput = z.object({
  search: searchInput.optional().describe("Product name fragment; pass it whenever the user names a product"),
  outlet_id: outletIdInput.optional(),
});
export const stockPageInput = z.object({ search: searchInput.optional(), page: pageInput, outlet_id: outletIdInput.optional() });
export const stockBrowserData = viewPayload("stok").extend({
  search: z.string().nullable(),
  rows: z.array(stockRow),
  total_rows: z.number().nullable(),
  next_page: nextPage,
});
export const stockPageData = payloadBase.extend({
  search: z.string().nullable(),
  page: z.number().int().positive(),
  rows: z.array(stockRow),
  next_page: nextPage,
});
export const stockHistoryInput = z.object({ inventory_id: positiveId, page: pageInput, outlet_id: outletIdInput.optional() });
export const stockMovement = z.object({
  id: z.string(),
  at: z.string().nullable(),
  type: z.string(),
  type_label: z.string(),
  quantity: z.number(),
  balance: z.number(),
  note: z.string(),
  by: z.string().nullable(),
  sales_id: z.string().nullable(),
});
export const stockHistoryData = payloadBase.extend({
  inventory_id: z.number(),
  product_name: z.string(),
  stock: z.number(),
  page: z.number().int().positive(),
  movements: z.array(stockMovement),
  next_page: nextPage,
});
export const stockVelocityInput = z.object({ inventory_id: positiveId, outlet_id: outletIdInput.optional() });
export const stockVelocityData = payloadBase.extend({
  inventory_id: z.number(),
  stock: z.number(),
  window_days: z.number().int().positive(),
  sold: z.number(),
  refunded: z.number(),
  net_sold: z.number(),
  daily_rate: z.number(),
  days_of_cover: z.number().nullable(),
  oldest_scanned_at: z.string().nullable(),
});

// ── pembelian ───────────────────────────────────────────────────────────────

export const purchaseRow = z.object({
  id: z.string(),
  order_no: z.string(),
  supplier: z.string(),
  total: z.number(),
  status: z.string(),
  status_label: z.string(),
  created_at: z.string().nullable(),
});
export const purchaseOrdersInput = z.object({
  status: z.enum(PO_STATUS_FILTERS).optional().describe("semua (default), order_processed, completed or canceled"),
  outlet_id: outletIdInput.optional(),
});
export const purchaseOrdersData = viewPayload("pembelian").extend({
  status_filter: z.enum(PO_STATUS_FILTERS),
  rows: z.array(purchaseRow),
  status_counts: z.record(z.string(), z.number()),
  scanned_rows: z.number(),
  total_rows: z.number().nullable(),
  next_page: nextPage,
});
export const purchaseOrdersPageInput = z.object({ page: pageInput, outlet_id: outletIdInput.optional() });
export const purchaseOrdersPageData = payloadBase.extend({
  page: z.number().int().positive(),
  rows: z.array(purchaseRow),
  next_page: nextPage,
});
export const purchaseOrderItemsInput = z.object({
  purchase_id: z.string().regex(/^[1-9]\d{0,19}$/),
  outlet_id: outletIdInput.optional(),
});
export const purchaseOrderItemsData = payloadBase.extend({
  purchase_id: z.string(),
  items: z.array(
    z.object({
      product: z.string(),
      variant: z.string(),
      quantity: z.number(),
      received: z.number(),
      unit: z.string(),
      price: z.number(),
      subtotal: z.number(),
    }),
  ),
  total: z.number(),
});

// ── transaksi ───────────────────────────────────────────────────────────────

export const transactionsInput = z.object({
  start_date: startDate,
  end_date: endDate,
  customer_id: positiveId.optional().describe("Only this customer's sales"),
  outlet_id: outletIdInput.optional(),
});
export const transactionsPageInput = transactionsInput.extend({ page: pageInput });
export const transactionItem = z.object({
  sales_id: z.number(),
  time: z.string(),
  invoice: z.string(),
  payment_mode: z.string(),
  amount: z.number(),
  status: z.number(),
  status_label: z.string(),
  sales_type: z.string(),
});
export const transactionDay = z.object({ date: isoDate, daily_amount: z.number(), items: z.array(transactionItem) });
export const transactionsData = viewPayload("transaksi").extend({
  range: dateRange,
  customer: z.object({ id: z.number(), name: z.string().nullable() }).nullable(),
  days: z.array(transactionDay),
  total_transactions: z.number().nullable(),
  loaded_transactions: z.number(),
  loaded_amount: z.number(),
  payment_mode_totals: z.array(z.object({ payment_mode: z.string(), count: z.number(), amount: z.number() })),
  next_page: nextPage,
});
export const transactionsPageData = payloadBase.extend({
  page: z.number().int().positive(),
  days: z.array(transactionDay),
  next_page: nextPage,
});
export const orderDetailInput = z.object({ sales_id: positiveId });
export const orderDetailData = payloadBase.extend({
  sales_id: z.number(),
  invoice: z.string(),
  status: z.number(),
  status_label: z.string(),
  settled_at: z.string().nullable(),
  total_bill: z.number(),
  total_paid: z.number(),
  change: z.number(),
  items: z.array(z.object({ product: z.string(), variant: z.string().nullable(), quantity: z.number(), price: z.number(), total: z.number() })),
  payments: z.array(z.object({ name: z.string(), mode: z.string(), amount: z.number(), paid_at: z.string().nullable() })),
  customer: z.object({ id: z.number(), name: z.string(), mobile: z.string().nullable() }).nullable(),
  credit: z
    .object({ period: z.number().nullable(), unit: z.string(), due_date: isoDate.nullable(), total: z.number(), remaining: z.number() })
    .nullable(),
  cashier: z.string().nullable(),
});

// ── piutang ─────────────────────────────────────────────────────────────────

export const customerDebtsInput = z.object({
  customer_id: positiveId.optional().describe("Highlight and pre-expand this customer"),
  outlet_id: outletIdInput.optional(),
});
export const debtBucket = z.object({
  key: z.enum(AGING_BUCKET_KEYS),
  label: z.string(),
  invoices: z.number(),
  customers: z.number(),
  credit_total: z.number(),
  receivable: z.number(),
});
export const debtCustomer = z.object({
  customer_id: z.number(),
  name: z.string(),
  invoices: z.number(),
  credit_total: z.number(),
  oldest_sale_date: isoDate,
  oldest_bucket: z.enum(AGING_BUCKET_KEYS),
  nearest_due_date: isoDate.nullable(),
  overdue_invoices: z.number(),
  max_days_overdue: z.number(),
});
export const customerDebtsData = viewPayload("piutang").extend({
  as_of: isoDate,
  summary: z.object({
    receivable_total: z.number(),
    customers: z.number(),
    open_invoices: z.number(),
    credit_total: z.number(),
    overdue_invoices: z.number(),
    overdue_customers: z.number(),
  }),
  buckets: z.array(debtBucket),
  customers: z.array(debtCustomer),
  focus_customer_id: z.number().nullable(),
});
export const customerDebtDetailInput = z.object({ customer_id: positiveId, outlet_id: outletIdInput.optional() });
export const debtInvoice = z.object({
  sales_id: z.number(),
  invoice: z.string(),
  sale_date: isoDate,
  due_date: isoDate.nullable(),
  days_overdue: z.number().nullable(),
  bucket: z.enum(AGING_BUCKET_KEYS),
  total: z.number(),
  paid: z.number(),
  remaining: z.number(),
  payments: z.array(z.object({ name: z.string(), amount: z.number(), paid_at: z.string().nullable() })),
});
export const customerDebtDetailData = payloadBase.extend({
  customer: z.object({ id: z.number(), name: z.string(), mobile: z.string().nullable() }),
  invoices: z.array(debtInvoice),
  totals: z.object({ total: z.number(), paid: z.number(), remaining: z.number() }),
});

// ── Errors ──────────────────────────────────────────────────────────────────

export const toolErrorBody = z.object({ code: z.string(), message: z.string(), connect_url: z.string().optional() });
export type ToolErrorBody = z.infer<typeof toolErrorBody>;

// ── Tool registry (names → schemas) ─────────────────────────────────────────

export const TOOL_SCHEMAS = {
  show_sales_dashboard: { input: salesDashboardInput, output: salesDashboardData },
  show_product_ranking: { input: productRankingInput, output: productRankingData },
  product_ranking_page: { input: productRankingPageInput, output: productRankingPageData },
  show_stock_browser: { input: stockBrowserInput, output: stockBrowserData },
  stock_page: { input: stockPageInput, output: stockPageData },
  stock_history: { input: stockHistoryInput, output: stockHistoryData },
  stock_velocity: { input: stockVelocityInput, output: stockVelocityData },
  show_purchase_orders: { input: purchaseOrdersInput, output: purchaseOrdersData },
  purchase_orders_page: { input: purchaseOrdersPageInput, output: purchaseOrdersPageData },
  purchase_order_items: { input: purchaseOrderItemsInput, output: purchaseOrderItemsData },
  show_transactions: { input: transactionsInput, output: transactionsData },
  transactions_page: { input: transactionsPageInput, output: transactionsPageData },
  order_detail: { input: orderDetailInput, output: orderDetailData },
  show_customer_debts: { input: customerDebtsInput, output: customerDebtsData },
  customer_debt_detail: { input: customerDebtDetailInput, output: customerDebtDetailData },
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;
export type ToolInput<N extends ToolName> = z.input<(typeof TOOL_SCHEMAS)[N]["input"]>;
export type ToolOutput<N extends ToolName> = z.infer<(typeof TOOL_SCHEMAS)[N]["output"]>;
```

- [ ] **Step 6: Write the contract test**

`tests/unit/widgets-contract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  APP_TOOL,
  TOOL_SCHEMAS,
  VIEW_TOOL,
  VIEWS,
  WIDGET_TOOL_NAMES,
  salesStatusLabel,
  poStatusLabel,
  stockMovementLabel,
  transactionsPageInput,
  viewResourceUri,
} from "../../src/widgets/contract";

describe("widget contract", () => {
  it("names every tool exactly once and gives each a schema pair", () => {
    expect(new Set(WIDGET_TOOL_NAMES).size).toBe(15);
    expect(Object.keys(TOOL_SCHEMAS).sort()).toEqual([...WIDGET_TOOL_NAMES].sort());
    expect(Object.keys(VIEW_TOOL)).toEqual([...VIEWS]);
    expect(Object.values(APP_TOOL)).toHaveLength(9);
  });

  it("builds ui:// URIs that survive URL normalization", () => {
    for (const view of VIEWS) {
      const uri = viewResourceUri(view);
      expect(new URL(uri).href).toBe(uri);
    }
  });

  it("maps status codes to Indonesian labels with a fallback", () => {
    expect(salesStatusLabel(2)).toBe("Selesai");
    expect(salesStatusLabel(3)).toBe("Refund");
    expect(salesStatusLabel(6)).toBe("Refund sebagian");
    expect(salesStatusLabel(9)).toBe("Status 9");
    expect(poStatusLabel("order_processed")).toBe("Diproses");
    expect(poStatusLabel("weird")).toBe("weird");
    expect(stockMovementLabel("adjustment-minus")).toBe("Penyesuaian −");
  });

  it("bounds inputs", () => {
    const ok = { start_date: "2026-09-01", end_date: "2026-09-07", page: 1 };
    expect(transactionsPageInput.safeParse(ok).success).toBe(true);
    expect(transactionsPageInput.safeParse({ ...ok, page: 501 }).success).toBe(false);
    expect(transactionsPageInput.safeParse({ ...ok, start_date: "01-09-2026" }).success).toBe(false);
    expect(transactionsPageInput.safeParse({ ...ok, outlet_id: "0645203" }).success).toBe(false);
    expect(transactionsPageInput.safeParse({ ...ok, customer_id: -1 }).success).toBe(false);
  });

  it("strips unknown output fields instead of failing (additive contract)", () => {
    const parsed = TOOL_SCHEMAS.order_detail.output.parse({
      outlet_id: "1",
      generated_at: "2026-09-15T00:00:00.000Z",
      truncated: false,
      truncated_reason: null,
      sales_id: 1,
      invoice: "INV",
      status: 2,
      status_label: "Selesai",
      settled_at: null,
      total_bill: 0,
      total_paid: 0,
      change: 0,
      items: [],
      payments: [],
      customer: null,
      credit: null,
      cashier: null,
      future_field: true,
    });
    expect("future_field" in parsed).toBe(false);
  });
});
```

- [ ] **Step 7: Run tests and types**

Run: `bun run test tests/unit/widgets-dates.test.ts tests/unit/widgets-contract.test.ts && bun run check-types`
Expected: all tests PASS; `tsc` exits 0.

- [ ] **Step 8: Commit**

```bash
git add src/widgets/contract.ts src/widgets/qasir-dates.ts src/widgets/qasir-values.ts tests/unit/widgets-dates.test.ts tests/unit/widgets-contract.test.ts
git commit -m "feat(widgets): shared contract, Jakarta date and Qasir value helpers

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Request budget, widget tool wrapper, shared helpers and test harness

**Files:**
- Create: `src/widgets/budget.ts`
- Create: `src/widgets/tools/shared.ts`
- Create: `src/widgets/tools/define.ts`
- Create: `tests/stubs/widget-harness.ts`
- Test: `tests/unit/widgets-budget.test.ts`
- Test: `tests/unit/widgets-define.test.ts`

**Interfaces:**
- Consumes:
  - T1: `STRUCTURED_MAX_CHARS`, `MCP_APP_LEGACY_RESOURCE_URI_KEY`, `viewResourceUri`, `pageInput`, `outletIdInput`, `searchInput`, `toolErrorBody`, `ToolErrorBody`, `ToolName`, `ViewName` from `src/widgets/contract.ts`; `jakartaToday` from `src/widgets/qasir-dates.ts`; `isRecord`, `toNumberOrNull` from `src/widgets/qasir-values.ts`.
  - Repo: `AppError`, `ErrorCodes`, `isAppErrorLike` (`src/errors/codes.ts`); `toAppError` (`src/codemode/errors.ts`); `errorResult`, `jsonErrorResult`, `errorCodeOf` (`src/mcp/results.ts`); `requireScope`, `AuthPrincipal` (`src/auth/verify.ts`); `SCOPES` (`src/auth/scopes.ts`); `log` (`src/observability/log.ts`); `getOperation` (`src/registry/operations.ts`); `CodemodeDispatcher` (`src/codemode/run.ts`); `DispatchRequest` (`src/dispatcher/qasir-dispatcher.ts`); `QasirSessionProvider` (`src/session/types.ts`); test stubs `createFakeDispatcher`, `abortableDelay`, `testEnv`, `readPrincipal`, `MERCHANT_SLUG`, `FakeDispatcher`, `FixtureHandler` (`tests/stubs/codemode-harness.ts`), `rpcRequest`, `readWire` (`tests/stubs/mcp-wire.ts`).
- Produces (T3–T7 and T11 import these exact names):
  - `src/widgets/budget.ts`:
    - `interface RequestBudgetLimits { maxRequests: number; maxConcurrency: number; timeoutMs: number; maxResponseChars: number }`
    - `const DEFAULT_WIDGET_LIMITS: Omit<RequestBudgetLimits, "maxRequests">` (4 concurrent, 30,000 ms, 8,000,000 chars)
    - `class RequestBudget { constructor(limits: RequestBudgetLimits); get signal(): AbortSignal; run<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T>; startDeadline(): () => void; abort(reason: AppError): void }`
  - `src/widgets/tools/define.ts`:
    - `interface WidgetToolDeps { env: Env; principal: AuthPrincipal; sessions: QasirSessionProvider; dispatcher: CodemodeDispatcher; now?: () => Date; limits?: Partial<Omit<RequestBudgetLimits, "maxRequests">> }`
    - `interface ToolContext { readonly now: Date; readonly today: string; readonly signal: AbortSignal; outletId(input?: string): Promise<string>; request(req: DispatchRequest): Promise<unknown>; meta(outletId: string): { outlet_id: string; generated_at: string; truncated: boolean; truncated_reason: string | null } }`
    - `interface ToolOutcome { text: string; structured: Record<string, unknown> }`
    - `interface WidgetToolDef<S extends z.ZodObject> { name: ToolName; title: string; description: string; input: S; maxRequests: number; view?: ViewName; run(input: z.output<S>, ctx: ToolContext): Promise<ToolOutcome> }`
    - `type AnyWidgetToolDef = WidgetToolDef<any>`
    - `const WIDGET_TOOL_ANNOTATIONS` (`readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true`)
    - `function widgetToolMeta(view: ViewName | undefined): Record<string, unknown>`
    - `function widgetErrorResult(err: unknown, env: Env): CallToolResult`
    - `function invokeWidgetTool<S extends z.ZodObject>(def: WidgetToolDef<S>, deps: WidgetToolDeps, input: z.output<S>): Promise<CallToolResult>`
    - `function registerWidgetTool<S extends z.ZodObject>(server: McpServer, deps: WidgetToolDeps, def: WidgetToolDef<S>): void`
  - `src/widgets/tools/shared.ts`:
    - `const TEXT_MAX_CHARS = 2_000`
    - `function envelopeData(res: unknown, label: string): Record<string, unknown>`
    - `function recordsAt(obj: Record<string, unknown>, key: string): Record<string, unknown>[]`
    - `interface PageInfo { currentPage: number | null; totalPage: number | null; totalResult: number | null; hasNext: boolean }`
    - `function pageInfo(res: unknown): PageInfo | null`
    - `function nextPageOf(res: unknown, page: number, rowsReturned: number, pageSize: number): number | null`
    - `function isUpstream404(err: unknown): boolean`
    - `function capRows<T>(rows: T[], maxChars: number, build: (rows: T[]) => unknown): { rows: T[]; truncated: boolean }`
    - `function rupiah(amount: number): string`, `function formatQty(n: number): string`, `function indoDate(isoDate: string): string`
    - `function clipText(text: string, maxChars?: number): string`
    - `function joinLines(lines: Array<string | null | undefined | false>, maxChars?: number): string`
  - `tests/stubs/widget-harness.ts`:
    - `const WIDGET_TEST_NOW: Date` (`2026-09-15T03:00:00Z`), `const TEST_OUTLET_ID = "645203"`
    - `function envelope(data: unknown, pagination?: Record<string, unknown>): Record<string, unknown>`
    - `function fakeSessions(defaultOutletId?: string): QasirSessionProvider`
    - `interface WidgetCall { result: CallToolResult; dispatcher: FakeDispatcher; text: string; structured: Record<string, unknown> | undefined; error: ToolErrorBody | undefined }`
    - `interface WidgetCallOptions { handlers: Record<string, FixtureHandler>; now?: Date; principal?: AuthPrincipal; env?: Partial<Env>; sessions?: QasirSessionProvider; limits?: WidgetToolDeps["limits"] }`
    - `function callWidgetTool<S extends z.ZodObject>(def: WidgetToolDef<S>, rawInput: unknown, opts: WidgetCallOptions): Promise<WidgetCall>`

Behaviour notes for later tasks:
- `ctx.request` refuses any operation that is not an exposed `read` operation (`MUTATION_DISABLED` / `UNSUPPORTED_OPERATION`) before counting or dispatching. It never passes `allowMutation`.
- When the call finishes, its budget aborts, so a request left running (or started later) fails with `INVALID_INPUT "Widget tool call has already finished"`.
- The deadline is raced against `run`, so a run that ignores `ctx.signal` still ends with `UPSTREAM_TIMEOUT` after `timeoutMs`.
- `nextPageOf` returns `null` once `page` is 500 (the `pageInput` maximum), so no view advertises a page its pager would reject.
- `capRows`: `build` must produce the payload as it will be sent when truncated (`truncated: true` plus its reason), so the measured size is the final size.

- [ ] **Step 1: Write the failing budget test**

`tests/unit/widgets-budget.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import { DEFAULT_WIDGET_LIMITS, RequestBudget, type RequestBudgetLimits } from "../../src/widgets/budget";
import { abortableDelay } from "../stubs/codemode-harness";

function budget(overrides: Partial<RequestBudgetLimits> = {}): RequestBudget {
  return new RequestBudget({ ...DEFAULT_WIDGET_LIMITS, maxRequests: 10, ...overrides });
}

async function rejection(p: Promise<unknown>): Promise<AppError> {
  const err = await p.then(
    () => {
      throw new Error("expected rejection");
    },
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  return err as AppError;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("RequestBudget", () => {
  it("defaults to 4 concurrent requests, 30 s and 8,000,000 response chars", () => {
    expect(DEFAULT_WIDGET_LIMITS).toEqual({ maxConcurrency: 4, timeoutMs: 30_000, maxResponseChars: 8_000_000 });
  });

  it("passes its signal to fn and returns fn's value", async () => {
    const b = budget();
    let seen: AbortSignal | undefined;
    const value = await b.run(async (signal) => {
      seen = signal;
      return { ok: true };
    });
    expect(value).toEqual({ ok: true });
    expect(seen).toBe(b.signal);
  });

  it("refuses the request past maxRequests without running it, and stays stopped", async () => {
    const b = budget({ maxRequests: 3 });
    const fn = vi.fn(async () => ({ ok: true }));
    for (let i = 0; i < 3; i++) await b.run(fn);
    const err = await rejection(b.run(fn));
    expect(err.code).toBe(ErrorCodes.RESULT_LIMIT_EXCEEDED);
    expect(err.message).toBe("Request limit reached: at most 3 upstream requests per widget tool call");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(b.signal.aborted).toBe(true);
    expect(await rejection(b.run(fn))).toBe(err);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("keeps at most maxConcurrency requests in flight and queues the rest", async () => {
    const b = budget({ maxRequests: 20 });
    let inFlight = 0;
    let peak = 0;
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        b.run(async (signal) => {
          inFlight++;
          peak = Math.max(peak, inFlight);
          try {
            await abortableDelay(5, signal);
            return i;
          } finally {
            inFlight--;
          }
        }),
      ),
    );
    expect(results).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBe(4);
  });

  it("charges the JSON length of each result against the response budget", async () => {
    const b = budget({ maxResponseChars: 10_000 });
    const blob = { blob: "x".repeat(4_000) };
    await b.run(async () => blob);
    await b.run(async () => blob);
    const err = await rejection(b.run(async () => blob));
    expect(err.code).toBe(ErrorCodes.RESULT_LIMIT_EXCEEDED);
    expect(err.message).toBe("Response budget exceeded: at most 10000 characters per widget tool call");
    expect(b.signal.aborted).toBe(true);
  });

  it("aborts in-flight work with UPSTREAM_TIMEOUT when the deadline passes", async () => {
    vi.useFakeTimers();
    const b = budget();
    b.startDeadline();
    const pending = rejection(b.run((signal) => abortableDelay(60_000, signal)));
    await vi.advanceTimersByTimeAsync(30_000);
    const err = await pending;
    expect(err.code).toBe(ErrorCodes.UPSTREAM_TIMEOUT);
    expect(err.message).toBe("Widget tool timed out after 30 s");
    expect(b.signal.reason).toBe(err);
  });

  it("does not abort once the deadline is stopped", async () => {
    vi.useFakeTimers();
    const b = budget();
    const stop = b.startDeadline();
    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(b.signal.aborted).toBe(false);
  });

  it("rejects queued requests with the abort reason and never runs them", async () => {
    const b = budget({ maxConcurrency: 1 });
    const first = rejection(b.run((signal) => abortableDelay(10_000, signal)));
    const second = vi.fn(async () => "second");
    const queued = rejection(b.run(second));
    const reason = new AppError(ErrorCodes.INVALID_INPUT, "Widget tool call has already finished");
    b.abort(reason);
    b.abort(new AppError(ErrorCodes.UPSTREAM_TIMEOUT, "ignored: the first reason wins"));
    expect(await first).toBe(reason);
    expect(await queued).toBe(reason);
    expect(second).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test tests/unit/widgets-budget.test.ts`
Expected: FAIL with `Error: Cannot find module '../../src/widgets/budget' imported from …/tests/unit/widgets-budget.test.ts`.

- [ ] **Step 3: Implement `src/widgets/budget.ts`**

```ts
import { AppError, ErrorCodes } from "../errors/codes";

/** Limits for one widget tool call. */
export interface RequestBudgetLimits {
  /** Upstream requests allowed per call (counted on entry). */
  maxRequests: number;
  /** Upstream requests in flight at once; extra requests wait for a slot. */
  maxConcurrency: number;
  /** Wall-clock deadline for the whole call, started with startDeadline(). */
  timeoutMs: number;
  /** Cumulative JSON.stringify length of request results. */
  maxResponseChars: number;
}

export const DEFAULT_WIDGET_LIMITS: Omit<RequestBudgetLimits, "maxRequests"> = {
  maxConcurrency: 4,
  timeoutMs: 30_000,
  maxResponseChars: 8_000_000,
};

/**
 * Host-side accounting for one widget tool call: request count, concurrency,
 * cumulative response size and deadline. Exceeding a limit is terminal: the
 * budget aborts with that error, so every later or queued request fails too.
 */
export class RequestBudget {
  readonly #limits: RequestBudgetLimits;
  readonly #controller = new AbortController();
  readonly #waiters: Array<() => void> = [];
  #requests = 0;
  #inFlight = 0;
  #responseChars = 0;

  constructor(limits: RequestBudgetLimits) {
    this.#limits = limits;
  }

  /** Aborted when a limit is exceeded, the deadline passes or the call finishes. */
  get signal(): AbortSignal {
    return this.#controller.signal;
  }

  /** Stop the call; the first reason wins. */
  abort(reason: AppError): void {
    if (!this.#controller.signal.aborted) this.#controller.abort(reason);
  }

  /** Start the deadline timer. Returns stop(), which clears it. */
  startDeadline(): () => void {
    const seconds = Math.ceil(this.#limits.timeoutMs / 1000);
    const timer = setTimeout(() => {
      this.abort(new AppError(ErrorCodes.UPSTREAM_TIMEOUT, `Widget tool timed out after ${seconds} s`));
    }, this.#limits.timeoutMs);
    return () => clearTimeout(timer);
  }

  /** Count one request, wait for a slot, run fn(signal), charge its result, release the slot. */
  async run<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    this.#assertActive();
    if (this.#requests >= this.#limits.maxRequests) {
      throw this.#fail(
        `Request limit reached: at most ${this.#limits.maxRequests} upstream requests per widget tool call`,
      );
    }
    this.#requests++;
    const release = await this.#acquireSlot();
    try {
      const value = await fn(this.signal);
      this.#assertActive();
      this.#charge(value);
      return value;
    } finally {
      release();
    }
  }

  #assertActive(): void {
    if (!this.signal.aborted) return;
    const reason: unknown = this.signal.reason;
    throw reason instanceof AppError ? reason : new AppError(ErrorCodes.UPSTREAM_TIMEOUT, "Widget tool call stopped");
  }

  #fail(message: string): AppError {
    const err = new AppError(ErrorCodes.RESULT_LIMIT_EXCEEDED, message);
    this.abort(err);
    return err;
  }

  async #acquireSlot(): Promise<() => void> {
    while (this.#inFlight >= this.#limits.maxConcurrency) {
      this.#assertActive();
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => reject(this.signal.reason);
        this.signal.addEventListener("abort", onAbort, { once: true });
        this.#waiters.push(() => {
          this.signal.removeEventListener("abort", onAbort);
          resolve();
        });
      });
    }
    this.#assertActive();
    this.#inFlight++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.#inFlight--;
      this.#waiters.shift()?.();
    };
  }

  #charge(value: unknown): void {
    let size = 0;
    try {
      size = JSON.stringify(value)?.length ?? 0;
    } catch {
      throw new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream result is not serializable");
    }
    this.#responseChars += size;
    if (this.#responseChars > this.#limits.maxResponseChars) {
      throw this.#fail(
        `Response budget exceeded: at most ${this.#limits.maxResponseChars} characters per widget tool call`,
      );
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test tests/unit/widgets-budget.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/widgets/budget.ts tests/unit/widgets-budget.test.ts
git commit -m "feat(widgets): per-call request budget with deadline

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Write the widget test harness**

`tests/stubs/widget-harness.ts`:

```ts
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { z } from "zod";
import type { AuthPrincipal } from "../../src/auth/verify";
import type { QasirSessionProvider } from "../../src/session/types";
import { toolErrorBody, type ToolErrorBody } from "../../src/widgets/contract";
import { invokeWidgetTool, type WidgetToolDef, type WidgetToolDeps } from "../../src/widgets/tools/define";
import {
  createFakeDispatcher,
  MERCHANT_SLUG,
  readPrincipal,
  testEnv,
  type FakeDispatcher,
  type FixtureHandler,
} from "./codemode-harness";

/** 10:00 on 15 Sep 2026 in Asia/Jakarta. */
export const WIDGET_TEST_NOW = new Date("2026-09-15T03:00:00Z");
export const TEST_OUTLET_ID = "645203";

/** A Qasir JSON envelope as the dispatcher returns it in DispatchResult.data. */
export function envelope(data: unknown, pagination?: Record<string, unknown>): Record<string, unknown> {
  return { code: 200, message: "OK", data, ...(pagination ? { pagination } : {}), trace_id: "test" };
}

/** Session provider with dummy secrets; spy on getSession with vi.spyOn to count reads. */
export function fakeSessions(defaultOutletId: string = TEST_OUTLET_ID): QasirSessionProvider {
  return {
    async getSession() {
      return {
        merchantSlug: MERCHANT_SLUG,
        merchantOrigin: `https://${MERCHANT_SLUG}.qasir.id`,
        defaultOutletId,
        secrets: { apiToken: "test-api-token", csrfToken: "test-csrf-token", cookie: "test_session=1" },
        source: "static",
      };
    },
    markExpired: () => undefined,
  };
}

export interface WidgetCall {
  result: CallToolResult;
  dispatcher: FakeDispatcher;
  /** content[0].text */
  text: string;
  structured: Record<string, unknown> | undefined;
  /** Parsed JSON error body when result.isError. */
  error: ToolErrorBody | undefined;
}

export interface WidgetCallOptions {
  handlers: Record<string, FixtureHandler>;
  now?: Date;
  principal?: AuthPrincipal;
  env?: Partial<Env>;
  sessions?: QasirSessionProvider;
  limits?: WidgetToolDeps["limits"];
}

/**
 * Run a widget tool the way the registered handler does, against the fake
 * dispatcher (real registry validation) and a fixed clock. `rawInput` is parsed
 * with the tool's input schema first, so invalid input throws like the SDK rejects it.
 */
export async function callWidgetTool<S extends z.ZodObject>(
  def: WidgetToolDef<S>,
  rawInput: unknown,
  opts: WidgetCallOptions,
): Promise<WidgetCall> {
  const dispatcher = createFakeDispatcher(opts.handlers);
  const now = opts.now ?? WIDGET_TEST_NOW;
  const deps: WidgetToolDeps = {
    env: testEnv(opts.env),
    principal: opts.principal ?? readPrincipal,
    sessions: opts.sessions ?? fakeSessions(),
    dispatcher,
    now: () => now,
    ...(opts.limits ? { limits: opts.limits } : {}),
  };
  const input: z.output<S> = def.input.parse(rawInput);
  const result = await invokeWidgetTool(def, deps, input);
  const first = result.content[0];
  const text = first?.type === "text" ? first.text : "";
  const error = result.isError ? toolErrorBody.parse(JSON.parse(text)) : undefined;
  const structured = result.structuredContent as Record<string, unknown> | undefined;
  return { result, dispatcher, text, structured, error };
}
```

- [ ] **Step 7: Write the failing wrapper and shared-helper test**

`tests/unit/widgets-define.test.ts`:

```ts
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { AuthPrincipal } from "../../src/auth/verify";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import { outletIdInput, searchInput, STRUCTURED_MAX_CHARS } from "../../src/widgets/contract";
import {
  invokeWidgetTool,
  registerWidgetTool,
  widgetErrorResult,
  WIDGET_TOOL_ANNOTATIONS,
  type ToolContext,
  type WidgetToolDef,
  type WidgetToolDeps,
} from "../../src/widgets/tools/define";
import {
  capRows,
  clipText,
  envelopeData,
  formatQty,
  indoDate,
  isUpstream404,
  joinLines,
  nextPageOf,
  pageInfo,
  recordsAt,
  rupiah,
} from "../../src/widgets/tools/shared";
import { abortableDelay, createFakeDispatcher, readPrincipal, testEnv, type FixtureHandler } from "../stubs/codemode-harness";
import { readWire, rpcRequest } from "../stubs/mcp-wire";
import { callWidgetTool, envelope, fakeSessions, WIDGET_TEST_NOW } from "../stubs/widget-harness";

const SUMMARY = "reports.summaries.installment";
const summaryFixture = { total_customer: 2, total_down_payment: 0, total_receivable: 150_000 };

const probeInput = z.object({
  outlet_id: outletIdInput.optional(),
  search: searchInput.optional(),
  calls: z.number().int().min(0).max(50).default(1),
});

/** App-only probe: resolves the outlet (twice), dispatches `calls` summary requests in parallel. */
function probe(overrides: Partial<WidgetToolDef<typeof probeInput>> = {}): WidgetToolDef<typeof probeInput> {
  return {
    name: "stock_page",
    title: "Probe",
    description: "Widget helper: test probe.",
    input: probeInput,
    maxRequests: 3,
    async run(input, ctx) {
      const outletId = await ctx.outletId(input.outlet_id);
      const again = await ctx.outletId(input.outlet_id);
      const results = await Promise.all(
        Array.from({ length: input.calls }, () =>
          ctx.request({ operationId: SUMMARY, query: { start_date: ctx.today, end_date: ctx.today, outlet_ids: outletId } }),
        ),
      );
      return { text: `Probe selesai: ${results.length} permintaan`, structured: { ...ctx.meta(again), today: ctx.today, results } };
    },
    ...overrides,
  };
}

const summaryHandlers: Record<string, FixtureHandler> = { [SUMMARY]: () => envelope(summaryFixture) };
const noScope: AuthPrincipal = { subject: "owner", scopes: [], via: "oauth" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("invokeWidgetTool: success path", () => {
  it("returns one text block and structuredContent with meta, today and upstream data", async () => {
    const call = await callWidgetTool(probe(), {}, { handlers: summaryHandlers });
    expect(call.result.isError).toBeUndefined();
    expect(call.result.content).toEqual([{ type: "text", text: "Probe selesai: 1 permintaan" }]);
    expect(call.structured).toEqual({
      outlet_id: "645203",
      generated_at: "2026-09-15T03:00:00.000Z",
      truncated: false,
      truncated_reason: null,
      today: "2026-09-15",
      results: [envelope(summaryFixture)],
    });
  });

  it("dispatches with the call's abort signal and never allowMutation", async () => {
    const call = await callWidgetTool(probe(), { calls: 2 }, { handlers: summaryHandlers });
    expect(call.dispatcher.calls).toHaveLength(2);
    for (const { req, opts } of call.dispatcher.calls) {
      expect(req).toEqual({
        operationId: SUMMARY,
        query: { start_date: "2026-09-15", end_date: "2026-09-15", outlet_ids: "645203" },
      });
      expect(opts?.allowMutation).toBeUndefined();
      expect(opts?.signal).toBeInstanceOf(AbortSignal);
      // The call has finished, so its signal is aborted: nothing can outlive the tool call.
      expect(opts?.signal?.aborted).toBe(true);
    }
  });

  it("computes today in Asia/Jakarta and meta() from the injected clock", async () => {
    let seen: ToolContext | undefined;
    const def = probe({
      async run(_input, ctx) {
        seen = ctx;
        return { text: "ok", structured: ctx.meta("42") };
      },
    });
    const now = new Date("2026-09-14T18:30:00Z");
    const call = await callWidgetTool(def, {}, { handlers: {}, now });
    expect(seen?.now).toBe(now);
    expect(seen?.today).toBe("2026-09-15");
    expect(call.structured).toEqual({
      outlet_id: "42",
      generated_at: "2026-09-14T18:30:00.000Z",
      truncated: false,
      truncated_reason: null,
    });
  });
});

describe("invokeWidgetTool: outlet resolution", () => {
  it("uses outlet_id from the input without reading the session", async () => {
    const sessions = fakeSessions("777");
    const getSession = vi.spyOn(sessions, "getSession");
    const call = await callWidgetTool(probe(), { outlet_id: "123" }, { handlers: summaryHandlers, sessions });
    expect(call.structured?.outlet_id).toBe("123");
    expect(call.dispatcher.calls[0]?.req.query?.outlet_ids).toBe("123");
    expect(getSession).not.toHaveBeenCalled();
  });

  it("falls back to the session's default outlet and reads the session at most once", async () => {
    const sessions = fakeSessions("777");
    const getSession = vi.spyOn(sessions, "getSession");
    const call = await callWidgetTool(probe(), { calls: 2 }, { handlers: summaryHandlers, sessions });
    expect(call.structured?.outlet_id).toBe("777");
    expect(call.dispatcher.calls.map((c) => c.req.query?.outlet_ids)).toEqual(["777", "777"]);
    expect(getSession).toHaveBeenCalledTimes(1);
  });
});

describe("invokeWidgetTool: budget", () => {
  it("stops at maxRequests with RESULT_LIMIT_EXCEEDED", async () => {
    const call = await callWidgetTool(probe(), { calls: 5 }, { handlers: summaryHandlers });
    expect(call.result.isError).toBe(true);
    expect(call.result.structuredContent).toBeUndefined();
    expect(call.error).toEqual({
      code: "RESULT_LIMIT_EXCEEDED",
      message: "Request limit reached: at most 3 upstream requests per widget tool call",
    });
    expect(call.dispatcher.calls.length).toBeLessThanOrEqual(3);
  });

  it("keeps at most 4 upstream requests in flight", async () => {
    const handlers: Record<string, FixtureHandler> = {
      [SUMMARY]: (_req, opts) => abortableDelay(10, opts?.signal).then(() => envelope(summaryFixture)),
    };
    const call = await callWidgetTool(probe({ maxRequests: 12 }), { calls: 12 }, { handlers });
    expect(call.result.isError).toBeUndefined();
    expect(call.dispatcher.calls).toHaveLength(12);
    expect(call.dispatcher.peakInFlight).toBeLessThanOrEqual(4);
    expect(call.dispatcher.peakInFlight).toBe(4);
  });

  it("enforces the cumulative response budget", async () => {
    const handlers: Record<string, FixtureHandler> = { [SUMMARY]: () => envelope({ blob: "x".repeat(3_000) }) };
    const call = await callWidgetTool(probe(), { calls: 3 }, { handlers, limits: { maxResponseChars: 5_000, maxConcurrency: 1 } });
    expect(call.error?.code).toBe("RESULT_LIMIT_EXCEEDED");
    expect(call.error?.message).toBe("Response budget exceeded: at most 5000 characters per widget tool call");
  });

  it("maps the deadline to UPSTREAM_TIMEOUT and aborts in-flight requests", async () => {
    let aborted = false;
    const handlers: Record<string, FixtureHandler> = {
      [SUMMARY]: (_req, opts) =>
        abortableDelay(5_000, opts?.signal).catch((err: unknown) => {
          aborted = true;
          throw err;
        }),
    };
    const call = await callWidgetTool(probe(), {}, { handlers, limits: { timeoutMs: 50 } });
    expect(call.error).toEqual({ code: "UPSTREAM_TIMEOUT", message: "Widget tool timed out after 1 s" });
    expect(aborted).toBe(true);
  });

  it("times out even when run ignores the signal", async () => {
    const def = probe({
      async run(_input, ctx) {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        return { text: "late", structured: ctx.meta("1") };
      },
    });
    const started = Date.now();
    const call = await callWidgetTool(def, {}, { handlers: {}, limits: { timeoutMs: 50 } });
    expect(call.error?.code).toBe("UPSTREAM_TIMEOUT");
    expect(Date.now() - started).toBeLessThan(900);
  });

  it("refuses requests made after the call has finished", async () => {
    let leaked: ToolContext | undefined;
    const def = probe({
      async run(_input, ctx) {
        leaked = ctx;
        return { text: "ok", structured: ctx.meta("1") };
      },
    });
    const dispatcher = createFakeDispatcher(summaryHandlers);
    const deps: WidgetToolDeps = { env: testEnv(), principal: readPrincipal, sessions: fakeSessions(), dispatcher };
    await invokeWidgetTool(def, deps, probeInput.parse({}));
    const late = leaked!.request({ operationId: SUMMARY, query: { start_date: "2026-09-15", end_date: "2026-09-15", outlet_ids: "1" } });
    await expect(late).rejects.toMatchObject({ code: "INVALID_INPUT", message: "Widget tool call has already finished" });
    expect(dispatcher.calls).toHaveLength(0);
  });
});

describe("invokeWidgetTool: safety and errors", () => {
  it("returns FORBIDDEN JSON without a scope, before any session read or dispatch", async () => {
    const sessions = fakeSessions();
    const getSession = vi.spyOn(sessions, "getSession");
    const call = await callWidgetTool(probe(), { calls: 2 }, { handlers: summaryHandlers, principal: noScope, sessions });
    expect(call.result.isError).toBe(true);
    expect(call.error).toEqual({ code: "FORBIDDEN", message: "Missing scope qasir:read" });
    expect(call.dispatcher.calls).toHaveLength(0);
    expect(getSession).not.toHaveBeenCalled();
  });

  it("refuses non-read operations before dispatching", async () => {
    const def = probe({
      async run(_input, ctx) {
        await ctx.request({ operationId: "purchases.cancel", path: { id: "1" } });
        return { text: "unreachable", structured: ctx.meta("1") };
      },
    });
    const call = await callWidgetTool(def, {}, { handlers: { "purchases.cancel": () => ({ ok: true }) } });
    expect(call.error?.code).toBe("MUTATION_DISABLED");
    expect(call.dispatcher.calls).toHaveLength(0);
  });

  it("adds connect_url for QASIR_AUTH_EXPIRED", async () => {
    const handlers: Record<string, FixtureHandler> = {
      [SUMMARY]: () => {
        throw new AppError(ErrorCodes.QASIR_AUTH_EXPIRED, "Upstream auth failed (401); reconnect at /connect");
      },
    };
    const call = await callWidgetTool(probe(), {}, { handlers });
    expect(call.error).toEqual({
      code: "QASIR_AUTH_EXPIRED",
      message: "Upstream auth failed (401); reconnect at /connect",
      connect_url: "https://mcp.example.test/connect",
    });
  });

  it("adds connect_url when the session itself has expired", async () => {
    const sessions = fakeSessions();
    vi.spyOn(sessions, "getSession").mockRejectedValue(
      new AppError(ErrorCodes.QASIR_AUTH_EXPIRED, "Qasir is not connected; open /connect"),
    );
    const call = await callWidgetTool(probe(), {}, { handlers: summaryHandlers, sessions, env: { PUBLIC_BASE_URL: "https://mcp.example.test/" } });
    expect(call.error?.connect_url).toBe("https://mcp.example.test/connect");
    expect(call.dispatcher.calls).toHaveLength(0);
  });

  it("omits connect_url for every other code", async () => {
    const handlers: Record<string, FixtureHandler> = {
      [SUMMARY]: () => {
        throw new AppError(ErrorCodes.QASIR_RATE_LIMITED, "Upstream rate limited (429)");
      },
    };
    const call = await callWidgetTool(probe(), {}, { handlers });
    expect(call.error).toEqual({ code: "QASIR_RATE_LIMITED", message: "Upstream rate limited (429)" });
    expect(JSON.parse(call.text)).not.toHaveProperty("connect_url");
    const plain = widgetErrorResult(new AppError(ErrorCodes.FORBIDDEN, "Missing scope qasir:read"), testEnv());
    expect(plain).toEqual({ isError: true, content: [{ type: "text", text: '{"code":"FORBIDDEN","message":"Missing scope qasir:read"}' }] });
  });

  it("recognises an AppError that crossed an RPC boundary", () => {
    const crossed = Object.assign(new Error("Stored Qasir credentials are malformed; reconnect at /connect"), {
      name: "AppError",
      code: "QASIR_AUTH_EXPIRED",
    });
    const result = widgetErrorResult(crossed, testEnv());
    const first = result.content[0];
    expect(first?.type === "text" ? JSON.parse(first.text) : null).toEqual({
      code: "QASIR_AUTH_EXPIRED",
      message: "Stored Qasir credentials are malformed; reconnect at /connect",
      connect_url: "https://mcp.example.test/connect",
    });
  });

  it("hides the message of a thrown non-AppError", async () => {
    const def = probe({
      async run() {
        throw new TypeError("boom for Pelanggan A 0800-0000-0001");
      },
    });
    const call = await callWidgetTool(def, {}, { handlers: {} });
    expect(call.error).toEqual({ code: "UPSTREAM_ERROR", message: "Internal error while running the tool" });
    expect(call.text).not.toContain("Pelanggan A");
  });

  it("logs only the error code, never the input", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const handlers: Record<string, FixtureHandler> = {
      [SUMMARY]: () => {
        throw new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream 500");
      },
    };
    await callWidgetTool(probe(), { search: "Pelanggan A" }, { handlers });
    const lines = warn.mock.calls.map((args) => String(args[0]));
    const entry = lines.map((line) => JSON.parse(line) as Record<string, unknown>).find((e) => e.message === "tool.stock_page.error");
    expect(entry).toMatchObject({ level: "warn", code: "UPSTREAM_ERROR" });
    expect(lines.join("\n")).not.toContain("Pelanggan A");
  });
});

describe("invokeWidgetTool: output caps", () => {
  it("cuts the text block to 2,000 characters ending with …", async () => {
    const def = probe({
      async run(_input, ctx) {
        return { text: "a".repeat(5_000), structured: ctx.meta("1") };
      },
    });
    const call = await callWidgetTool(def, {}, { handlers: {} });
    expect(call.text).toHaveLength(2_000);
    expect(call.text.endsWith("…")).toBe(true);
    expect(call.result.content).toHaveLength(1);
  });

  it("leaves text of exactly 2,000 characters alone", async () => {
    const def = probe({
      async run(_input, ctx) {
        return { text: "b".repeat(2_000), structured: ctx.meta("1") };
      },
    });
    const call = await callWidgetTool(def, {}, { handlers: {} });
    expect(call.text).toBe("b".repeat(2_000));
  });

  it("refuses structuredContent over STRUCTURED_MAX_CHARS with RESULT_LIMIT_EXCEEDED", async () => {
    const def = probe({
      async run(_input, ctx) {
        return { text: "besar", structured: { ...ctx.meta("1"), blob: "x".repeat(STRUCTURED_MAX_CHARS) } };
      },
    });
    const call = await callWidgetTool(def, {}, { handlers: {} });
    expect(call.result.isError).toBe(true);
    expect(call.result.structuredContent).toBeUndefined();
    expect(call.error?.code).toBe("RESULT_LIMIT_EXCEEDED");
    expect(call.error?.message).toMatch(/at most 250000 are allowed$/);
  });
});

describe("registerWidgetTool on the wire", () => {
  const viewDef: WidgetToolDef<typeof probeInput> = probe({
    name: "show_stock_browser",
    title: "Stok",
    description: "Open an interactive stock browser widget (test).",
    view: "stok",
  });
  const appDef = probe();

  function handler(principal: AuthPrincipal = readPrincipal) {
    return createMcpHandler(
      () => {
        const server = new McpServer({ name: "widget-test", version: "0.0.0" }, { capabilities: { tools: { listChanged: false } } });
        const deps: WidgetToolDeps = {
          env: testEnv(),
          principal,
          sessions: fakeSessions(),
          dispatcher: createFakeDispatcher(summaryHandlers),
          now: () => WIDGET_TEST_NOW,
        };
        registerWidgetTool(server, deps, viewDef);
        registerWidgetTool(server, deps, appDef);
        return server;
      },
      { route: "/mcp", legacy: "reject" },
    );
  }

  async function wire(method: string, params: Record<string, unknown> = {}, principal?: AuthPrincipal) {
    return readWire(await handler(principal).fetch(rpcRequest(method, params)));
  }

  type ListedTool = {
    name: string;
    title?: string;
    description?: string;
    annotations?: Record<string, unknown>;
    inputSchema: { properties?: Record<string, unknown> };
    outputSchema?: unknown;
    _meta?: Record<string, unknown>;
  };

  it("lists the view tool with resourceUri (plus legacy key) and the helper as app-only", async () => {
    const tools = (await wire("tools/list")).body.result!.tools as ListedTool[];
    expect(tools.map((t) => t.name)).toEqual(["show_stock_browser", "stock_page"]);
    const [view, app] = tools;
    expect(view!._meta).toEqual({
      ui: { resourceUri: "ui://manujujaya/stok.html" },
      "ui/resourceUri": "ui://manujujaya/stok.html",
    });
    expect(app!._meta).toEqual({ ui: { visibility: ["app"] } });
    for (const tool of tools) {
      expect(tool.annotations).toEqual({ ...WIDGET_TOOL_ANNOTATIONS });
      expect(tool.outputSchema).toBeUndefined();
      expect(Object.keys(tool.inputSchema.properties ?? {}).sort()).toEqual(["calls", "outlet_id", "search"]);
    }
    expect(view!.title).toBe("Stok");
  });

  it("tools/call returns text plus structuredContent with schema defaults applied", async () => {
    const res = await wire("tools/call", { name: "stock_page", arguments: {} });
    const result = res.body.result!;
    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([{ type: "text", text: "Probe selesai: 1 permintaan" }]);
    expect(result.structuredContent).toMatchObject({ outlet_id: "645203", today: "2026-09-15" });
  });

  it("tools/call without qasir:read is an isError FORBIDDEN result", async () => {
    const res = await wire("tools/call", { name: "stock_page", arguments: {} }, noScope);
    const result = res.body.result!;
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: '{"code":"FORBIDDEN","message":"Missing scope qasir:read"}' }]);
  });

  it("tools/call with out-of-bounds input is rejected by the SDK", async () => {
    const res = await wire("tools/call", { name: "stock_page", arguments: { outlet_id: "0645203" } });
    const result = res.body.result!;
    expect(result.isError).toBe(true);
    const content = result.content as Array<{ text: string }>;
    expect(content[0]!.text).toMatch(/^Input validation error/);
  });
});

describe("shared helpers", () => {
  it("envelopeData returns data or throws UPSTREAM_ERROR", () => {
    expect(envelopeData(envelope({ a: 1 }), "summary")).toEqual({ a: 1 });
    for (const bad of [null, "x", { data: [] }, { data: null }, {}]) {
      expect(() => envelopeData(bad, "summary")).toThrow(
        expect.objectContaining({ code: "UPSTREAM_ERROR", message: "Unexpected summary response" }),
      );
    }
  });

  it("recordsAt returns only records and [] for missing or non-array values", () => {
    expect(recordsAt({ rows: [{ id: 1 }, null, 3, [4], { id: 2 }] }, "rows")).toEqual([{ id: 1 }, { id: 2 }]);
    expect(recordsAt({}, "rows")).toEqual([]);
    expect(recordsAt({ rows: { id: 1 } }, "rows")).toEqual([]);
  });

  it("pageInfo reads the pagination block", () => {
    expect(pageInfo(envelope([], { current_page: 2, page_size: 50, total_page: "5", total_result: 230, next: "/api?page=3" }))).toEqual({
      currentPage: 2,
      totalPage: 5,
      totalResult: 230,
      hasNext: true,
    });
    expect(pageInfo(envelope([], { current_page: 5, total_page: 5, total_result: 230 }))).toEqual({
      currentPage: 5,
      totalPage: 5,
      totalResult: 230,
      hasNext: false,
    });
    expect(pageInfo(envelope([], { next: "" }))?.hasNext).toBe(false);
    expect(pageInfo(envelope([]))).toBeNull();
    expect(pageInfo(null)).toBeNull();
  });

  it("nextPageOf follows next, ignores totals, and guesses from a full page without pagination", () => {
    expect(nextPageOf(envelope([], { current_page: 1, total_page: 1, next: "/p2" }), 1, 101, 100)).toBe(2);
    // total_page says more pages exist, but next is missing: stop.
    expect(nextPageOf(envelope([], { current_page: 3, total_page: 9, total_result: 900 }), 3, 100, 100)).toBeNull();
    expect(nextPageOf(envelope([]), 1, 50, 50)).toBe(2);
    expect(nextPageOf(envelope([]), 1, 49, 50)).toBeNull();
    expect(nextPageOf(envelope([], { next: "/p501" }), 500, 50, 50)).toBeNull();
  });

  it("isUpstream404 matches only the dispatcher's JSON 404 error", () => {
    expect(isUpstream404(new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream 404"))).toBe(true);
    expect(isUpstream404(Object.assign(new Error("Upstream 404"), { name: "AppError", code: "UPSTREAM_ERROR" }))).toBe(true);
    expect(isUpstream404(new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream 500"))).toBe(false);
    expect(isUpstream404(new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream 404 (non-JSON body)"))).toBe(false);
    expect(isUpstream404(new AppError(ErrorCodes.UNSUPPORTED_OPERATION, "Upstream 404"))).toBe(false);
    expect(isUpstream404(new Error("Upstream 404"))).toBe(false);
  });

  it("capRows keeps the longest head that fits", () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Produk ${i}` }));
    const build = (r: typeof rows) => ({ truncated: true, rows: r });
    expect(capRows(rows, 1_000_000, build)).toEqual({ rows, truncated: false });
    const capped = capRows(rows, 500, build);
    expect(capped.truncated).toBe(true);
    expect(JSON.stringify(build(capped.rows)).length).toBeLessThanOrEqual(500);
    expect(JSON.stringify(build(rows.slice(0, capped.rows.length + 1))).length).toBeGreaterThan(500);
    expect(capped.rows).toEqual(rows.slice(0, capped.rows.length));
    expect(capRows(rows, 5, build)).toEqual({ rows: [], truncated: true });
  });

  it("formats rupiah, quantities and Indonesian dates", () => {
    expect(rupiah(1_250_000)).toBe("Rp 1.250.000");
    expect(rupiah(0)).toBe("Rp 0");
    expect(rupiah(1_250_000.6)).toBe("Rp 1.250.001");
    expect(formatQty(1234.567)).toBe("1.234,57");
    expect(formatQty(2)).toBe("2");
    expect(indoDate("2026-09-15")).toBe("15 Sep 2026");
    expect(indoDate("2026-08-02")).toBe("2 Agu 2026");
  });

  it("joinLines drops falsy lines and cuts to maxChars with …", () => {
    expect(joinLines(["Penjualan", null, "", undefined, false, "Laba"])).toBe("Penjualan\nLaba");
    expect(joinLines(["a".repeat(3_000)])).toHaveLength(2_000);
    expect(joinLines(["abcdef", "ghij"], 8)).toBe("abcdef\n…");
    expect(clipText("abc", 3)).toBe("abc");
    expect(clipText("abcd", 3)).toBe("ab…");
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `bun run test tests/unit/widgets-define.test.ts`
Expected: FAIL with `Error: Cannot find module '../../src/widgets/tools/define' imported from …/tests/unit/widgets-define.test.ts`.

- [ ] **Step 9: Implement `src/widgets/tools/shared.ts`**

```ts
/** Helpers shared by every widget tool: upstream envelopes, pagination, size caps, Indonesian text. */
import { AppError, ErrorCodes, isAppErrorLike } from "../../errors/codes";
import { pageInput } from "../contract";
import { isRecord, toNumberOrNull } from "../qasir-values";

/** Maximum length of a widget tool's text block. */
export const TEXT_MAX_CHARS = 2_000;
/** Highest page a widget pager accepts (pageInput max). */
const MAX_PAGE = pageInput.maxValue ?? 500;

/** `res.data` of a Qasir JSON envelope; anything else is UPSTREAM_ERROR. */
export function envelopeData(res: unknown, label: string): Record<string, unknown> {
  if (isRecord(res) && isRecord(res.data)) return res.data;
  throw new AppError(ErrorCodes.UPSTREAM_ERROR, `Unexpected ${label} response`);
}

/** The records in the array at `key`; a missing or non-array value gives []. Non-record items are skipped. */
export function recordsAt(obj: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = obj[key];
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export interface PageInfo {
  currentPage: number | null;
  totalPage: number | null;
  totalResult: number | null;
  hasNext: boolean;
}

/** Qasir `pagination` block (`current_page`, `total_page`, `total_result`, `next`), or null when absent. */
export function pageInfo(res: unknown): PageInfo | null {
  if (!isRecord(res) || !isRecord(res.pagination)) return null;
  const p = res.pagination;
  return {
    currentPage: toNumberOrNull(p.current_page),
    totalPage: toNumberOrNull(p.total_page),
    totalResult: toNumberOrNull(p.total_result),
    hasNext: typeof p.next === "string" && p.next.length > 0,
  };
}

/**
 * The page after `page`, or null. With a pagination block only `next` counts
 * (total_page/total_result can be wrong upstream); without one, a full page
 * suggests more rows. Never returns a page a widget pager would reject (> 500).
 */
export function nextPageOf(res: unknown, page: number, rowsReturned: number, pageSize: number): number | null {
  if (page >= MAX_PAGE) return null;
  const info = pageInfo(res);
  if (info) return info.hasNext ? page + 1 : null;
  return rowsReturned >= pageSize ? page + 1 : null;
}

/** The dispatcher's error for an upstream 404 with a JSON body (stockTurnover search with no match). */
export function isUpstream404(err: unknown): boolean {
  return isAppErrorLike(err) && err.code === ErrorCodes.UPSTREAM_ERROR && err.message === "Upstream 404";
}

/**
 * Keep the longest head of `rows` whose payload `build(rows)` serializes to at
 * most `maxChars`. `build` should produce the payload as sent when truncated
 * (truncated: true plus its reason), so the measured size is the final size.
 */
export function capRows<T>(rows: T[], maxChars: number, build: (rows: T[]) => unknown): { rows: T[]; truncated: boolean } {
  const fits = (n: number) => (JSON.stringify(build(rows.slice(0, n)))?.length ?? 0) <= maxChars;
  if (fits(rows.length)) return { rows, truncated: false };
  let lo = 0;
  let hi = rows.length - 1;
  // Largest n in [0, rows.length - 1] that fits; payload size grows with n.
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(mid)) lo = mid;
    else hi = mid - 1;
  }
  return { rows: rows.slice(0, lo), truncated: true };
}

const RUPIAH = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const QTY = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const INDO_DATE = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** 1250000 → "Rp 1.250.000" (plain space on every ICU build). */
export function rupiah(amount: number): string {
  return RUPIAH.format(amount).replace(/ /g, " ").replace(/Rp(?=\d)/, "Rp ");
}

/** 1234.567 → "1.234,57". */
export function formatQty(n: number): string {
  return QTY.format(n);
}

/** "2026-09-15" → "15 Sep 2026". */
export function indoDate(isoDate: string): string {
  return INDO_DATE.format(new Date(`${isoDate}T00:00:00Z`));
}

/** Cut `text` to `maxChars`, ending with "…" when cut. */
export function clipText(text: string, maxChars: number = TEXT_MAX_CHARS): string {
  return text.length > maxChars ? `${text.slice(0, Math.max(0, maxChars - 1))}…` : text;
}

/** Join the truthy lines with "\n" and cut the result to `maxChars` (default 2,000). */
export function joinLines(lines: Array<string | null | undefined | false>, maxChars: number = TEXT_MAX_CHARS): string {
  return clipText(lines.filter((line): line is string => typeof line === "string" && line.length > 0).join("\n"), maxChars);
}
```

- [ ] **Step 10: Implement `src/widgets/tools/define.ts`**

```ts
import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import type { z } from "zod";
import { SCOPES } from "../../auth/scopes";
import { requireScope, type AuthPrincipal } from "../../auth/verify";
import { toAppError } from "../../codemode/errors";
import type { CodemodeDispatcher } from "../../codemode/run";
import type { DispatchRequest } from "../../dispatcher/qasir-dispatcher";
import { AppError, ErrorCodes } from "../../errors/codes";
import { errorCodeOf, errorResult, jsonErrorResult } from "../../mcp/results";
import { log } from "../../observability/log";
import { getOperation } from "../../registry/operations";
import type { QasirSessionProvider } from "../../session/types";
import { DEFAULT_WIDGET_LIMITS, RequestBudget, type RequestBudgetLimits } from "../budget";
import {
  MCP_APP_LEGACY_RESOURCE_URI_KEY,
  STRUCTURED_MAX_CHARS,
  viewResourceUri,
  type ToolName,
  type ViewName,
} from "../contract";
import { jakartaToday } from "../qasir-dates";
import { clipText } from "./shared";

export interface WidgetToolDeps {
  env: Env;
  principal: AuthPrincipal;
  sessions: QasirSessionProvider;
  dispatcher: CodemodeDispatcher;
  /** Clock for "today" and generated_at (tests). */
  now?: () => Date;
  /** Overrides for concurrency, deadline and response budget (tests). */
  limits?: Partial<Omit<RequestBudgetLimits, "maxRequests">>;
}

export interface ToolContext {
  readonly now: Date;
  /** Calendar date in Asia/Jakarta for `now`. */
  readonly today: string;
  /** Aborted on deadline, budget exhaustion or when the call finishes. */
  readonly signal: AbortSignal;
  /** input ?? (await deps.sessions.getSession()).defaultOutletId; the session is read at most once per call. */
  outletId(input?: string): Promise<string>;
  /** Budgeted read-only dispatch; resolves to DispatchResult.data. */
  request(req: DispatchRequest): Promise<unknown>;
  /** Payload fields every structured result starts with. */
  meta(outletId: string): { outlet_id: string; generated_at: string; truncated: boolean; truncated_reason: string | null };
}

export interface ToolOutcome {
  text: string;
  structured: Record<string, unknown>;
}

export interface WidgetToolDef<S extends z.ZodObject> {
  name: ToolName;
  title: string;
  description: string;
  input: S;
  maxRequests: number;
  /** Set: model-visible view tool linked to ui://manujujaya/<view>.html. Unset: app-only helper. */
  view?: ViewName;
  run(input: z.output<S>, ctx: ToolContext): Promise<ToolOutcome>;
}

/** Element type for heterogeneous tool arrays. */
export type AnyWidgetToolDef = WidgetToolDef<any>;

export const WIDGET_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

/** `_meta` for a widget tool: resourceUri (plus the legacy flat key) for views, app-only visibility otherwise. */
export function widgetToolMeta(view: ViewName | undefined): Record<string, unknown> {
  if (view) {
    const uri = viewResourceUri(view);
    return { ui: { resourceUri: uri }, [MCP_APP_LEGACY_RESOURCE_URI_KEY]: uri };
  }
  return { ui: { visibility: ["app"] } };
}

/** errorResult(err), plus connect_url for QASIR_AUTH_EXPIRED so the widget can offer the reconnect link. */
export function widgetErrorResult(err: unknown, env: Env): CallToolResult {
  const app = toAppError(err);
  if (app?.code === ErrorCodes.QASIR_AUTH_EXPIRED) {
    const base = env.PUBLIC_BASE_URL.trim().replace(/\/+$/, "");
    return jsonErrorResult({ code: app.code, message: app.message, connect_url: `${base}/connect` });
  }
  return errorResult(err);
}

function assertReadOperation(operationId: string): void {
  const op = getOperation(operationId);
  if (!op || !op.exposed) throw new AppError(ErrorCodes.UNSUPPORTED_OPERATION, `Unknown operationId ${operationId}`);
  if (op.safety !== "read") {
    throw new AppError(ErrorCodes.MUTATION_DISABLED, `${operationId} is a ${op.safety} operation; widget tools are read-only`);
  }
}

function createToolContext(deps: WidgetToolDeps, budget: RequestBudget): ToolContext {
  const now = deps.now?.() ?? new Date();
  let sessionOutlet: Promise<string> | undefined;
  return {
    now,
    today: jakartaToday(now),
    signal: budget.signal,
    outletId(input) {
      if (input) return Promise.resolve(input);
      sessionOutlet ??= deps.sessions.getSession().then((session) => session.defaultOutletId);
      return sessionOutlet;
    },
    async request(req) {
      assertReadOperation(req.operationId);
      // Never allowMutation: the dispatcher refuses non-read operations as a second gate.
      const result = await budget.run((signal) => deps.dispatcher.dispatch(req, { signal }));
      return result.data;
    },
    meta(outletId) {
      return { outlet_id: outletId, generated_at: now.toISOString(), truncated: false, truncated_reason: null };
    },
  };
}

/** Settles only by rejecting, with the signal's reason, when the signal aborts. */
function rejectOnAbort(signal: AbortSignal): Promise<never> {
  const stopped = new Promise<never>((_, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  stopped.catch(() => undefined);
  return stopped;
}

/**
 * The whole widget tool handler: scope check, per-call budget and deadline,
 * run, text cap, structured-content cap, and error mapping with a code-only log.
 */
export async function invokeWidgetTool<S extends z.ZodObject>(
  def: WidgetToolDef<S>,
  deps: WidgetToolDeps,
  input: z.output<S>,
): Promise<CallToolResult> {
  const budget = new RequestBudget({ ...DEFAULT_WIDGET_LIMITS, ...deps.limits, maxRequests: def.maxRequests });
  let stopDeadline: (() => void) | undefined;
  try {
    requireScope(deps.principal, SCOPES.READ);
    stopDeadline = budget.startDeadline();
    const running = def.run(input, createToolContext(deps, budget));
    // If the budget stops the call first, the run settles later with nothing listening.
    running.catch(() => undefined);
    const outcome = await Promise.race([running, rejectOnAbort(budget.signal)]);
    const size = JSON.stringify(outcome.structured).length;
    if (size > STRUCTURED_MAX_CHARS) {
      throw new AppError(
        ErrorCodes.RESULT_LIMIT_EXCEEDED,
        `Widget result is ${size} characters of JSON; at most ${STRUCTURED_MAX_CHARS} are allowed`,
      );
    }
    return { content: [{ type: "text", text: clipText(outcome.text) }], structuredContent: outcome.structured };
  } catch (err) {
    log("warn", `tool.${def.name}.error`, { code: errorCodeOf(err) });
    return widgetErrorResult(err, deps.env);
  } finally {
    stopDeadline?.();
    // Cancels in-flight dispatches and refuses any request the run left behind.
    budget.abort(new AppError(ErrorCodes.INVALID_INPUT, "Widget tool call has already finished"));
  }
}

/** Register one widget tool on the per-request server. No outputSchema: the contract is enforced by tests and the widget. */
export function registerWidgetTool<S extends z.ZodObject>(server: McpServer, deps: WidgetToolDeps, def: WidgetToolDef<S>): void {
  // Widen to the non-generic schema type so the SDK's callback type resolves; it still parses with def.input.
  const inputSchema: z.ZodObject = def.input;
  server.registerTool(
    def.name,
    {
      title: def.title,
      description: def.description,
      inputSchema,
      annotations: { ...WIDGET_TOOL_ANNOTATIONS },
      _meta: widgetToolMeta(def.view),
    },
    (input) => invokeWidgetTool(def, deps, input as z.output<S>),
  );
}
```

- [ ] **Step 11: Run the tests and types**

Run: `bun run test tests/unit/widgets-budget.test.ts tests/unit/widgets-define.test.ts && bun run check-types`
Expected: 2 test files PASS (42 tests); `bun run check-types` exits 0 (run it in the Lane S worktree, so Lane W's unfinished `widgets/` files are not type-checked).

- [ ] **Step 12: Commit**

```bash
git add src/widgets/tools/define.ts src/widgets/tools/shared.ts tests/stubs/widget-harness.ts tests/unit/widgets-define.test.ts
git commit -m "feat(widgets): budgeted widget tool wrapper, shared helpers and test harness

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

---

### Task 3: Sales tools (penjualan dashboard, produk ranking)

**Files:**
- Create: `src/widgets/tools/sales.ts`
- Test: `tests/unit/widgets-sales.test.ts`

**Interfaces:**
- Consumes:
  - T1 `src/widgets/contract.ts`: `DEBT_SCAN_START_DATE`, `PAGE_SIZE`, `PRODUCT_ORDERS`, `PRODUCT_ORDER_LABEL`, `PRODUCT_ORDER_SORT`, `STRUCTURED_MAX_CHARS`, `isoDate`, `salesDashboardInput`, `productRankingInput`, `productRankingPageInput`, `salesDashboardData`, `productRankingData`, `productRankingPageData`, `type ProductOrder`, `type ToolOutput`.
  - T1 `src/widgets/qasir-dates.ts`: `assertDateRange`, `parseIndonesianDate`, `previousRange`. T1 `src/widgets/qasir-values.ts`: `isRecord`, `parsePercent`, `toNumber`, `toNumberOrNull`, `toText`.
  - T2 `src/widgets/tools/define.ts`: `WidgetToolDef<S>`, `AnyWidgetToolDef`, and `ToolContext` (`ctx.outletId(input?)`, `ctx.request(req)` resolving to the upstream envelope, `ctx.meta(outletId)`, `ctx.today`).
  - T2 `src/widgets/tools/shared.ts`: `capRows`, `envelopeData`, `formatQty`, `indoDate`, `joinLines`, `nextPageOf`, `recordsAt`, `rupiah`.
  - T2 `tests/stubs/widget-harness.ts`: `callWidgetTool`, `envelope`, `type WidgetCall` (default clock `2026-09-15T03:00:00Z`, default outlet `"645203"`, fake dispatcher that validates every query against `src/registry/ops`).
  - `DispatchRequest` from `src/dispatcher/qasir-dispatcher.ts`; `AppError`, `ErrorCodes` from `src/errors/codes.ts`.
- Produces (`src/widgets/tools/sales.ts`):
  - `export const salesDashboardTool: WidgetToolDef<typeof salesDashboardInput>` (name `show_sales_dashboard`, view `penjualan`, maxRequests 6)
  - `export const productRankingTool: WidgetToolDef<typeof productRankingInput>` (name `show_product_ranking`, view `produk`, maxRequests 2)
  - `export const productRankingPageTool: WidgetToolDef<typeof productRankingPageInput>` (name `product_ranking_page`, app-only, maxRequests 1)
  - `export const SALES_TOOLS: readonly AnyWidgetToolDef[]` in that order.

Projection rules this task implements (spec §2 and §4.2 items 1–2):
- Every tool calls `assertDateRange(start_date, end_date)` before resolving the outlet or dispatching, so a reversed or > 366-day range is `INVALID_INPUT` with zero upstream calls.
- `show_sales_dashboard` fires six reads through `Promise.all` (the budget caps concurrency at 4):
  - `reports.summaries.transaction` `{start_date, end_date, outlet_ids}` → `kpis` from `summary_sales` (`sales` → `sales_before_discount`, `total_gross_sales` → `gross_sales`, `total_profit` → `profit`, `capital_price` → `capital`, `total_transaction` → `transactions`, `total_quantity` → `quantity`, plus `discount`, `tax`), `average_ticket = round(gross_sales / transactions)` (0 without transactions). `changes` come from `summary_sales.sales_trend.{gross,profit,transaction,quantity}`: `percent` is the unsigned `parsePercent(value)` and `direction` is `status` (`up`/`down`, else null); empty strings give nulls.
  - `reports.sales.trend` with `trend_type: "sales"` and `comparison_start_date`/`comparison_end_date` = `previousRange(...)` (sent for single-day ranges too) → `trend[]`. Point dates accept `YYYY-MM-DD[ time]`, `MM/DD/YYYY` or `DD Bulan YYYY`; points with an unparseable `date` are dropped, an unparseable `comparison_date` becomes null.
  - `reports.summaries.paymentMethods` (`country_code: "ID"`, `language_code: "id"`, as the dashboard sends) → `payment_methods[]` sorted by amount, largest first.
  - `reports.categories` `page 1, count 10` → `categories[]`.
  - `reports.products` `page 1, count 5, sort "-quantity"` → `top_products[]` with the id-0 "Transaksi Manual" pseudo row removed.
  - `reports.summaries.installment` from `2015-01-01` to Jakarta today → `receivable {total: total_receivable, customers: total_customer}`.
- `show_product_ranking`: `reports.products` `page 1, count 50, sort PRODUCT_ORDER_SORT[order]` (default order `terlaris`) plus `reports.categories` `page 1, count 20`. The pseudo row becomes `manual_transactions {quantity, gross}` (null when absent). `rank = (page − 1) × 50 + index + 1`. Because `total_result` overstates, `next_page` is null whenever fewer than 50 real rows came back; otherwise it is `nextPageOf(...)`, which never offers a page above 500.
- `product_ranking_page`: the same `reports.products` read for `page`; pseudo rows are dropped on any page.
- Row arrays pass through `capRows(..., STRUCTURED_MAX_CHARS, ...)`; when rows are cut, `truncated` is true and `truncated_reason` is `"Baris terakhir dipangkas karena hasil melebihi 250 KB."`.

- [ ] **Step 1: Write the failing test**

`tests/unit/widgets-sales.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import type { DispatchRequest } from "../../src/dispatcher/qasir-dispatcher";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import {
  PRODUCT_ORDERS,
  PRODUCT_ORDER_SORT,
  productRankingData,
  productRankingPageData,
  salesDashboardData,
  type ToolOutput,
} from "../../src/widgets/contract";
import {
  SALES_TOOLS,
  productRankingPageTool,
  productRankingTool,
  salesDashboardTool,
} from "../../src/widgets/tools/sales";
import { callWidgetTool, envelope, type WidgetCall } from "../stubs/widget-harness";

// Harness clock: 2026-09-15T03:00:00Z = 10:00 in Jakarta, so "today" is 2026-09-15.
const GENERATED_AT = "2026-09-15T03:00:00.000Z";
const META = { outlet_id: "645203", generated_at: GENERATED_AT, truncated: false, truncated_reason: null };

function expectContract<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.parse(value);
  // Parsing strips unknown keys, so equality proves the tool emits contract fields only.
  expect(parsed).toEqual(value);
  return parsed;
}

function requests(call: WidgetCall): DispatchRequest[] {
  expect(call.dispatcher.calls.every((c) => c.opts?.allowMutation === undefined)).toBe(true);
  return call.dispatcher.calls.map((c) => c.req);
}

function byOperation(reqs: DispatchRequest[]): DispatchRequest[] {
  return [...reqs].sort((a, b) => a.operationId.localeCompare(b.operationId));
}

// ── Synthetic upstream payloads (shapes per spec §2; no real names or numbers) ──

function summaryPayload() {
  return envelope({
    summary_sales: {
      sales: 9_185_000,
      discount: 15_000,
      total_gross_sales: 9_170_000,
      capital_price: 6_000_000,
      total_profit: 3_170_000,
      tax: 0,
      total_transaction: 120,
      total_quantity: 245.5,
      cash_in: -5_000,
      sales_trend: {
        comparison_date: "09/01/2026 - 09/07/2026",
        gross: { value: "21,16%", status: "up" },
        profit: { value: "2,41%", status: "down" },
        transaction: { value: "", status: "" },
        quantity: { value: "3496,08%", status: "up" },
      },
    },
  });
}

function emptySummaryPayload() {
  return envelope({
    summary_sales: {
      sales: "",
      discount: "",
      total_gross_sales: "",
      capital_price: "",
      total_profit: "",
      tax: "",
      total_transaction: "",
      total_quantity: "",
      sales_trend: {
        comparison_date: "",
        gross: { value: "", status: "" },
        profit: { value: "", status: "" },
        transaction: { value: "", status: "" },
        quantity: { value: "", status: "" },
      },
    },
  });
}

function trendPayload() {
  return envelope({
    data_trends: [
      { date: "2026-09-08", amount: 1_200_000, comparison_date: "2026-09-01", comparison_amount: 1_000_000, percentage_change: "20%", status: "up" },
      { date: "2026-09-09 00:00:00", amount: "1300000.00", comparison_date: "", comparison_amount: null, percentage_change: "", status: "" },
      { date: "bukan tanggal", amount: 5, comparison_date: "", comparison_amount: 0 },
    ],
    current_period: { date: "2026-09-08 - 2026-09-14", total_amount: 2_500_000 },
    comparison_period: { date: "2026-09-01 - 2026-09-07", total_amount: 1_000_000 },
  });
}

function paymentPayload() {
  return envelope({
    payment_method: [
      { id: 1, name: "QRIS", quantity: 40, amount: 3_000_000 },
      { id: 2, name: "CASH", quantity: 80, amount: 6_170_000 },
    ],
  });
}

function categoriesPayload() {
  return envelope(
    {
      report_categories: [
        { id: 11, name: "Kategori Oli", quantity: 30, total_gross: 2_400_000, total_collected: 2_350_000, total_tax: 0, unit_label: "pcs" },
        { id: 12, name: "Kategori Filter", quantity: "4.5", total_gross: "180000.00", total_collected: 180_000, total_tax: 0, unit_label: "pcs" },
      ],
    },
    { current_page: 1, page_size: 10, total_page: 1, total_result: 2 },
  );
}

const MANUAL_ROW = { id: 0, name: "Transaksi Manual", category_name: "Transaksi Manual", sku: "", quantity: 2, total_gross: 50_000, total_collected: 50_000, unit_label: "", type: "" };

function productRow(i: number) {
  return {
    id: 1000 + i,
    name: `Produk ${i}`,
    category_name: "Kategori Oli",
    sku: ` SKU-${i} `,
    quantity: 100 - i,
    total_gross: (100 - i) * 10_000,
    total_collected: (100 - i) * 9_000,
    unit_label: "pcs",
    type: "product",
  };
}

function expectedRank(i: number, rank: number) {
  return {
    rank,
    id: 1000 + i,
    name: `Produk ${i}`,
    category: "Kategori Oli",
    sku: `SKU-${i}`,
    quantity: 100 - i,
    unit: "pcs",
    gross: (100 - i) * 10_000,
    collected: (100 - i) * 9_000,
  };
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, k) => from + k);
}

const EXPECTED_CATEGORIES = [
  { id: 11, name: "Kategori Oli", quantity: 30, gross: 2_400_000, collected: 2_350_000 },
  { id: 12, name: "Kategori Filter", quantity: 4.5, gross: 180_000, collected: 180_000 },
];

// ── show_sales_dashboard ────────────────────────────────────────────────────

describe("show_sales_dashboard", () => {
  it("dispatches the six report reads with registry-valid queries and projects every field", async () => {
    const call = await callWidgetTool(
      salesDashboardTool,
      { start_date: "2026-09-08", end_date: "2026-09-14" },
      {
        handlers: {
          "reports.summaries.transaction": () => summaryPayload(),
          "reports.sales.trend": () => trendPayload(),
          "reports.summaries.paymentMethods": () => paymentPayload(),
          "reports.categories": () => categoriesPayload(),
          "reports.products": () => envelope({ report_products: [MANUAL_ROW, productRow(1), productRow(2)] }),
          "reports.summaries.installment": () =>
            envelope({ total_customer: 22, total_down_payment: 1_250_000, total_receivable: 53_634_000 }),
        },
      },
    );

    expect(call.error).toBeUndefined();
    const outlet = { start_date: "2026-09-08", end_date: "2026-09-14", outlet_ids: "645203" };
    expect(byOperation(requests(call))).toEqual(
      byOperation([
        { operationId: "reports.summaries.transaction", query: outlet },
        {
          operationId: "reports.sales.trend",
          query: { ...outlet, trend_type: "sales", comparison_start_date: "2026-09-01", comparison_end_date: "2026-09-07" },
        },
        { operationId: "reports.summaries.paymentMethods", query: { ...outlet, country_code: "ID", language_code: "id" } },
        { operationId: "reports.categories", query: { page: 1, count: 10, ...outlet } },
        { operationId: "reports.products", query: { page: 1, count: 5, ...outlet, sort: "-quantity" } },
        {
          operationId: "reports.summaries.installment",
          query: { start_date: "2015-01-01", end_date: "2026-09-15", outlet_ids: "645203" },
        },
      ]),
    );

    const data = expectContract(salesDashboardData, call.structured);
    const expected: ToolOutput<"show_sales_dashboard"> = {
      view: "penjualan",
      ...META,
      range: { start_date: "2026-09-08", end_date: "2026-09-14" },
      comparison: { start_date: "2026-09-01", end_date: "2026-09-07" },
      kpis: {
        sales_before_discount: 9_185_000,
        discount: 15_000,
        gross_sales: 9_170_000,
        profit: 3_170_000,
        capital: 6_000_000,
        tax: 0,
        transactions: 120,
        quantity: 245.5,
        average_ticket: 76_417,
      },
      changes: {
        gross: { percent: 21.16, direction: "up" },
        profit: { percent: 2.41, direction: "down" },
        transactions: { percent: null, direction: null },
        quantity: { percent: 3496.08, direction: "up" },
      },
      trend: [
        { date: "2026-09-08", amount: 1_200_000, comparison_date: "2026-09-01", comparison_amount: 1_000_000 },
        { date: "2026-09-09", amount: 1_300_000, comparison_date: null, comparison_amount: null },
      ],
      payment_methods: [
        { name: "CASH", quantity: 80, amount: 6_170_000 },
        { name: "QRIS", quantity: 40, amount: 3_000_000 },
      ],
      categories: EXPECTED_CATEGORIES,
      top_products: [expectedRank(1, 1), expectedRank(2, 2)],
      receivable: { total: 53_634_000, customers: 22 },
    };
    expect(data).toEqual(expected);

    expect(call.result.content).toHaveLength(1);
    expect(call.text.length).toBeLessThanOrEqual(2000);
    expect(call.text).toContain("Penjualan 8 Sep 2026 – 14 Sep 2026 (outlet 645203), dibandingkan 1 Sep 2026 – 7 Sep 2026.");
    expect(call.text).toContain("Penjualan kotor: Rp 9.170.000 (naik 21,16% dari periode sebelumnya).");
    expect(call.text).toContain("Laba kotor: Rp 3.170.000 (turun 2,41% dari periode sebelumnya).");
    expect(call.text).toContain("Transaksi: 120; rata-rata Rp 76.417 per transaksi.");
    expect(call.text).toContain("Metode pembayaran teratas: CASH Rp 6.170.000 (80 transaksi).");
    expect(call.text).toContain("Produk terlaris: 1. Produk 1 (99 pcs), 2. Produk 2 (98 pcs).");
    expect(call.text).toContain("Sisa piutang (laporan Qasir): Rp 53.634.000 dari 22 pelanggan.");
    expect(call.text).not.toContain("Transaksi Manual");
  });

  it("handles a day without data, a single-day comparison and an explicit outlet", async () => {
    const call = await callWidgetTool(
      salesDashboardTool,
      { start_date: "2026-09-15", end_date: "2026-09-15", outlet_id: "777" },
      {
        handlers: {
          "reports.summaries.transaction": () => emptySummaryPayload(),
          "reports.sales.trend": () => envelope({ data_trends: [] }),
          "reports.summaries.paymentMethods": () => envelope({ payment_method: [] }),
          "reports.categories": () => envelope({ report_categories: [] }),
          "reports.products": () => envelope({ report_products: [] }),
          "reports.summaries.installment": () => envelope({ total_customer: 0, total_down_payment: 0, total_receivable: 0 }),
        },
      },
    );

    expect(call.error).toBeUndefined();
    const reqs = requests(call);
    expect(reqs).toHaveLength(6);
    for (const req of reqs) expect(req.query?.outlet_ids).toBe("777");
    expect(reqs.find((r) => r.operationId === "reports.sales.trend")?.query).toMatchObject({
      comparison_start_date: "2026-09-14",
      comparison_end_date: "2026-09-14",
    });

    const data = expectContract(salesDashboardData, call.structured);
    expect(data).toEqual({
      view: "penjualan",
      ...META,
      outlet_id: "777",
      range: { start_date: "2026-09-15", end_date: "2026-09-15" },
      comparison: { start_date: "2026-09-14", end_date: "2026-09-14" },
      kpis: {
        sales_before_discount: 0,
        discount: 0,
        gross_sales: 0,
        profit: 0,
        capital: 0,
        tax: 0,
        transactions: 0,
        quantity: 0,
        average_ticket: 0,
      },
      changes: {
        gross: { percent: null, direction: null },
        profit: { percent: null, direction: null },
        transactions: { percent: null, direction: null },
        quantity: { percent: null, direction: null },
      },
      trend: [],
      payment_methods: [],
      categories: [],
      top_products: [],
      receivable: { total: 0, customers: 0 },
    });
    expect(call.text).toContain("Penjualan 15 Sep 2026 (outlet 777), dibandingkan 14 Sep 2026.");
    expect(call.text).toContain("Tidak ada transaksi pada periode ini.");
    expect(call.text).not.toContain("Produk terlaris");
    expect(call.text).not.toContain("Metode pembayaran teratas");
  });

  it("rejects reversed and over-long ranges before any dispatch", async () => {
    for (const input of [
      { start_date: "2026-09-15", end_date: "2026-09-14" },
      { start_date: "2025-09-14", end_date: "2026-09-15" },
    ]) {
      const call = await callWidgetTool(salesDashboardTool, input, { handlers: {} });
      expect(call.result.isError).toBe(true);
      expect(call.error?.code).toBe("INVALID_INPUT");
      expect(call.dispatcher.calls).toHaveLength(0);
    }
  });

  it("surfaces an upstream failure as a {code, message} error without structured content", async () => {
    const ok = () => envelope({});
    const call = await callWidgetTool(
      salesDashboardTool,
      { start_date: "2026-09-08", end_date: "2026-09-14" },
      {
        handlers: {
          "reports.summaries.transaction": ok,
          "reports.sales.trend": ok,
          "reports.summaries.paymentMethods": ok,
          "reports.categories": ok,
          "reports.products": () => {
            throw new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream 500");
          },
          "reports.summaries.installment": ok,
        },
      },
    );
    expect(call.result.isError).toBe(true);
    expect(call.error).toEqual({ code: "UPSTREAM_ERROR", message: "Upstream 500" });
    expect(call.result.structuredContent).toBeUndefined();
  });
});

// ── show_product_ranking ────────────────────────────────────────────────────

describe("show_product_ranking", () => {
  const fullFirstPage = () =>
    envelope(
      { report_products: [MANUAL_ROW, ...range(1, 50).map(productRow)] },
      { current_page: 1, page_size: 50, total_page: 3, total_result: 150, next: "/api/v5/reports/products?page=2" },
    );

  it("ranks page 1 without the manual pseudo row and reports it separately", async () => {
    const call = await callWidgetTool(
      productRankingTool,
      { start_date: "2026-09-08", end_date: "2026-09-14" },
      { handlers: { "reports.products": () => fullFirstPage(), "reports.categories": () => categoriesPayload() } },
    );

    expect(call.error).toBeUndefined();
    const outlet = { start_date: "2026-09-08", end_date: "2026-09-14", outlet_ids: "645203" };
    expect(byOperation(requests(call))).toEqual([
      { operationId: "reports.categories", query: { page: 1, count: 20, ...outlet } },
      { operationId: "reports.products", query: { page: 1, count: 50, ...outlet, sort: "-quantity" } },
    ]);

    const data = expectContract(productRankingData, call.structured);
    const expected: ToolOutput<"show_product_ranking"> = {
      view: "produk",
      ...META,
      range: { start_date: "2026-09-08", end_date: "2026-09-14" },
      order: "terlaris",
      rows: range(1, 50).map((i) => expectedRank(i, i)),
      categories: EXPECTED_CATEGORIES,
      manual_transactions: { quantity: 2, gross: 50_000 },
      next_page: 2,
    };
    expect(data).toEqual(expected);

    expect(call.text.length).toBeLessThanOrEqual(2000);
    expect(call.text).toContain("Peringkat produk terlaris, 8 Sep 2026 – 14 Sep 2026 (outlet 645203):");
    expect(call.text).toContain("1. Produk 1: 99 pcs, Rp 990.000");
    expect(call.text).toContain("10. Produk 10: 90 pcs, Rp 900.000");
    expect(call.text).not.toContain("11. Produk 11");
    expect(call.text).toContain("Transaksi manual (tanpa produk): 2 item, Rp 50.000.");
    expect(call.text).toContain("50 produk pertama dimuat");
  });

  it.each(PRODUCT_ORDERS)("sends the upstream sort token for order %s", async (order) => {
    const call = await callWidgetTool(
      productRankingTool,
      { start_date: "2026-09-01", end_date: "2026-09-30", order },
      {
        handlers: {
          "reports.products": () => envelope({ report_products: [productRow(1)] }),
          "reports.categories": () => envelope({ report_categories: [] }),
        },
      },
    );
    const products = requests(call).find((r) => r.operationId === "reports.products");
    expect(products?.query?.sort).toBe(PRODUCT_ORDER_SORT[order]);
    expect(expectContract(productRankingData, call.structured).order).toBe(order);
  });

  it("stops paging on a short page even when upstream still advertises a next page", async () => {
    const call = await callWidgetTool(
      productRankingTool,
      { start_date: "2026-09-08", end_date: "2026-09-14", order: "kurang_laris" },
      {
        handlers: {
          "reports.products": () =>
            envelope(
              { report_products: [productRow(1), productRow(2), productRow(3)] },
              { current_page: 1, page_size: 50, total_page: 2, total_result: 60, next: "/api/v5/reports/products?page=2" },
            ),
          "reports.categories": () => envelope({ report_categories: [] }),
        },
      },
    );
    const data = expectContract(productRankingData, call.structured);
    expect(data.rows.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(data.manual_transactions).toBeNull();
    expect(data.next_page).toBeNull();
    expect(call.text).toContain("Peringkat produk kurang laris");
    expect(call.text).not.toContain("Transaksi manual");
  });

  it("rejects an over-long range before any dispatch", async () => {
    const call = await callWidgetTool(productRankingTool, { start_date: "2025-01-01", end_date: "2026-09-15" }, { handlers: {} });
    expect(call.error?.code).toBe("INVALID_INPUT");
    expect(call.dispatcher.calls).toHaveLength(0);
  });
});

// ── product_ranking_page ────────────────────────────────────────────────────

describe("product_ranking_page", () => {
  it("continues ranks from the page offset", async () => {
    const call = await callWidgetTool(
      productRankingPageTool,
      { start_date: "2026-09-08", end_date: "2026-09-14", order: "omzet_tertinggi", page: 3, outlet_id: "645203" },
      {
        handlers: {
          "reports.products": () =>
            envelope(
              { report_products: range(101, 150).map(productRow) },
              { current_page: 3, page_size: 50, total_page: 5, total_result: 250, next: "/api/v5/reports/products?page=4" },
            ),
        },
      },
    );

    expect(requests(call)).toEqual([
      {
        operationId: "reports.products",
        query: { page: 3, count: 50, start_date: "2026-09-08", end_date: "2026-09-14", outlet_ids: "645203", sort: "-total_gross" },
      },
    ]);
    const data = expectContract(productRankingPageData, call.structured);
    const expected: ToolOutput<"product_ranking_page"> = {
      ...META,
      order: "omzet_tertinggi",
      page: 3,
      rows: range(101, 150).map((i) => expectedRank(i, i)),
      next_page: 4,
    };
    expect(data).toEqual(expected);
    expect(call.text).toBe("Peringkat produk omzet tertinggi halaman 3: peringkat 101–150.\nHalaman berikutnya: 4.");
  });

  it("returns an empty last page when total_result overstated the rows", async () => {
    const call = await callWidgetTool(
      productRankingPageTool,
      { start_date: "2026-09-08", end_date: "2026-09-14", order: "terlaris", page: 4 },
      { handlers: { "reports.products": () => envelope({ report_products: [] }, { current_page: 4, total_page: 4, total_result: 200 }) } },
    );
    const data = expectContract(productRankingPageData, call.structured);
    expect(data.rows).toEqual([]);
    expect(data.next_page).toBeNull();
    expect(call.text).toBe("Peringkat produk terlaris halaman 4: tidak ada produk lagi.");
  });

  it("never offers a page beyond 500", async () => {
    const call = await callWidgetTool(
      productRankingPageTool,
      { start_date: "2026-09-08", end_date: "2026-09-14", order: "terlaris", page: 500 },
      {
        handlers: {
          "reports.products": () =>
            envelope({ report_products: range(1, 50).map(productRow) }, { current_page: 500, next: "/api/v5/reports/products?page=501" }),
        },
      },
    );
    expect(expectContract(productRankingPageData, call.structured).next_page).toBeNull();
  });
});

// ── Registration metadata ───────────────────────────────────────────────────

describe("SALES_TOOLS", () => {
  it("declares names, budgets, views and description rules", () => {
    expect(SALES_TOOLS.map((t) => [t.name, t.maxRequests, t.view])).toEqual([
      ["show_sales_dashboard", 6, "penjualan"],
      ["show_product_ranking", 2, "produk"],
      ["product_ranking_page", 1, undefined],
    ]);
    for (const tool of SALES_TOOLS) {
      if (tool.view) {
        expect(tool.description.startsWith("Open an interactive")).toBe(true);
        expect(tool.description.length).toBeLessThanOrEqual(600);
      } else {
        expect(tool.description.startsWith("Widget helper:")).toBe(true);
        expect(tool.description.length).toBeLessThanOrEqual(300);
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test tests/unit/widgets-sales.test.ts`
Expected: FAIL with `Error: Cannot find module '../../src/widgets/tools/sales' imported from .../tests/unit/widgets-sales.test.ts`.

- [ ] **Step 3: Implement `src/widgets/tools/sales.ts`**

```ts
import type { DispatchRequest } from "../../dispatcher/qasir-dispatcher";
import {
  DEBT_SCAN_START_DATE,
  PAGE_SIZE,
  PRODUCT_ORDER_LABEL,
  PRODUCT_ORDER_SORT,
  STRUCTURED_MAX_CHARS,
  isoDate,
  productRankingInput,
  productRankingPageInput,
  salesDashboardInput,
  type ProductOrder,
  type ToolOutput,
} from "../contract";
import { assertDateRange, parseIndonesianDate, previousRange } from "../qasir-dates";
import { isRecord, parsePercent, toNumber, toNumberOrNull, toText } from "../qasir-values";
import type { AnyWidgetToolDef, WidgetToolDef } from "./define";
import { capRows, envelopeData, formatQty, indoDate, joinLines, nextPageOf, recordsAt, rupiah } from "./shared";

type DashboardData = ToolOutput<"show_sales_dashboard">;
type RankingData = ToolOutput<"show_product_ranking">;
type RankingPageData = ToolOutput<"product_ranking_page">;
type RankRow = RankingData["rows"][number];
type CategoryRow = DashboardData["categories"][number];
type Change = DashboardData["changes"]["gross"];
type Range = { start_date: string; end_date: string };

const DASHBOARD_CATEGORIES = 10;
const DASHBOARD_TOP_PRODUCTS = 5;
const TEXT_TOP_PRODUCTS = 10;
const TRUNCATED_REASON = "Baris terakhir dipangkas karena hasil melebihi 250 KB.";

// ── Upstream requests (operationIds are fixed; queries match src/registry/ops/reports.ts) ──

function rangeQuery(outletId: string, range: Range): { start_date: string; end_date: string; outlet_ids: string } {
  return { start_date: range.start_date, end_date: range.end_date, outlet_ids: outletId };
}

function productsRequest(outletId: string, range: Range, order: ProductOrder, page: number, count: number): DispatchRequest {
  return {
    operationId: "reports.products",
    query: { page, count, ...rangeQuery(outletId, range), sort: PRODUCT_ORDER_SORT[order] },
  };
}

function categoriesRequest(outletId: string, range: Range, count: number): DispatchRequest {
  return { operationId: "reports.categories", query: { page: 1, count, ...rangeQuery(outletId, range) } };
}

// ── Projections ─────────────────────────────────────────────────────────────

/** reports.products page 1 prepends a "Transaksi Manual" pseudo row with id 0. */
function isManualRow(row: Record<string, unknown>): boolean {
  return toNumber(row.id) === 0;
}

interface ProductPage {
  rows: RankRow[];
  manual: { quantity: number; gross: number } | null;
  next: number | null;
}

function projectProducts(res: unknown, page: number, pageSize: number): ProductPage {
  const raw = recordsAt(envelopeData(res, "reports.products"), "report_products");
  const manualRow = raw.find(isManualRow);
  const real = raw.filter((row) => !isManualRow(row)).slice(0, pageSize);
  const offset = (page - 1) * pageSize;
  const rows = real.map((row, index) => ({
    rank: offset + index + 1,
    id: toNumber(row.id),
    name: toText(row.name),
    category: toText(row.category_name),
    sku: toText(row.sku),
    quantity: toNumber(row.quantity),
    unit: toText(row.unit_label),
    gross: toNumber(row.total_gross),
    collected: toNumber(row.total_collected),
  }));
  // total_result overstates, so a short page is always the last one.
  const next = real.length < pageSize ? null : nextPageOf(res, page, real.length, pageSize);
  return {
    rows,
    manual: manualRow ? { quantity: toNumber(manualRow.quantity), gross: toNumber(manualRow.total_gross) } : null,
    next,
  };
}

function projectCategories(res: unknown, count: number): CategoryRow[] {
  return recordsAt(envelopeData(res, "reports.categories"), "report_categories")
    .slice(0, count)
    .map((row) => ({
      id: toNumber(row.id),
      name: toText(row.name),
      quantity: toNumber(row.quantity),
      gross: toNumber(row.total_gross),
      collected: toNumber(row.total_collected),
    }));
}

/** Trend dates arrive as YYYY-MM-DD (optionally with a time), MM/DD/YYYY or "DD Bulan YYYY". */
function trendDate(value: unknown): string | null {
  const text = toText(value);
  const iso = /^(\d{4}-\d{2}-\d{2})(?:$|[T ])/.exec(text);
  const us = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  const candidate = iso ? iso[1]! : us ? `${us[3]}-${us[1]}-${us[2]}` : parseIndonesianDate(text);
  return candidate !== null && isoDate.safeParse(candidate).success ? candidate : null;
}

function projectChange(value: unknown): Change {
  const trend = isRecord(value) ? value : {};
  const direction = trend.status === "up" || trend.status === "down" ? trend.status : null;
  return { percent: parsePercent(trend.value), direction };
}

function capStructuredRows<B extends { truncated: boolean; truncated_reason: string | null }, R>(
  base: B,
  rows: R[],
): B & { rows: R[] } {
  const capped = capRows(rows, STRUCTURED_MAX_CHARS, (kept) => ({ ...base, truncated: true, truncated_reason: TRUNCATED_REASON, rows: kept }));
  return capped.truncated
    ? { ...base, truncated: true, truncated_reason: TRUNCATED_REASON, rows: capped.rows }
    : { ...base, rows: capped.rows };
}

// ── Text ────────────────────────────────────────────────────────────────────

function rangeLabel(range: Range): string {
  return range.start_date === range.end_date ? indoDate(range.start_date) : `${indoDate(range.start_date)} – ${indoDate(range.end_date)}`;
}

function changeLabel(change: Change): string {
  if (change.percent === null || change.direction === null) return "";
  return ` (${change.direction === "up" ? "naik" : "turun"} ${formatQty(change.percent)}% dari periode sebelumnya)`;
}

function quantityLabel(quantity: number, unit: string): string {
  return unit ? `${formatQty(quantity)} ${unit}` : formatQty(quantity);
}

function dashboardText(d: DashboardData): string {
  const topPayment = d.payment_methods[0];
  return joinLines([
    `Penjualan ${rangeLabel(d.range)} (outlet ${d.outlet_id}), dibandingkan ${rangeLabel(d.comparison)}.`,
    d.kpis.transactions === 0 && "Tidak ada transaksi pada periode ini.",
    `Penjualan kotor: ${rupiah(d.kpis.gross_sales)}${changeLabel(d.changes.gross)}.`,
    `Laba kotor: ${rupiah(d.kpis.profit)}${changeLabel(d.changes.profit)}.`,
    `Transaksi: ${formatQty(d.kpis.transactions)}${changeLabel(d.changes.transactions)}; rata-rata ${rupiah(d.kpis.average_ticket)} per transaksi.`,
    `Produk terjual: ${formatQty(d.kpis.quantity)}${changeLabel(d.changes.quantity)}.`,
    topPayment && `Metode pembayaran teratas: ${topPayment.name} ${rupiah(topPayment.amount)} (${formatQty(topPayment.quantity)} transaksi).`,
    d.top_products.length > 0 &&
      `Produk terlaris: ${d.top_products
        .slice(0, 3)
        .map((p) => `${p.rank}. ${p.name} (${quantityLabel(p.quantity, p.unit)})`)
        .join(", ")}.`,
    `Sisa piutang (laporan Qasir): ${rupiah(d.receivable.total)} dari ${formatQty(d.receivable.customers)} pelanggan.`,
  ]);
}

function rankingText(d: RankingData): string {
  return joinLines([
    `Peringkat produk ${PRODUCT_ORDER_LABEL[d.order].toLowerCase()}, ${rangeLabel(d.range)} (outlet ${d.outlet_id}):`,
    d.rows.length === 0 && "Tidak ada penjualan produk pada periode ini.",
    ...d.rows
      .slice(0, TEXT_TOP_PRODUCTS)
      .map((p) => `${p.rank}. ${p.name}: ${quantityLabel(p.quantity, p.unit)}, ${rupiah(p.gross)}`),
    d.manual_transactions &&
      `Transaksi manual (tanpa produk): ${formatQty(d.manual_transactions.quantity)} item, ${rupiah(d.manual_transactions.gross)}.`,
    d.next_page !== null && `${d.rows.length} produk pertama dimuat; buka widget untuk melihat lebih banyak.`,
    d.truncated && d.truncated_reason,
  ]);
}

function rankingPageText(d: RankingPageData): string {
  const first = d.rows[0];
  const last = d.rows[d.rows.length - 1];
  return joinLines([
    first && last
      ? `Peringkat produk ${PRODUCT_ORDER_LABEL[d.order].toLowerCase()} halaman ${d.page}: peringkat ${first.rank}–${last.rank}.`
      : `Peringkat produk ${PRODUCT_ORDER_LABEL[d.order].toLowerCase()} halaman ${d.page}: tidak ada produk lagi.`,
    d.next_page !== null && `Halaman berikutnya: ${d.next_page}.`,
    d.truncated && d.truncated_reason,
  ]);
}

// ── Tools ───────────────────────────────────────────────────────────────────

export const salesDashboardTool: WidgetToolDef<typeof salesDashboardInput> = {
  name: "show_sales_dashboard",
  title: "Dasbor penjualan",
  description:
    "Open an interactive sales dashboard widget (penjualan) for a date range: gross sales, profit, transactions and average ticket with change vs the previous period of equal length, a daily trend chart, payment methods, top categories and products, and outstanding customer credit. Use it when the owner asks how sales went today, this week, this month or for any range up to 366 days. Dates are YYYY-MM-DD in Asia/Jakarta.",
  input: salesDashboardInput,
  maxRequests: 6,
  view: "penjualan",
  async run(input, ctx) {
    assertDateRange(input.start_date, input.end_date);
    const outletId = await ctx.outletId(input.outlet_id);
    const range: Range = { start_date: input.start_date, end_date: input.end_date };
    const comparison = previousRange(range.start_date, range.end_date);

    const [summaryRes, trendRes, paymentRes, categoriesRes, productsRes, installmentRes] = await Promise.all([
      ctx.request({ operationId: "reports.summaries.transaction", query: rangeQuery(outletId, range) }),
      ctx.request({
        operationId: "reports.sales.trend",
        query: {
          ...rangeQuery(outletId, range),
          trend_type: "sales",
          comparison_start_date: comparison.start_date,
          comparison_end_date: comparison.end_date,
        },
      }),
      ctx.request({
        operationId: "reports.summaries.paymentMethods",
        query: { ...rangeQuery(outletId, range), country_code: "ID", language_code: "id" },
      }),
      ctx.request(categoriesRequest(outletId, range, DASHBOARD_CATEGORIES)),
      ctx.request(productsRequest(outletId, range, "terlaris", 1, DASHBOARD_TOP_PRODUCTS)),
      ctx.request({
        operationId: "reports.summaries.installment",
        query: rangeQuery(outletId, { start_date: DEBT_SCAN_START_DATE, end_date: ctx.today }),
      }),
    ]);

    const summaryData = envelopeData(summaryRes, "reports.summaries.transaction");
    const summary = isRecord(summaryData.summary_sales) ? summaryData.summary_sales : {};
    const salesTrend = isRecord(summary.sales_trend) ? summary.sales_trend : {};
    const grossSales = toNumber(summary.total_gross_sales);
    const transactions = toNumber(summary.total_transaction);

    const trend = recordsAt(envelopeData(trendRes, "reports.sales.trend"), "data_trends").flatMap((point) => {
      const date = trendDate(point.date);
      if (date === null) return [];
      return [
        {
          date,
          amount: toNumber(point.amount),
          comparison_date: trendDate(point.comparison_date),
          comparison_amount: toNumberOrNull(point.comparison_amount),
        },
      ];
    });

    const paymentMethods = recordsAt(envelopeData(paymentRes, "reports.summaries.paymentMethods"), "payment_method")
      .map((row) => ({ name: toText(row.name), quantity: toNumber(row.quantity), amount: toNumber(row.amount) }))
      .sort((a, b) => b.amount - a.amount);

    const installment = envelopeData(installmentRes, "reports.summaries.installment");

    const structured: DashboardData = {
      view: "penjualan",
      ...ctx.meta(outletId),
      range,
      comparison,
      kpis: {
        sales_before_discount: toNumber(summary.sales),
        discount: toNumber(summary.discount),
        gross_sales: grossSales,
        profit: toNumber(summary.total_profit),
        capital: toNumber(summary.capital_price),
        tax: toNumber(summary.tax),
        transactions,
        quantity: toNumber(summary.total_quantity),
        average_ticket: transactions > 0 ? Math.round(grossSales / transactions) : 0,
      },
      changes: {
        gross: projectChange(salesTrend.gross),
        profit: projectChange(salesTrend.profit),
        transactions: projectChange(salesTrend.transaction),
        quantity: projectChange(salesTrend.quantity),
      },
      trend,
      payment_methods: paymentMethods,
      categories: projectCategories(categoriesRes, DASHBOARD_CATEGORIES),
      top_products: projectProducts(productsRes, 1, DASHBOARD_TOP_PRODUCTS).rows,
      receivable: { total: toNumber(installment.total_receivable), customers: toNumber(installment.total_customer) },
    };
    return { text: dashboardText(structured), structured };
  },
};

export const productRankingTool: WidgetToolDef<typeof productRankingInput> = {
  name: "show_product_ranking",
  title: "Peringkat produk",
  description:
    "Open an interactive product ranking widget (produk) for a date range: best-selling (terlaris) or least-selling (kurang_laris) products by quantity, or highest/lowest revenue (omzet_tertinggi/omzet_terendah), plus sales per category. Use it when the owner asks which products sell best or worst per day, week or month. Dates are YYYY-MM-DD in Asia/Jakarta; range at most 366 days.",
  input: productRankingInput,
  maxRequests: 2,
  view: "produk",
  async run(input, ctx) {
    assertDateRange(input.start_date, input.end_date);
    const outletId = await ctx.outletId(input.outlet_id);
    const range: Range = { start_date: input.start_date, end_date: input.end_date };
    const order: ProductOrder = input.order ?? "terlaris";

    const [productsRes, categoriesRes] = await Promise.all([
      ctx.request(productsRequest(outletId, range, order, 1, PAGE_SIZE.products)),
      ctx.request(categoriesRequest(outletId, range, PAGE_SIZE.categories)),
    ]);
    const products = projectProducts(productsRes, 1, PAGE_SIZE.products);

    const structured: RankingData = capStructuredRows(
      {
        view: "produk" as const,
        ...ctx.meta(outletId),
        range,
        order,
        categories: projectCategories(categoriesRes, PAGE_SIZE.categories),
        manual_transactions: products.manual,
        next_page: products.next,
      },
      products.rows,
    );
    return { text: rankingText(structured), structured };
  },
};

export const productRankingPageTool: WidgetToolDef<typeof productRankingPageInput> = {
  name: "product_ranking_page",
  title: "Halaman peringkat produk",
  description: "Widget helper: loads one more page (50 rows) of the product ranking shown in the produk widget.",
  input: productRankingPageInput,
  maxRequests: 1,
  async run(input, ctx) {
    assertDateRange(input.start_date, input.end_date);
    const outletId = await ctx.outletId(input.outlet_id);
    const range: Range = { start_date: input.start_date, end_date: input.end_date };
    const res = await ctx.request(productsRequest(outletId, range, input.order, input.page, PAGE_SIZE.products));
    const products = projectProducts(res, input.page, PAGE_SIZE.products);

    const structured: RankingPageData = capStructuredRows(
      { ...ctx.meta(outletId), order: input.order, page: input.page, next_page: products.next },
      products.rows,
    );
    return { text: rankingPageText(structured), structured };
  },
};

export const SALES_TOOLS: readonly AnyWidgetToolDef[] = [salesDashboardTool, productRankingTool, productRankingPageTool];
```

- [ ] **Step 4: Run the tests and types**

Run: `bun run test tests/unit/widgets-sales.test.ts && bun run check-types`
Expected: `Test Files  1 passed (1)`, `Tests  15 passed (15)`; `tsc` exits 0. (A `tool.show_sales_dashboard.error` / `tool.show_product_ranking.error` warn line on stderr is expected from the error-path tests.)

- [ ] **Step 5: Commit**

```bash
git add src/widgets/tools/sales.ts tests/unit/widgets-sales.test.ts
git commit -m "feat(widgets): sales dashboard and product ranking tools

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Stock tools (stok browser, pages, history, velocity)

**Files:**
- Create: `src/widgets/tools/stock.ts`
- Test: `tests/unit/widgets-stock.test.ts`

**Interfaces:**
- Consumes:
  - T1 `src/widgets/contract.ts`: `PAGE_SIZE`, `STOCK_MOVEMENT_TYPES`, `STRUCTURED_MAX_CHARS`, `VELOCITY_MAX_PAGES`, `VELOCITY_WINDOW_DAYS`, `stockBrowserInput`, `stockPageInput`, `stockHistoryInput`, `stockVelocityInput`, `stockBrowserData`, `stockPageData`, `stockHistoryData`, `stockVelocityData`, `stockMovementLabel`, `type ToolOutput`.
  - T1 `src/widgets/qasir-dates.ts`: `daysBetween`, `jakartaDateOf`, `parseQasirDateTime`. T1 `src/widgets/qasir-values.ts`: `isRecord`, `toNumber`, `toNumberOrNull`, `toText`.
  - T2 `src/widgets/tools/define.ts`: `WidgetToolDef<S>`, `AnyWidgetToolDef`, `ToolContext` (`ctx.outletId`, `ctx.request`, `ctx.meta`, `ctx.today`, `ctx.now`).
  - T2 `src/widgets/tools/shared.ts`: `capRows`, `envelopeData`, `formatQty`, `indoDate`, `isUpstream404`, `joinLines`, `nextPageOf`, `pageInfo`, `recordsAt`, `rupiah`.
  - T2 `tests/stubs/widget-harness.ts`: `callWidgetTool`, `envelope`, `type WidgetCall`; `type FixtureHandler` from `tests/stubs/codemode-harness.ts`.
  - `DispatchRequest` from `src/dispatcher/qasir-dispatcher.ts`; `AppError`, `ErrorCodes` from `src/errors/codes.ts`.
- Produces (`src/widgets/tools/stock.ts`):
  - `export const stockBrowserTool: WidgetToolDef<typeof stockBrowserInput>` (name `show_stock_browser`, view `stok`, maxRequests 1)
  - `export const stockPageTool: WidgetToolDef<typeof stockPageInput>` (name `stock_page`, app-only, maxRequests 1)
  - `export const stockHistoryTool: WidgetToolDef<typeof stockHistoryInput>` (name `stock_history`, app-only, maxRequests 1)
  - `export const stockVelocityTool: WidgetToolDef<typeof stockVelocityInput>` (name `stock_velocity`, app-only, maxRequests `VELOCITY_MAX_PAGES` = 5)
  - `export const STOCK_TOOLS: readonly AnyWidgetToolDef[]` in that order.

Projection rules this task implements (spec §2 and §4.2 item 3):
- `show_stock_browser` / `stock_page`: `inventories.stockTurnover` `{outlet_ids, page, count 50, sort "created_at", search?}` (the `search` key is omitted when absent).
  - An `UPSTREAM_ERROR "Upstream 404"` **with** a search term maps to `rows []`, `total_rows 0`, `next_page null`. Without a search it stays an error.
  - Row mapping: `id` → `inventory_id` (rows without a positive integer id are dropped), `product_name` → `name`, and `stock`, `price_sell`.
  - `last_sale_at`/`last_adjustment_at` = `parseQasirDateTime(latest_*_date)`. `days_since_*` is null when that date is empty, even though upstream then sends `"0"`. Otherwise it is the upstream `latest_*_till_now` day count, falling back to Jakarta days between the date and today when that count is not numeric.
  - `total_rows` = `pagination.total_result`; `next_page` = `nextPageOf(...)` (never above 500); rows are capped with `capRows` (`truncated_reason` `"Baris terakhir dipangkas karena hasil melebihi 250 KB."`).
- `stock_history`: `inventories.stockHistories` `path {inventory_id}`, query `{page, count 50, outlet_ids, type "sales,purchase,transfer,adjustment-plus,adjustment-minus,refund"}`.
  - Movement mapping: `opname` → `balance`, `notes` → `note`, `created_date` (Go UTC) → `at` ISO, `created_by.name` trimmed → `by` or null, and `sales_id` of `""`/`"0"` → null.
  - `product_name` loses the trailing `-` that single-variant items carry.
  - The text block never includes staff names or movement notes. Notes are free text typed by staff (refund and adjustment reasons) and can hold customer names or phone numbers, so `note` and `by` appear only in `structuredContent` for the widget.
- `stock_velocity`: reads the same operation with `count 100` (the registry maximum), pages 1..`VELOCITY_MAX_PAGES`.
  - The window starts at `now − 30 × 24 h`. Only `sales` (units sold) and `refund` (units returned) movements inside the window count.
  - It stops after a page that contains a movement older than the window, an empty page, or a page without `pagination.next`. If it runs out of pages first, `truncated` is true with `"Hanya 500 pergerakan terbaru yang dibaca; penjualan 30 hari bisa lebih tinggi."`.
  - `net_sold = sold − refunded`; `daily_rate = net_sold / 30` (0 when `net_sold ≤ 0`); `days_of_cover = max(0, stock) / daily_rate`, or null when `net_sold ≤ 0`.
  - `stock` comes from page 1; `oldest_scanned_at` is the oldest parsed movement time seen.

- [ ] **Step 1: Write the failing test**

`tests/unit/widgets-stock.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import type { DispatchRequest } from "../../src/dispatcher/qasir-dispatcher";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import {
  STRUCTURED_MAX_CHARS,
  stockBrowserData,
  stockHistoryData,
  stockPageData,
  stockVelocityData,
  type ToolOutput,
} from "../../src/widgets/contract";
import {
  STOCK_TOOLS,
  stockBrowserTool,
  stockHistoryTool,
  stockPageTool,
  stockVelocityTool,
} from "../../src/widgets/tools/stock";
import type { FixtureHandler } from "../stubs/codemode-harness";
import { callWidgetTool, envelope, type WidgetCall } from "../stubs/widget-harness";

// Harness clock: 2026-09-15T03:00:00Z = 10:00 in Jakarta, so "today" is 2026-09-15
// and the 30-day velocity window starts at 2026-08-16T03:00:00.000Z.
const GENERATED_AT = "2026-09-15T03:00:00.000Z";
const META = { outlet_id: "645203", generated_at: GENERATED_AT, truncated: false, truncated_reason: null };
const ALL_TYPES = "sales,purchase,transfer,adjustment-plus,adjustment-minus,refund";

function expectContract<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.parse(value);
  // Parsing strips unknown keys, so equality proves the tool emits contract fields only.
  expect(parsed).toEqual(value);
  return parsed;
}

function requests(call: WidgetCall): DispatchRequest[] {
  expect(call.dispatcher.calls.every((c) => c.opts?.allowMutation === undefined)).toBe(true);
  return call.dispatcher.calls.map((c) => c.req);
}

function upstream404(): never {
  throw new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream 404");
}

// ── Synthetic upstream payloads (shapes per spec §2; no real names) ─────────

const VARIANT_SOLD = {
  id: 25952218,
  product_name: "Oli Mesin A - 1 Liter",
  stock: 12,
  price_sell: 80_000,
  latest_sales_date: "2026-09-12T06:27:33.000Z",
  latest_adjustment_date: "2022-01-21T14:53:44.893348Z",
  latest_sales_till_now: "3",
  latest_adjustment_till_now: "1697",
};
const VARIANT_NEVER_SOLD = {
  id: 25952219,
  product_name: "Oli Mesin A - 4 Liter",
  stock: 0,
  price_sell: "300000",
  latest_sales_date: "",
  latest_adjustment_date: "2026-09-01T02:00:00Z",
  latest_sales_till_now: "0",
  latest_adjustment_till_now: "",
};
const VARIANT_WITHOUT_ID = { ...VARIANT_SOLD, id: "bukan-id" };

const ROW_SOLD = {
  inventory_id: 25952218,
  name: "Oli Mesin A - 1 Liter",
  stock: 12,
  price_sell: 80_000,
  last_sale_at: "2026-09-12T06:27:33.000Z",
  days_since_sale: 3,
  last_adjustment_at: "2022-01-21T14:53:44.893Z",
  days_since_adjustment: 1697,
};
const ROW_NEVER_SOLD = {
  inventory_id: 25952219,
  name: "Oli Mesin A - 4 Liter",
  stock: 0,
  price_sell: 300_000,
  last_sale_at: null,
  days_since_sale: null,
  last_adjustment_at: "2026-09-01T02:00:00.000Z",
  // No upstream day count: computed from the Jakarta date (1 Sep) to today (15 Sep).
  days_since_adjustment: 14,
};

function plainVariant(i: number) {
  return {
    id: 30_000_000 + i,
    product_name: `Produk Stok ${i}`,
    stock: i,
    price_sell: 1_000 * i,
    latest_sales_date: "",
    latest_adjustment_date: "",
    latest_sales_till_now: "0",
    latest_adjustment_till_now: "0",
  };
}

function plainRow(i: number) {
  return {
    inventory_id: 30_000_000 + i,
    name: `Produk Stok ${i}`,
    stock: i,
    price_sell: 1_000 * i,
    last_sale_at: null,
    days_since_sale: null,
    last_adjustment_at: null,
    days_since_adjustment: null,
  };
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, k) => from + k);
}

function movement(type: string, quantity: number, createdDate: string, extra: Record<string, unknown> = {}) {
  return {
    id: `01TESTMOVEMENT${type}${createdDate}`,
    opname: 10,
    quantity,
    notes: "",
    type,
    created_date: createdDate,
    created_by: { id: "", name: "" },
    sales_id: "",
    is_saved_transaction: false,
    is_deleted_saved_transaction: false,
    ...extra,
  };
}

function historyPage(stockHistories: unknown[], next: boolean, stock = 29) {
  return envelope(
    { id: "25950360", product_name: "Produk Velocity-", stock, stock_histories: stockHistories, track_stock: true },
    { current_page: 1, page_size: 100, ...(next ? { next: "/api/v5/inventories/25950360/stock-histories?page=2" } : {}) },
  );
}

// ── show_stock_browser ──────────────────────────────────────────────────────

describe("show_stock_browser", () => {
  it("searches page 1 and projects last-touch dates and day counts", async () => {
    const call = await callWidgetTool(
      stockBrowserTool,
      { search: "  Oli Mesin  " },
      {
        handlers: {
          "inventories.stockTurnover": () =>
            envelope(
              { variants: [VARIANT_SOLD, VARIANT_NEVER_SOLD, VARIANT_WITHOUT_ID] },
              { current_page: 1, page_size: 50, total_page: 1, total_result: 2 },
            ),
        },
      },
    );

    expect(call.error).toBeUndefined();
    expect(requests(call)).toEqual([
      {
        operationId: "inventories.stockTurnover",
        query: { outlet_ids: "645203", page: 1, count: 50, sort: "created_at", search: "Oli Mesin" },
      },
    ]);
    const data = expectContract(stockBrowserData, call.structured);
    const expected: ToolOutput<"show_stock_browser"> = {
      view: "stok",
      ...META,
      search: "Oli Mesin",
      rows: [ROW_SOLD, ROW_NEVER_SOLD],
      total_rows: 2,
      next_page: null,
    };
    expect(data).toEqual(expected);
    expect(call.text).toBe(
      [
        'Stok untuk pencarian "Oli Mesin" (outlet 645203): 2 varian.',
        "- Oli Mesin A - 1 Liter: stok 12, Rp 80.000, terakhir terjual 3 hari lalu",
        "- Oli Mesin A - 4 Liter: stok 0, Rp 300.000, belum pernah terjual",
      ].join("\n"),
    );
  });

  it("omits search when none is given and offers the next page", async () => {
    const call = await callWidgetTool(
      stockBrowserTool,
      {},
      {
        handlers: {
          "inventories.stockTurnover": () =>
            envelope(
              { variants: range(1, 50).map(plainVariant) },
              { current_page: 1, page_size: 50, total_page: 276, total_result: 13_784, next: "/api/v5/inventories/stock-turnover?page=2" },
            ),
        },
      },
    );

    expect(requests(call)).toEqual([
      { operationId: "inventories.stockTurnover", query: { outlet_ids: "645203", page: 1, count: 50, sort: "created_at" } },
    ]);
    const data = expectContract(stockBrowserData, call.structured);
    expect(data).toEqual({
      view: "stok",
      ...META,
      search: null,
      rows: range(1, 50).map(plainRow),
      total_rows: 13_784,
      next_page: 2,
    });
    expect(call.text).toContain("Stok outlet 645203: 13.784 varian.");
    expect(call.text).toContain("- Produk Stok 10: stok 10, Rp 10.000, belum pernah terjual");
    expect(call.text).not.toContain("Produk Stok 11:");
    expect(call.text).toContain("50 varian pertama dimuat");
  });

  it("maps a no-match search (upstream 404) to an empty list", async () => {
    const call = await callWidgetTool(stockBrowserTool, { search: "Tidak Ada" }, { handlers: { "inventories.stockTurnover": upstream404 } });

    expect(call.error).toBeUndefined();
    expect(requests(call)[0]?.query).toMatchObject({ search: "Tidak Ada" });
    expect(expectContract(stockBrowserData, call.structured)).toEqual({
      view: "stok",
      ...META,
      search: "Tidak Ada",
      rows: [],
      total_rows: 0,
      next_page: null,
    });
    expect(call.text).toBe('Stok untuk pencarian "Tidak Ada" (outlet 645203): 0 varian.\nTidak ada produk yang cocok dengan "Tidak Ada".');
  });

  it("keeps a 404 without search as an upstream error", async () => {
    const call = await callWidgetTool(stockBrowserTool, {}, { handlers: { "inventories.stockTurnover": upstream404 } });
    expect(call.result.isError).toBe(true);
    expect(call.error).toEqual({ code: "UPSTREAM_ERROR", message: "Upstream 404" });
  });
});

// ── stock_page ──────────────────────────────────────────────────────────────

describe("stock_page", () => {
  it("fetches the requested page with the same search", async () => {
    const call = await callWidgetTool(
      stockPageTool,
      { search: "Oli", page: 2, outlet_id: "777" },
      {
        handlers: {
          "inventories.stockTurnover": () =>
            envelope(
              { variants: [VARIANT_SOLD, VARIANT_NEVER_SOLD] },
              { current_page: 2, page_size: 50, total_page: 3, total_result: 102, next: "/api/v5/inventories/stock-turnover?page=3" },
            ),
        },
      },
    );

    expect(requests(call)).toEqual([
      { operationId: "inventories.stockTurnover", query: { outlet_ids: "777", page: 2, count: 50, sort: "created_at", search: "Oli" } },
    ]);
    const expected: ToolOutput<"stock_page"> = {
      ...META,
      outlet_id: "777",
      search: "Oli",
      page: 2,
      rows: [ROW_SOLD, ROW_NEVER_SOLD],
      next_page: 3,
    };
    expect(expectContract(stockPageData, call.structured)).toEqual(expected);
    expect(call.text).toBe('Stok halaman 2 untuk "Oli": 2 varian.\nHalaman berikutnya: 3.');
  });

  it("maps a 404 on a later search page to an empty page", async () => {
    const call = await callWidgetTool(stockPageTool, { search: "Oli", page: 3 }, { handlers: { "inventories.stockTurnover": upstream404 } });
    expect(expectContract(stockPageData, call.structured)).toEqual({ ...META, search: "Oli", page: 3, rows: [], next_page: null });
  });

  it("trims rows from the tail when the structured result would exceed 250 KB", async () => {
    const huge = range(1, 50).map((i) => ({ ...plainVariant(i), product_name: `Produk ${i} ${"N".repeat(6_000)}` }));
    const call = await callWidgetTool(stockPageTool, { page: 1 }, { handlers: { "inventories.stockTurnover": () => envelope({ variants: huge }) } });

    expect(call.error).toBeUndefined();
    const data = expectContract(stockPageData, call.structured);
    expect(JSON.stringify(call.structured).length).toBeLessThanOrEqual(STRUCTURED_MAX_CHARS);
    expect(data.truncated).toBe(true);
    expect(data.truncated_reason).toBe("Baris terakhir dipangkas karena hasil melebihi 250 KB.");
    expect(data.rows.length).toBeGreaterThan(0);
    expect(data.rows.length).toBeLessThan(50);
    expect(data.rows.map((r) => r.inventory_id)).toEqual(range(1, data.rows.length).map((i) => 30_000_000 + i));
    // No pagination block and a full page: the next page is still offered.
    expect(data.next_page).toBe(2);
  });
});

// ── stock_history ───────────────────────────────────────────────────────────

describe("stock_history", () => {
  it("reads one page of all movement types and projects each movement", async () => {
    const call = await callWidgetTool(
      stockHistoryTool,
      { inventory_id: 25950360, page: 2 },
      {
        handlers: {
          "inventories.stockHistories": () =>
            envelope(
              {
                id: "25950360",
                product_name: "Filter Udara X-",
                stock: 3,
                track_stock: true,
                stock_histories: [
                  movement("sales", -1, "2026-09-07 01:02:14.608837 +0000 +0000", {
                    id: "01TESTMOVEMENT000000000001",
                    opname: 3,
                    notes: "INV0001A",
                    created_by: { id: "11", name: "Staf Contoh   " },
                    sales_id: "1000000001",
                  }),
                  movement("refund", 1, "2026-09-06 23:30:00.000000 +0000 +0000", {
                    id: "01TESTMOVEMENT000000000002",
                    opname: 4,
                    notes: "Retur Pelanggan A 0800-0000-0001",
                  }),
                  movement("adjustment-plus", 5, "", {
                    id: "01TESTMOVEMENT000000000003",
                    opname: 3,
                    notes: "Opname bulanan",
                    created_by: {},
                    sales_id: "0",
                  }),
                ],
              },
              { current_page: 2, page_size: 50, total_page: 3, total_result: 103, next: "/api/v5/inventories/25950360/stock-histories?page=3" },
            ),
        },
      },
    );

    expect(requests(call)).toEqual([
      {
        operationId: "inventories.stockHistories",
        path: { inventory_id: 25950360 },
        query: { page: 2, count: 50, outlet_ids: "645203", type: ALL_TYPES },
      },
    ]);
    const expected: ToolOutput<"stock_history"> = {
      ...META,
      inventory_id: 25950360,
      product_name: "Filter Udara X",
      stock: 3,
      page: 2,
      movements: [
        {
          id: "01TESTMOVEMENT000000000001",
          at: "2026-09-07T01:02:14.608Z",
          type: "sales",
          type_label: "Penjualan",
          quantity: -1,
          balance: 3,
          note: "INV0001A",
          by: "Staf Contoh",
          sales_id: "1000000001",
        },
        {
          id: "01TESTMOVEMENT000000000002",
          at: "2026-09-06T23:30:00.000Z",
          type: "refund",
          type_label: "Refund",
          quantity: 1,
          balance: 4,
          note: "Retur Pelanggan A 0800-0000-0001",
          by: null,
          sales_id: null,
        },
        {
          id: "01TESTMOVEMENT000000000003",
          at: null,
          type: "adjustment-plus",
          type_label: "Penyesuaian +",
          quantity: 5,
          balance: 3,
          note: "Opname bulanan",
          by: null,
          sales_id: null,
        },
      ],
      next_page: 3,
    };
    expect(expectContract(stockHistoryData, call.structured)).toEqual(expected);
    expect(call.text).toBe(
      [
        "Riwayat stok Filter Udara X (stok saat ini 3), halaman 2: 3 pergerakan.",
        "- 7 Sep 2026: Penjualan -1, saldo 3",
        // 23:30 UTC on 6 Sep is 06:30 on 7 Sep in Jakarta.
        "- 7 Sep 2026: Refund +1, saldo 4",
        "- tanpa tanggal: Penyesuaian + +5, saldo 3",
        "Halaman berikutnya: 3.",
      ].join("\n"),
    );
    // Staff names and free-text notes (which can hold customer names or phones) stay out of the text block.
    expect(call.text).not.toContain("Staf Contoh");
    expect(call.text).not.toContain("Pelanggan A");
    expect(call.text).not.toContain("0800-0000-0001");
    expect(call.text).not.toContain("Opname bulanan");
  });

  it("rejects a non-positive inventory id at the input schema", async () => {
    await expect(callWidgetTool(stockHistoryTool, { inventory_id: 0, page: 1 }, { handlers: {} })).rejects.toThrow();
  });
});

// ── stock_velocity ──────────────────────────────────────────────────────────

describe("stock_velocity", () => {
  it("pages histories until a movement predates the 30-day window", async () => {
    const recent = "2026-09-10 01:00:00.000000 +0000 +0000";
    const page1 = [
      ...range(1, 90).map(() => movement("sales", -1, recent)),
      ...range(1, 5).map(() => movement("refund", 1, recent)),
      ...range(1, 5).map(() => movement("purchase", 10, recent)),
    ];
    const page2 = [
      movement("sales", -2, "2026-08-20 10:00:00.000000 +0000 +0000"),
      movement("sales", -5, "2026-08-16 02:59:59.000000 +0000 +0000"), // one second before the window
      movement("adjustment-plus", 3, "2026-08-01 00:00:00.000000 +0000 +0000"),
    ];
    const handler: FixtureHandler = (req) => (req.query?.page === 1 ? historyPage(page1, true) : historyPage(page2, true));
    const call = await callWidgetTool(stockVelocityTool, { inventory_id: 25950360 }, { handlers: { "inventories.stockHistories": handler } });

    expect(call.error).toBeUndefined();
    expect(requests(call)).toEqual(
      [1, 2].map((page) => ({
        operationId: "inventories.stockHistories",
        path: { inventory_id: 25950360 },
        query: { page, count: 100, outlet_ids: "645203", type: ALL_TYPES },
      })),
    );
    const data = expectContract(stockVelocityData, call.structured);
    expect(data).toEqual({
      ...META,
      inventory_id: 25950360,
      stock: 29,
      window_days: 30,
      sold: 92,
      refunded: 5,
      net_sold: 87,
      daily_rate: expect.closeTo(2.9, 10),
      days_of_cover: expect.closeTo(10, 10),
      oldest_scanned_at: "2026-08-01T00:00:00.000Z",
    });
    expect(call.text).toBe(
      [
        "Kecepatan jual Produk Velocity, 30 hari terakhir: terjual 92, refund 5, bersih 87 (2,9 per hari).",
        "Stok saat ini 29; perkiraan habis dalam 10 hari.",
      ].join("\n"),
    );
  });

  it("stops at VELOCITY_MAX_PAGES and flags the result as truncated", async () => {
    const recent = "2026-09-14 01:00:00.000000 +0000 +0000";
    const full = range(1, 100).map(() => movement("sales", -1, recent));
    const call = await callWidgetTool(
      stockVelocityTool,
      { inventory_id: 25950360 },
      { handlers: { "inventories.stockHistories": () => historyPage(full, true, 50) } },
    );

    expect(call.error).toBeUndefined();
    expect(requests(call).map((r) => r.query?.page)).toEqual([1, 2, 3, 4, 5]);
    const data = expectContract(stockVelocityData, call.structured);
    expect(data).toMatchObject({
      truncated: true,
      truncated_reason: "Hanya 500 pergerakan terbaru yang dibaca; penjualan 30 hari bisa lebih tinggi.",
      sold: 500,
      refunded: 0,
      net_sold: 500,
      stock: 50,
      oldest_scanned_at: "2026-09-14T01:00:00.000Z",
    });
    expect(data.days_of_cover).toBeCloseTo(3, 10);
    expect(call.text).toContain("Hanya 500 pergerakan terbaru yang dibaca");
  });

  it("returns no days of cover when refunds cancel out sales", async () => {
    const recent = "2026-09-14 01:00:00.000000 +0000 +0000";
    const call = await callWidgetTool(
      stockVelocityTool,
      { inventory_id: 25950360, outlet_id: "777" },
      {
        handlers: {
          "inventories.stockHistories": () =>
            historyPage([movement("refund", 2, recent), movement("sales", -1, recent), movement("transfer", -4, recent)], false, 7),
        },
      },
    );

    expect(requests(call)).toHaveLength(1);
    expect(requests(call)[0]?.query?.outlet_ids).toBe("777");
    expect(expectContract(stockVelocityData, call.structured)).toEqual({
      ...META,
      outlet_id: "777",
      inventory_id: 25950360,
      stock: 7,
      window_days: 30,
      sold: 1,
      refunded: 2,
      net_sold: -1,
      daily_rate: 0,
      days_of_cover: null,
      oldest_scanned_at: "2026-09-14T01:00:00.000Z",
    });
    expect(call.text).toContain("Stok saat ini 7; tanpa penjualan bersih, perkiraan habis tidak bisa dihitung.");
  });

  it("handles an item without any movements", async () => {
    const call = await callWidgetTool(
      stockVelocityTool,
      { inventory_id: 25950360 },
      { handlers: { "inventories.stockHistories": () => historyPage([], false, 4) } },
    );
    expect(requests(call)).toHaveLength(1);
    const data = expectContract(stockVelocityData, call.structured);
    expect(data).toMatchObject({ sold: 0, refunded: 0, net_sold: 0, daily_rate: 0, days_of_cover: null, oldest_scanned_at: null, truncated: false });
  });
});

// ── Registration metadata ───────────────────────────────────────────────────

describe("STOCK_TOOLS", () => {
  it("declares names, budgets, views and description rules", () => {
    expect(STOCK_TOOLS.map((t) => [t.name, t.maxRequests, t.view])).toEqual([
      ["show_stock_browser", 1, "stok"],
      ["stock_page", 1, undefined],
      ["stock_history", 1, undefined],
      ["stock_velocity", 5, undefined],
    ]);
    for (const tool of STOCK_TOOLS) {
      if (tool.view) {
        expect(tool.description.startsWith("Open an interactive")).toBe(true);
        expect(tool.description.length).toBeLessThanOrEqual(600);
        expect(tool.description).toContain("search");
      } else {
        expect(tool.description.startsWith("Widget helper:")).toBe(true);
        expect(tool.description.length).toBeLessThanOrEqual(300);
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test tests/unit/widgets-stock.test.ts`
Expected: FAIL with `Error: Cannot find module '../../src/widgets/tools/stock' imported from .../tests/unit/widgets-stock.test.ts`.

- [ ] **Step 3: Implement `src/widgets/tools/stock.ts`**

```ts
import type { DispatchRequest } from "../../dispatcher/qasir-dispatcher";
import {
  PAGE_SIZE,
  STOCK_MOVEMENT_TYPES,
  STRUCTURED_MAX_CHARS,
  VELOCITY_MAX_PAGES,
  VELOCITY_WINDOW_DAYS,
  stockBrowserInput,
  stockHistoryInput,
  stockMovementLabel,
  stockPageInput,
  stockVelocityInput,
  type ToolOutput,
} from "../contract";
import { daysBetween, jakartaDateOf, parseQasirDateTime } from "../qasir-dates";
import { isRecord, toNumber, toNumberOrNull, toText } from "../qasir-values";
import type { AnyWidgetToolDef, ToolContext, WidgetToolDef } from "./define";
import {
  capRows,
  envelopeData,
  formatQty,
  indoDate,
  isUpstream404,
  joinLines,
  nextPageOf,
  pageInfo,
  recordsAt,
  rupiah,
} from "./shared";

type BrowserData = ToolOutput<"show_stock_browser">;
type StockPageData = ToolOutput<"stock_page">;
type HistoryData = ToolOutput<"stock_history">;
type VelocityData = ToolOutput<"stock_velocity">;
type StockRow = BrowserData["rows"][number];
type Movement = HistoryData["movements"][number];

const DAY_MS = 86_400_000;
/** stockTurnover requires a sort; other values are accepted but do not reorder. */
const TURNOVER_SORT = "created_at";
const HISTORY_TYPES = STOCK_MOVEMENT_TYPES.join(",");
/** Largest page size the registry allows; velocity reads up to VELOCITY_MAX_PAGES of these. */
const VELOCITY_PAGE_SIZE = 100;
const TEXT_ITEMS = 10;
const TRUNCATED_REASON = "Baris terakhir dipangkas karena hasil melebihi 250 KB.";

// ── Upstream requests (queries match src/registry/ops/catalog.ts) ───────────

function turnoverRequest(outletId: string, page: number, search: string | undefined): DispatchRequest {
  return {
    operationId: "inventories.stockTurnover",
    query: { outlet_ids: outletId, page, count: PAGE_SIZE.stock, sort: TURNOVER_SORT, ...(search ? { search } : {}) },
  };
}

function historyRequest(outletId: string, inventoryId: number, page: number, count: number): DispatchRequest {
  return {
    operationId: "inventories.stockHistories",
    path: { inventory_id: inventoryId },
    query: { page, count, outlet_ids: outletId, type: HISTORY_TYPES },
  };
}

// ── Projections ─────────────────────────────────────────────────────────────

/** Days since a last-touch date: null without a date; upstream day count, else computed in Jakarta. */
function daysSince(at: string | null, tillNow: unknown, today: string): number | null {
  if (at === null) return null;
  const upstream = toNumberOrNull(tillNow);
  if (upstream !== null && upstream >= 0) return upstream;
  return Math.max(0, daysBetween(jakartaDateOf(at), today));
}

function projectStockRow(variant: Record<string, unknown>, today: string): StockRow | null {
  const id = toNumberOrNull(variant.id);
  if (id === null || !Number.isSafeInteger(id) || id <= 0) return null;
  const lastSale = parseQasirDateTime(variant.latest_sales_date);
  const lastAdjustment = parseQasirDateTime(variant.latest_adjustment_date);
  return {
    inventory_id: id,
    name: toText(variant.product_name),
    stock: toNumber(variant.stock),
    price_sell: toNumber(variant.price_sell),
    last_sale_at: lastSale,
    days_since_sale: daysSince(lastSale, variant.latest_sales_till_now, today),
    last_adjustment_at: lastAdjustment,
    days_since_adjustment: daysSince(lastAdjustment, variant.latest_adjustment_till_now, today),
  };
}

interface StockPage {
  rows: StockRow[];
  totalRows: number | null;
  next: number | null;
}

async function fetchStockPage(ctx: ToolContext, outletId: string, page: number, search: string | undefined): Promise<StockPage> {
  let res: unknown;
  try {
    res = await ctx.request(turnoverRequest(outletId, page, search));
  } catch (err) {
    // A search without matches comes back as upstream 404.
    if (search && isUpstream404(err)) return { rows: [], totalRows: 0, next: null };
    throw err;
  }
  const variants = recordsAt(envelopeData(res, "inventories.stockTurnover"), "variants");
  return {
    rows: variants.flatMap((variant) => {
      const row = projectStockRow(variant, ctx.today);
      return row ? [row] : [];
    }),
    totalRows: pageInfo(res)?.totalResult ?? null,
    next: nextPageOf(res, page, variants.length, PAGE_SIZE.stock),
  };
}

function projectMovement(row: Record<string, unknown>): Movement {
  const type = toText(row.type);
  const salesId = toText(row.sales_id);
  const by = isRecord(row.created_by) ? toText(row.created_by.name) : "";
  return {
    id: toText(row.id),
    at: parseQasirDateTime(row.created_date),
    type,
    type_label: stockMovementLabel(type),
    quantity: toNumber(row.quantity),
    balance: toNumber(row.opname),
    note: toText(row.notes),
    by: by || null,
    sales_id: salesId && salesId !== "0" ? salesId : null,
  };
}

/** stockHistories names single-variant items "Produk-"; drop the dangling separator. */
function historyProductName(data: Record<string, unknown>): string {
  return toText(data.product_name).replace(/-+$/, "").trim();
}

function capStructuredRows<B extends { truncated: boolean; truncated_reason: string | null }, R>(
  base: B,
  rows: R[],
): B & { rows: R[] } {
  const capped = capRows(rows, STRUCTURED_MAX_CHARS, (kept) => ({ ...base, truncated: true, truncated_reason: TRUNCATED_REASON, rows: kept }));
  return capped.truncated
    ? { ...base, truncated: true, truncated_reason: TRUNCATED_REASON, rows: capped.rows }
    : { ...base, rows: capped.rows };
}

// ── Text ────────────────────────────────────────────────────────────────────

function daysAgo(days: number): string {
  if (days === 0) return "hari ini";
  if (days === 1) return "kemarin";
  return `${formatQty(days)} hari lalu`;
}

function stockLine(row: StockRow): string {
  const sale = row.days_since_sale === null ? "belum pernah terjual" : `terakhir terjual ${daysAgo(row.days_since_sale)}`;
  return `- ${row.name}: stok ${formatQty(row.stock)}, ${rupiah(row.price_sell)}, ${sale}`;
}

function browserText(d: BrowserData): string {
  const hits = d.total_rows ?? d.rows.length;
  const header = d.search === null ? `Stok outlet ${d.outlet_id}: ${formatQty(hits)} varian.` : `Stok untuk pencarian "${d.search}" (outlet ${d.outlet_id}): ${formatQty(hits)} varian.`;
  return joinLines([
    header,
    d.rows.length === 0 && (d.search === null ? "Tidak ada produk." : `Tidak ada produk yang cocok dengan "${d.search}".`),
    ...d.rows.slice(0, TEXT_ITEMS).map(stockLine),
    d.next_page !== null && `${d.rows.length} varian pertama dimuat; buka widget untuk melihat lebih banyak.`,
    d.truncated && d.truncated_reason,
  ]);
}

function stockPageText(d: StockPageData): string {
  return joinLines([
    `Stok halaman ${d.page}${d.search === null ? "" : ` untuk "${d.search}"`}: ${d.rows.length} varian.`,
    d.next_page !== null && `Halaman berikutnya: ${d.next_page}.`,
    d.truncated && d.truncated_reason,
  ]);
}

/** Notes are staff free text (may hold customer names or phones): widget only, never in the text block. */
function movementLine(m: Movement): string {
  const when = m.at === null ? "tanpa tanggal" : indoDate(jakartaDateOf(m.at));
  const qty = m.quantity > 0 ? `+${formatQty(m.quantity)}` : formatQty(m.quantity);
  return `- ${when}: ${m.type_label} ${qty}, saldo ${formatQty(m.balance)}`;
}

function historyText(d: HistoryData): string {
  return joinLines([
    `Riwayat stok ${d.product_name || `item ${d.inventory_id}`} (stok saat ini ${formatQty(d.stock)}), halaman ${d.page}: ${d.movements.length} pergerakan.`,
    ...d.movements.slice(0, TEXT_ITEMS).map(movementLine),
    d.next_page !== null && `Halaman berikutnya: ${d.next_page}.`,
  ]);
}

function velocityText(d: VelocityData, productName: string): string {
  return joinLines([
    `Kecepatan jual ${productName || `item ${d.inventory_id}`}, ${d.window_days} hari terakhir: terjual ${formatQty(d.sold)}, refund ${formatQty(d.refunded)}, bersih ${formatQty(d.net_sold)} (${formatQty(d.daily_rate)} per hari).`,
    d.days_of_cover === null
      ? `Stok saat ini ${formatQty(d.stock)}; tanpa penjualan bersih, perkiraan habis tidak bisa dihitung.`
      : `Stok saat ini ${formatQty(d.stock)}; perkiraan habis dalam ${formatQty(Math.round(d.days_of_cover))} hari.`,
    d.truncated && d.truncated_reason,
  ]);
}

// ── Tools ───────────────────────────────────────────────────────────────────

export const stockBrowserTool: WidgetToolDef<typeof stockBrowserInput> = {
  name: "show_stock_browser",
  title: "Stok produk",
  description:
    "Open an interactive stock browser widget (stok): on-hand stock, sell price, days since last sale and since last stock adjustment per variant, with movement history and 30-day sales velocity per item. Use it when the owner asks about stock levels, slow movers or when an item was last counted. Pass search whenever the user names a product; without it the first load takes about 15 s.",
  input: stockBrowserInput,
  maxRequests: 1,
  view: "stok",
  async run(input, ctx) {
    const outletId = await ctx.outletId(input.outlet_id);
    const page = await fetchStockPage(ctx, outletId, 1, input.search);
    const structured: BrowserData = capStructuredRows(
      { view: "stok" as const, ...ctx.meta(outletId), search: input.search ?? null, total_rows: page.totalRows, next_page: page.next },
      page.rows,
    );
    return { text: browserText(structured), structured };
  },
};

export const stockPageTool: WidgetToolDef<typeof stockPageInput> = {
  name: "stock_page",
  title: "Halaman stok",
  description: "Widget helper: loads one more page (50 variants) of the stock list shown in the stok widget.",
  input: stockPageInput,
  maxRequests: 1,
  async run(input, ctx) {
    const outletId = await ctx.outletId(input.outlet_id);
    const page = await fetchStockPage(ctx, outletId, input.page, input.search);
    const structured: StockPageData = capStructuredRows(
      { ...ctx.meta(outletId), search: input.search ?? null, page: input.page, next_page: page.next },
      page.rows,
    );
    return { text: stockPageText(structured), structured };
  },
};

export const stockHistoryTool: WidgetToolDef<typeof stockHistoryInput> = {
  name: "stock_history",
  title: "Riwayat stok",
  description: "Widget helper: loads one page (50 rows) of stock movements for one inventory item in the stok widget.",
  input: stockHistoryInput,
  maxRequests: 1,
  async run(input, ctx) {
    const outletId = await ctx.outletId(input.outlet_id);
    const res = await ctx.request(historyRequest(outletId, input.inventory_id, input.page, PAGE_SIZE.stockHistory));
    const data = envelopeData(res, "inventories.stockHistories");
    const raw = recordsAt(data, "stock_histories");
    const base = {
      ...ctx.meta(outletId),
      inventory_id: input.inventory_id,
      product_name: historyProductName(data),
      stock: toNumber(data.stock),
      page: input.page,
      next_page: nextPageOf(res, input.page, raw.length, PAGE_SIZE.stockHistory),
    };
    const movements = raw.map(projectMovement);
    const capped = capRows(movements, STRUCTURED_MAX_CHARS, (kept) => ({ ...base, truncated: true, truncated_reason: TRUNCATED_REASON, movements: kept }));
    const structured: HistoryData = capped.truncated
      ? { ...base, truncated: true, truncated_reason: TRUNCATED_REASON, movements: capped.rows }
      : { ...base, movements };
    return { text: historyText(structured), structured };
  },
};

export const stockVelocityTool: WidgetToolDef<typeof stockVelocityInput> = {
  name: "stock_velocity",
  title: "Kecepatan jual",
  description: "Widget helper: net units sold in the last 30 days and estimated days of cover for one inventory item in the stok widget.",
  input: stockVelocityInput,
  maxRequests: VELOCITY_MAX_PAGES,
  async run(input, ctx) {
    const outletId = await ctx.outletId(input.outlet_id);
    const cutoff = new Date(ctx.now.getTime() - VELOCITY_WINDOW_DAYS * DAY_MS).toISOString();
    let stock = 0;
    let productName = "";
    let sold = 0;
    let refunded = 0;
    let oldest: string | null = null;
    let complete = false;

    for (let page = 1; page <= VELOCITY_MAX_PAGES && !complete; page++) {
      const res = await ctx.request(historyRequest(outletId, input.inventory_id, page, VELOCITY_PAGE_SIZE));
      const data = envelopeData(res, "inventories.stockHistories");
      if (page === 1) {
        stock = toNumber(data.stock);
        productName = historyProductName(data);
      }
      const rows = recordsAt(data, "stock_histories");
      for (const row of rows) {
        const at = parseQasirDateTime(row.created_date);
        if (at === null) continue;
        if (oldest === null || at < oldest) oldest = at;
        // Histories are newest first: one movement before the window means the window is fully read.
        if (at < cutoff) {
          complete = true;
          continue;
        }
        const type = toText(row.type);
        if (type === "sales") sold += Math.abs(toNumber(row.quantity));
        else if (type === "refund") refunded += Math.abs(toNumber(row.quantity));
      }
      if (rows.length === 0 || nextPageOf(res, page, rows.length, VELOCITY_PAGE_SIZE) === null) complete = true;
    }

    const netSold = sold - refunded;
    const dailyRate = netSold > 0 ? netSold / VELOCITY_WINDOW_DAYS : 0;
    const structured: VelocityData = {
      ...ctx.meta(outletId),
      ...(complete
        ? {}
        : {
            truncated: true,
            truncated_reason: `Hanya ${VELOCITY_MAX_PAGES * VELOCITY_PAGE_SIZE} pergerakan terbaru yang dibaca; penjualan 30 hari bisa lebih tinggi.`,
          }),
      inventory_id: input.inventory_id,
      stock,
      window_days: VELOCITY_WINDOW_DAYS,
      sold,
      refunded,
      net_sold: netSold,
      daily_rate: dailyRate,
      days_of_cover: netSold > 0 ? Math.max(0, stock) / dailyRate : null,
      oldest_scanned_at: oldest,
    };
    return { text: velocityText(structured, productName), structured };
  },
};

export const STOCK_TOOLS: readonly AnyWidgetToolDef[] = [stockBrowserTool, stockPageTool, stockHistoryTool, stockVelocityTool];
```

- [ ] **Step 4: Run the tests and types**

Run: `bun run test tests/unit/widgets-stock.test.ts && bun run check-types`
Expected: `Test Files  1 passed (1)`, `Tests  14 passed (14)`; `tsc` exits 0. (A `tool.show_stock_browser.error` warn line on stderr is expected from the 404-without-search test.)

- [ ] **Step 5: Commit**

```bash
git add src/widgets/tools/stock.ts tests/unit/widgets-stock.test.ts
git commit -m "feat(widgets): stock browser, history and velocity tools

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Purchase-order tools

**Files:**
- Create: `src/widgets/tools/purchases.ts`
- Test: `tests/unit/widgets-purchases.test.ts`

**Interfaces:**
- Consumes:
  - From T1 (`src/widgets/contract.ts`): `APP_TOOL`, `VIEW_TOOL`, `PAGE_SIZE`, `PO_STATUSES`, `PO_STATUS_SCAN_PAGES`, `STRUCTURED_MAX_CHARS`, `poStatusLabel`, `purchaseOrdersInput`, `purchaseOrdersPageInput`, `purchaseOrderItemsInput`, `purchaseOrdersData`, `purchaseOrdersPageData`, `purchaseOrderItemsData`, `type PoStatusFilter`, `type ToolOutput`.
  - From T1 (`src/widgets/qasir-dates.ts`, `src/widgets/qasir-values.ts`): `parseQasirDateTime`, `toNumber`, `toNumberOrNull`, `toText`.
  - From T2 (`src/widgets/tools/define.ts`): `type WidgetToolDef`, `type AnyWidgetToolDef`, `type ToolContext` (`ctx.outletId`, `ctx.request`, `ctx.meta`).
  - From T2 (`src/widgets/tools/shared.ts`): `envelopeData`, `recordsAt`, `pageInfo`, `nextPageOf`, `capRows`, `rupiah`, `formatQty`, `indoDate`, `joinLines`.
  - From T2 (`tests/stubs/widget-harness.ts`): `callWidgetTool`, `envelope`.
  - Registry inputs (`src/registry/ops/catalog.ts`): `purchases.list` query `{ page, count, outlet_ids: string }` (no `status`); `purchases.items` path `{ purchase_id: string }` + query `{ outlet_id: integer }`.
- Produces:
  - `export const purchaseOrdersTool: WidgetToolDef<typeof purchaseOrdersInput>` (`show_purchase_orders`, view `pembelian`, `maxRequests` 5)
  - `export const purchaseOrdersPageTool: WidgetToolDef<typeof purchaseOrdersPageInput>` (`purchase_orders_page`, app-only, `maxRequests` 1)
  - `export const purchaseOrderItemsTool: WidgetToolDef<typeof purchaseOrderItemsInput>` (`purchase_order_items`, app-only, `maxRequests` 1)
  - `export const PURCHASE_TOOLS: readonly AnyWidgetToolDef[]` (in that order; T11 consumes it)
  - `export function projectPurchaseRow(raw: Record<string, unknown>): ToolOutput<"show_purchase_orders">["rows"][number]`
  - `export function projectPurchaseItem(raw: Record<string, unknown>): ToolOutput<"purchase_order_items">["items"][number]`

Behaviour this task pins down (spec §2 "purchases.list", §4.2 item 4):
- `semua` loads page 1 only. A specific status scans pages 1…`PO_STATUS_SCAN_PAGES` (5) one after another, stopping early when upstream has no `pagination.next` (or a page is empty), then filters rows in code; `purchases.list` rejects a `status` query.
- `status_counts` counts every scanned row. It always has the keys `order_processed`, `completed` and `canceled` (0 when absent) plus any unknown status seen.
- `next_page` is the last scanned page + 1 when upstream still has more, otherwise `null`. `total_rows` is `pagination.total_result` of page 1.
- `truncated` is set only when rows are trimmed to fit `STRUCTURED_MAX_CHARS` (`truncated_reason` `"Baris terakhir dipangkas karena hasil melebihi 250 KB."`, the same copy as T3 and T4); an incomplete status scan is signalled by `next_page`, not by `truncated`.
- Rows with an empty `id` are dropped. `created_at` goes through `parseQasirDateTime` (ISO UTC).
- Item `price` is `price_unit`, or `price_base` when `price_unit` is absent. `subtotal` = `quantity` (ordered) × `price`; `total` = Σ `subtotal` (verified: 10 × 163,200 = PO `total_price`).
- The text never contains phone numbers; supplier names and PO numbers are business data.

- [ ] **Step 1: Write the failing tests**

`tests/unit/widgets-purchases.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { DispatchRequest } from "../../src/dispatcher/qasir-dispatcher";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import {
  purchaseOrderItemsData,
  purchaseOrderItemsInput,
  purchaseOrdersData,
  purchaseOrdersPageData,
} from "../../src/widgets/contract";
import {
  PURCHASE_TOOLS,
  purchaseOrderItemsTool,
  purchaseOrdersPageTool,
  purchaseOrdersTool,
} from "../../src/widgets/tools/purchases";
import { callWidgetTool, envelope } from "../stubs/widget-harness";

const COUNT = 100;

/** Synthetic purchases.list row shaped like the verified upstream payload. */
function po(id: number, status: string): Record<string, unknown> {
  return {
    id: String(id),
    order_no: `PO-20260904${String(id).padStart(8, "0")}000001`,
    outlet_id: "645203",
    supplier_id: "1",
    supplier_name: `Pemasok ${id % 3 === 0 ? "A" : "B"}`,
    notes: "",
    total_price: 150000,
    status,
    created_at: "2026-09-04T11:54:40Z",
    updated_at: "2026-09-05T08:00:00Z",
  };
}

/**
 * purchases.list over `totalPages` pages of 100 rows. The first row of each page has
 * status `firstStatus`; the rest are completed. Pages past the end are empty.
 */
function purchasesHandler(totalPages: number, firstStatus = "order_processed") {
  return (req: DispatchRequest) => {
    const page = Number(req.query?.page);
    const rows =
      page <= totalPages
        ? Array.from({ length: COUNT }, (_, i) => po(page * 1000 + i, i === 0 ? firstStatus : "completed"))
        : [];
    return envelope(
      { purchases: rows },
      {
        current_page: page,
        page_size: COUNT,
        total_page: totalPages,
        total_result: totalPages * COUNT,
        ...(page < totalPages ? { next: `/api/v5/purchases?count=${COUNT}&page=${page + 1}` } : {}),
      },
    );
  };
}

function pagesRequested(calls: Array<{ req: DispatchRequest }>): number[] {
  return calls.map((c) => Number(c.req.query?.page));
}

describe("show_purchase_orders", () => {
  it("loads only page 1 for semua and counts statuses on it", async () => {
    const call = await callWidgetTool(purchaseOrdersTool, {}, { handlers: { "purchases.list": purchasesHandler(38) } });

    expect(call.error).toBeUndefined();
    expect(call.dispatcher.calls).toHaveLength(1);
    expect(call.dispatcher.calls[0]!.req).toEqual({
      operationId: "purchases.list",
      query: { page: 1, count: 100, outlet_ids: "645203" },
    });
    expect(call.dispatcher.calls[0]!.opts?.allowMutation).toBeUndefined();

    const data = purchaseOrdersData.parse(call.structured);
    expect(data.view).toBe("pembelian");
    expect(data.outlet_id).toBe("645203");
    expect(data.generated_at).toBe("2026-09-15T03:00:00.000Z");
    expect(data.status_filter).toBe("semua");
    expect(data.rows).toHaveLength(100);
    expect(data.scanned_rows).toBe(100);
    expect(data.total_rows).toBe(3800);
    expect(data.status_counts).toEqual({ order_processed: 1, completed: 99, canceled: 0 });
    expect(data.next_page).toBe(2);
    expect(data.truncated).toBe(false);
    expect(data.rows[0]).toEqual({
      id: "1000",
      order_no: "PO-2026090400001000000001",
      supplier: "Pemasok B",
      total: 150000,
      status: "order_processed",
      status_label: "Diproses",
      created_at: "2026-09-04T11:54:40.000Z",
    });

    expect(call.text).toContain("filter: Semua status");
    expect(call.text).toContain("Dipindai 100 PO terbaru dari 3800 PO: Diproses 1, Selesai 99, Dibatalkan 0.");
    expect(call.text).toContain("- PO-2026090400001000000001 · 4 Sep 2026 · Pemasok B · Rp 150.000 · Diproses");
    expect(call.text.split("\n").filter((l) => l.startsWith("- "))).toHaveLength(10);
    expect(call.text.length).toBeLessThanOrEqual(2000);
  });

  it("scans at most 5 pages for a specific status and points next_page past the scan", async () => {
    const call = await callWidgetTool(
      purchaseOrdersTool,
      { status: "order_processed" },
      { handlers: { "purchases.list": purchasesHandler(38) } },
    );

    expect(pagesRequested(call.dispatcher.calls)).toEqual([1, 2, 3, 4, 5]);
    const data = purchaseOrdersData.parse(call.structured);
    expect(data.status_filter).toBe("order_processed");
    expect(data.rows.map((r) => r.id)).toEqual(["1000", "2000", "3000", "4000", "5000"]);
    expect(data.rows.every((r) => r.status === "order_processed")).toBe(true);
    expect(data.scanned_rows).toBe(500);
    expect(data.status_counts).toEqual({ order_processed: 5, completed: 495, canceled: 0 });
    expect(data.next_page).toBe(6);
    expect(call.text).toContain("PO berstatus Diproses (5 dari 5):");
  });

  it("stops scanning when upstream has no next page", async () => {
    const call = await callWidgetTool(
      purchaseOrdersTool,
      { status: "canceled" },
      { handlers: { "purchases.list": purchasesHandler(2, "canceled") } },
    );

    expect(pagesRequested(call.dispatcher.calls)).toEqual([1, 2]);
    const data = purchaseOrdersData.parse(call.structured);
    expect(data.rows).toHaveLength(2);
    expect(data.scanned_rows).toBe(200);
    expect(data.status_counts).toEqual({ order_processed: 0, completed: 198, canceled: 2 });
    expect(data.next_page).toBeNull();
    expect(call.text).not.toContain("Masih ada PO");
  });

  it("reports when no scanned PO has the requested status", async () => {
    const call = await callWidgetTool(
      purchaseOrdersTool,
      { status: "canceled" },
      { handlers: { "purchases.list": purchasesHandler(1, "completed") } },
    );

    const data = purchaseOrdersData.parse(call.structured);
    expect(data.rows).toEqual([]);
    expect(data.next_page).toBeNull();
    expect(call.text).toContain("Tidak ada PO berstatus Dibatalkan di PO yang dipindai.");
  });

  it("keeps unknown statuses and drops rows without an id", async () => {
    const call = await callWidgetTool(purchaseOrdersTool, {}, {
      handlers: {
        "purchases.list": () =>
          envelope({ purchases: [po(1, "draft"), { ...po(2, "completed"), id: "" }, po(3, "completed")] }, { current_page: 1, total_result: 3 }),
      },
    });

    const data = purchaseOrdersData.parse(call.structured);
    expect(data.rows.map((r) => [r.id, r.status_label])).toEqual([
      ["1", "draft"],
      ["3", "Selesai"],
    ]);
    expect(data.status_counts).toEqual({ order_processed: 0, completed: 1, canceled: 0, draft: 1 });
    expect(data.next_page).toBeNull();
  });

  it("uses the input outlet_id instead of the session outlet", async () => {
    const call = await callWidgetTool(purchaseOrdersTool, { outlet_id: "777" }, { handlers: { "purchases.list": purchasesHandler(1) } });

    expect(call.dispatcher.calls[0]!.req.query).toEqual({ page: 1, count: 100, outlet_ids: "777" });
    expect(purchaseOrdersData.parse(call.structured).outlet_id).toBe("777");
  });

  it("returns the upstream error as {code,message} JSON", async () => {
    const call = await callWidgetTool(purchaseOrdersTool, {}, {
      handlers: {
        "purchases.list": () => {
          throw new AppError(ErrorCodes.QASIR_RATE_LIMITED, "Qasir rate limit");
        },
      },
    });

    expect(call.result.isError).toBe(true);
    expect(call.error).toEqual({ code: "QASIR_RATE_LIMITED", message: "Qasir rate limit" });
    expect(call.structured).toBeUndefined();
  });
});

describe("purchase_orders_page", () => {
  it("loads the requested page unfiltered", async () => {
    const call = await callWidgetTool(purchaseOrdersPageTool, { page: 3 }, { handlers: { "purchases.list": purchasesHandler(3) } });

    expect(call.dispatcher.calls.map((c) => c.req.query)).toEqual([{ page: 3, count: 100, outlet_ids: "645203" }]);
    const data = purchaseOrdersPageData.parse(call.structured);
    expect(data.page).toBe(3);
    expect(data.rows).toHaveLength(100);
    expect(data.rows[0]!.status).toBe("order_processed");
    expect(data.next_page).toBeNull();
    expect(call.text).toBe("Halaman 3 PO: 100 PO.\nTidak ada halaman berikutnya.");
  });

  it("returns next_page when upstream has more", async () => {
    const call = await callWidgetTool(purchaseOrdersPageTool, { page: 2 }, { handlers: { "purchases.list": purchasesHandler(38) } });

    expect(purchaseOrdersPageData.parse(call.structured).next_page).toBe(3);
  });

  it("trims rows from the tail to keep structuredContent under 250,000 chars", async () => {
    const wide = Array.from({ length: 100 }, (_, i) => ({ ...po(i + 1, "completed"), supplier_name: `Pemasok ${"x".repeat(3000)}` }));
    const call = await callWidgetTool(purchaseOrdersPageTool, { page: 1 }, {
      handlers: { "purchases.list": () => envelope({ purchases: wide }, { current_page: 1, total_result: 100 }) },
    });

    const data = purchaseOrdersPageData.parse(call.structured);
    expect(data.truncated).toBe(true);
    expect(data.truncated_reason).toBe("Baris terakhir dipangkas karena hasil melebihi 250 KB.");
    expect(data.rows.length).toBeGreaterThan(0);
    expect(data.rows.length).toBeLessThan(100);
    expect(data.rows[0]!.id).toBe("1");
    expect(JSON.stringify(call.structured).length).toBeLessThanOrEqual(250_000);
  });
});

describe("purchase_order_items", () => {
  const items = [
    {
      id: "1",
      product_id: "10",
      variant_id: "20",
      product_name: "Kampas Rem Depan",
      variant_name: "Tipe X",
      quantity: 10,
      receive_quantity: 8,
      price_unit: 163200,
      price_base: 163200,
      price_sell: 350000,
      unit_label_name: "Set",
    },
    {
      id: "2",
      product_id: "11",
      variant_id: "21",
      product_name: "Oli Mesin 1L",
      variant_name: "",
      quantity: 2.5,
      receive_quantity: 0,
      price_base: 40000,
      price_sell: 55000,
      unit_label_name: "Liter",
    },
  ];

  it("passes purchase_id in the path and outlet_id as an integer", async () => {
    const call = await callWidgetTool(purchaseOrderItemsTool, { purchase_id: "1147217" }, {
      handlers: { "purchases.items": () => envelope({ purchase_items: items }) },
    });

    expect(call.dispatcher.calls).toHaveLength(1);
    expect(call.dispatcher.calls[0]!.req).toEqual({
      operationId: "purchases.items",
      path: { purchase_id: "1147217" },
      query: { outlet_id: 645203 },
    });

    const data = purchaseOrderItemsData.parse(call.structured);
    expect(data.purchase_id).toBe("1147217");
    expect(data.items).toEqual([
      { product: "Kampas Rem Depan", variant: "Tipe X", quantity: 10, received: 8, unit: "Set", price: 163200, subtotal: 1632000 },
      { product: "Oli Mesin 1L", variant: "", quantity: 2.5, received: 0, unit: "Liter", price: 40000, subtotal: 100000 },
    ]);
    expect(data.total).toBe(1732000);
    expect(call.text).toContain("Rincian PO 1147217: 2 item, total Rp 1.732.000.");
    expect(call.text).toContain("- Kampas Rem Depan (Tipe X): dipesan 10, diterima 8 Set × Rp 163.200 = Rp 1.632.000");
  });

  it("returns an empty list when the PO has no items", async () => {
    const call = await callWidgetTool(purchaseOrderItemsTool, { purchase_id: "5", outlet_id: "777" }, {
      handlers: { "purchases.items": () => envelope({ purchase_items: [] }) },
    });

    expect(call.dispatcher.calls[0]!.req.query).toEqual({ outlet_id: 777 });
    const data = purchaseOrderItemsData.parse(call.structured);
    expect(data.items).toEqual([]);
    expect(data.total).toBe(0);
  });

  it("rejects non-numeric purchase ids before dispatch", () => {
    expect(purchaseOrderItemsInput.safeParse({ purchase_id: "../1" }).success).toBe(false);
    expect(purchaseOrderItemsInput.safeParse({ purchase_id: "0" }).success).toBe(false);
  });
});

describe("purchase tool definitions", () => {
  it("exports the three tools with their budgets and description rules", () => {
    expect(PURCHASE_TOOLS.map((t) => [t.name, t.maxRequests, t.view ?? null])).toEqual([
      ["show_purchase_orders", 5, "pembelian"],
      ["purchase_orders_page", 1, null],
      ["purchase_order_items", 1, null],
    ]);
    expect(purchaseOrdersTool.description.startsWith("Open an interactive")).toBe(true);
    expect(purchaseOrdersTool.description.length).toBeLessThanOrEqual(600);
    for (const tool of [purchaseOrdersPageTool, purchaseOrderItemsTool]) {
      expect(tool.description.startsWith("Widget helper:")).toBe(true);
      expect(tool.description.length).toBeLessThanOrEqual(300);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test tests/unit/widgets-purchases.test.ts`
Expected: FAIL with `Error: Cannot find module '../../src/widgets/tools/purchases' imported from …/tests/unit/widgets-purchases.test.ts`.

- [ ] **Step 3: Implement `src/widgets/tools/purchases.ts`**

```ts
import {
  APP_TOOL,
  PAGE_SIZE,
  PO_STATUSES,
  PO_STATUS_SCAN_PAGES,
  STRUCTURED_MAX_CHARS,
  VIEW_TOOL,
  poStatusLabel,
  purchaseOrderItemsInput,
  purchaseOrdersInput,
  purchaseOrdersPageInput,
  type PoStatusFilter,
  type ToolOutput,
} from "../contract";
import { parseQasirDateTime } from "../qasir-dates";
import { toNumber, toNumberOrNull, toText } from "../qasir-values";
import type { AnyWidgetToolDef, ToolContext, WidgetToolDef } from "./define";
import { capRows, envelopeData, formatQty, indoDate, joinLines, nextPageOf, pageInfo, recordsAt, rupiah } from "./shared";

type PurchaseRow = ToolOutput<"show_purchase_orders">["rows"][number];
type PurchaseItem = ToolOutput<"purchase_order_items">["items"][number];

const TRUNCATED_REASON = "Baris terakhir dipangkas karena hasil melebihi 250 KB.";

/** Trim rows so the payload, measured with its truncation fields set, fits STRUCTURED_MAX_CHARS. */
function fitRows<T, P extends object>(rows: T[], build: (rows: T[]) => P): P & { truncated: boolean; truncated_reason: string | null } {
  const capped = capRows(rows, STRUCTURED_MAX_CHARS, (kept) => ({ ...build(kept), truncated: true, truncated_reason: TRUNCATED_REASON }));
  return { ...build(capped.rows), truncated: capped.truncated, truncated_reason: capped.truncated ? TRUNCATED_REASON : null };
}

/** purchases.list row → contract row; rows without an id are dropped by the caller. */
export function projectPurchaseRow(raw: Record<string, unknown>): PurchaseRow {
  const status = toText(raw.status);
  return {
    id: toText(raw.id),
    order_no: toText(raw.order_no),
    supplier: toText(raw.supplier_name),
    total: toNumber(raw.total_price),
    status,
    status_label: poStatusLabel(status),
    created_at: parseQasirDateTime(raw.created_at),
  };
}

interface PurchasePage {
  rows: PurchaseRow[];
  nextPage: number | null;
  totalResult: number | null;
}

/** One purchases.list page (count 100; the endpoint has no status filter). */
async function fetchPurchasePage(ctx: ToolContext, outletId: string, page: number): Promise<PurchasePage> {
  const res = await ctx.request({
    operationId: "purchases.list",
    query: { page, count: PAGE_SIZE.purchases, outlet_ids: outletId },
  });
  const raw = recordsAt(envelopeData(res, "purchases.list"), "purchases");
  const rows = raw.map(projectPurchaseRow).filter((row) => row.id !== "");
  return {
    rows,
    nextPage: raw.length === 0 ? null : nextPageOf(res, page, raw.length, PAGE_SIZE.purchases),
    totalResult: pageInfo(res)?.totalResult ?? null,
  };
}

/** Every known status starts at 0 so the widget can render all chips. */
function countStatuses(rows: PurchaseRow[]): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(PO_STATUSES.map((s) => [s, 0]));
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return counts;
}

function poLine(row: PurchaseRow): string {
  const date = row.created_at ? indoDate(row.created_at.slice(0, 10)) : "tanpa tanggal";
  return `- ${row.order_no || `PO ${row.id}`} · ${date} · ${row.supplier || "Tanpa pemasok"} · ${rupiah(row.total)} · ${row.status_label}`;
}

export const purchaseOrdersTool: WidgetToolDef<typeof purchaseOrdersInput> = {
  name: VIEW_TOOL.pembelian,
  title: "Pesanan pembelian (PO)",
  description:
    "Open an interactive purchase-order (PO) widget for the Qasir outlet: newest POs with supplier, total and status (Diproses, Selesai, Dibatalkan), with expandable line items. Use it when the user asks about purchases, POs, suppliers or goods still on order. `status` (default semua) filters by scanning the newest 500 POs.",
  input: purchaseOrdersInput,
  maxRequests: 5, // = PO_STATUS_SCAN_PAGES pages for a specific status
  view: "pembelian",
  async run(input, ctx) {
    const outletId = await ctx.outletId(input.outlet_id);
    const filter: PoStatusFilter = input.status ?? "semua";
    const maxPages = filter === "semua" ? 1 : PO_STATUS_SCAN_PAGES;

    const scanned: PurchaseRow[] = [];
    let totalRows: number | null = null;
    let lastPage = 0;
    let more = false;
    for (let page = 1; page <= maxPages; page++) {
      const result = await fetchPurchasePage(ctx, outletId, page);
      scanned.push(...result.rows);
      totalRows ??= result.totalResult;
      lastPage = page;
      more = result.nextPage !== null;
      if (!more) break;
    }

    const matching = filter === "semua" ? scanned : scanned.filter((row) => row.status === filter);
    const nextPage = more ? lastPage + 1 : null;
    const statusCounts = countStatuses(scanned);
    const build = (rows: PurchaseRow[]) => ({
      view: "pembelian" as const,
      ...ctx.meta(outletId),
      status_filter: filter,
      rows,
      status_counts: statusCounts,
      scanned_rows: scanned.length,
      total_rows: totalRows,
      next_page: nextPage,
    });
    const structured: ToolOutput<"show_purchase_orders"> = fitRows(matching, build);

    const filterLabel = filter === "semua" ? "Semua status" : poStatusLabel(filter);
    const countsLine = Object.entries(statusCounts)
      .map(([status, count]) => `${poStatusLabel(status)} ${count}`)
      .join(", ");
    const text = joinLines([
      `Pesanan pembelian (PO) outlet ${outletId} · filter: ${filterLabel}`,
      `Dipindai ${scanned.length} PO terbaru${totalRows !== null ? ` dari ${totalRows} PO` : ""}: ${countsLine}.`,
      matching.length === 0
        ? filter === "semua"
          ? "Belum ada PO."
          : `Tidak ada PO berstatus ${filterLabel} di PO yang dipindai.`
        : `${filter === "semua" ? "PO terbaru" : `PO berstatus ${filterLabel}`} (${Math.min(10, matching.length)} dari ${matching.length}):`,
      ...matching.slice(0, 10).map(poLine),
      nextPage !== null && "Masih ada PO yang lebih lama; buka widget untuk memuat halaman berikutnya.",
    ]);
    return { text, structured };
  },
};

export const purchaseOrdersPageTool: WidgetToolDef<typeof purchaseOrdersPageInput> = {
  name: APP_TOOL.purchaseOrdersPage,
  title: "Halaman PO berikutnya",
  description: "Widget helper: loads one more page (100 rows, newest first) of purchase orders for the pembelian view. Rows are unfiltered; the widget filters by status.",
  input: purchaseOrdersPageInput,
  maxRequests: 1,
  async run(input, ctx) {
    const outletId = await ctx.outletId(input.outlet_id);
    const result = await fetchPurchasePage(ctx, outletId, input.page);
    const build = (rows: PurchaseRow[]) => ({ ...ctx.meta(outletId), page: input.page, rows, next_page: result.nextPage });
    const structured: ToolOutput<"purchase_orders_page"> = fitRows(result.rows, build);
    const text = joinLines([
      `Halaman ${input.page} PO: ${result.rows.length} PO.`,
      result.nextPage === null ? "Tidak ada halaman berikutnya." : `Halaman berikutnya: ${result.nextPage}.`,
    ]);
    return { text, structured };
  },
};

/** purchases.items line → contract item. Unit cost is price_unit (price_base when absent). */
export function projectPurchaseItem(raw: Record<string, unknown>): PurchaseItem {
  const quantity = toNumber(raw.quantity);
  const price = toNumberOrNull(raw.price_unit) ?? toNumber(raw.price_base);
  return {
    product: toText(raw.product_name),
    variant: toText(raw.variant_name),
    quantity,
    received: toNumber(raw.receive_quantity),
    unit: toText(raw.unit_label_name),
    price,
    subtotal: quantity * price,
  };
}

export const purchaseOrderItemsTool: WidgetToolDef<typeof purchaseOrderItemsInput> = {
  name: APP_TOOL.purchaseOrderItems,
  title: "Rincian item PO",
  description: "Widget helper: line items of one purchase order (product, variant, ordered, received, unit cost, subtotal) for the pembelian view.",
  input: purchaseOrderItemsInput,
  maxRequests: 1,
  async run(input, ctx) {
    const outletId = await ctx.outletId(input.outlet_id);
    const res = await ctx.request({
      operationId: "purchases.items",
      path: { purchase_id: input.purchase_id },
      query: { outlet_id: Number(outletId) },
    });
    const items = recordsAt(envelopeData(res, "purchases.items"), "purchase_items").map(projectPurchaseItem);
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    const build = (rows: PurchaseItem[]) => ({ ...ctx.meta(outletId), purchase_id: input.purchase_id, items: rows, total });
    const structured: ToolOutput<"purchase_order_items"> = fitRows(items, build);
    const text = joinLines([
      `Rincian PO ${input.purchase_id}: ${items.length} item, total ${rupiah(total)}.`,
      ...items
        .slice(0, 10)
        .map(
          (item) =>
            `- ${item.product}${item.variant ? ` (${item.variant})` : ""}: dipesan ${formatQty(item.quantity)}, diterima ${formatQty(item.received)} ${item.unit} × ${rupiah(item.price)} = ${rupiah(item.subtotal)}`,
        ),
      items.length > 10 && `…dan ${items.length - 10} item lainnya.`,
    ]);
    return { text, structured };
  },
};

export const PURCHASE_TOOLS: readonly AnyWidgetToolDef[] = [purchaseOrdersTool, purchaseOrdersPageTool, purchaseOrderItemsTool];
```

- [ ] **Step 4: Run the tests and types**

Run: `bun run test tests/unit/widgets-purchases.test.ts && bun run check-types`
Expected: `Test Files  1 passed (1)`, `Tests  14 passed (14)`; `tsc` exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/tools/purchases.ts tests/unit/widgets-purchases.test.ts
git commit -m "feat(widgets): purchase-order view, pager and PO items tools

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Transaction tools

**Files:**
- Create: `src/widgets/tools/transactions.ts`
- Test: `tests/unit/widgets-transactions.test.ts`

**Interfaces:**
- Consumes:
  - From T1 (`src/widgets/contract.ts`): `APP_TOOL`, `VIEW_TOOL`, `PAGE_SIZE`, `STRUCTURED_MAX_CHARS`, `salesStatusLabel`, `transactionsInput`, `transactionsPageInput`, `orderDetailInput`, `transactionsData`, `transactionsPageData`, `orderDetailData`, `type ToolOutput`.
  - From T1 (`src/widgets/qasir-dates.ts`, `src/widgets/qasir-values.ts`): `assertDateRange`, `jakartaDateOf`, `parseIndonesianDate`, `parseQasirDateTime`, `isRecord`, `toNumber`, `toNumberOrNull`, `toText`.
  - From T2 (`src/widgets/tools/define.ts`): `type WidgetToolDef`, `type AnyWidgetToolDef`, `type ToolContext`.
  - From T2 (`src/widgets/tools/shared.ts`): `envelopeData`, `recordsAt`, `pageInfo`, `nextPageOf`, `capRows`, `rupiah`, `formatQty`, `indoDate`, `joinLines`.
  - From T2 (`tests/stubs/widget-harness.ts`): `callWidgetTool`, `envelope`.
  - `AppError`, `ErrorCodes`, `isAppErrorLike` from `src/errors/codes.ts`.
  - Registry inputs (`src/registry/ops/catalog.ts`): `order.histories.web` query `{ page, count, start_date, end_date, outlet_ids: string, customer_id?: integer }`; `order.histories.legacy` path `{ sales_id: integer }` (no query, no outlet); `customers.get` path `{ customer_id: integer }`.
- Produces:
  - `export const transactionsTool: WidgetToolDef<typeof transactionsInput>` (`show_transactions`, view `transaksi`, `maxRequests` 2)
  - `export const transactionsPageTool: WidgetToolDef<typeof transactionsPageInput>` (`transactions_page`, app-only, `maxRequests` 1)
  - `export const orderDetailTool: WidgetToolDef<typeof orderDetailInput>` (`order_detail`, app-only, `maxRequests` 1)
  - `export const TRANSACTION_TOOLS: readonly AnyWidgetToolDef[]` (in that order; T11 consumes it)
  - `export function projectDays(data: Record<string, unknown>): ToolOutput<"show_transactions">["days"]`
  - `export function projectOrderDetail(sale: Record<string, unknown>, salesId: number): Omit<ToolOutput<"order_detail">, "outlet_id" | "generated_at" | "truncated" | "truncated_reason">`

Behaviour this task pins down (spec §2 "order.histories.web" / "order.histories.legacy", §4.2 item 5):
- `show_transactions` and `transactions_page` call `assertDateRange` first (INVALID_INPUT before any dispatch), then `order.histories.web` with `count` 100 and `customer_id` only when given. `show_transactions` runs `customers.get` in parallel when `customer_id` is set, reading `data.customer.fullname`. An `UPSTREAM_ERROR` from `customers.get` (e.g. a deleted customer) degrades to `name: null`; any other error code fails the call.
- `data.agg` is never read. `settle_by` (staff names) and `outlet_name` are never projected. Groups without a `YYYY-MM-DD` date and items without a positive `sales_id` are skipped.
- `total_transactions` = `pagination.total_result` (web pagination is normal). `loaded_transactions` = loaded rows. `loaded_amount` = Σ `amount` over loaded rows with `status !== 3`.
- `payment_mode_totals` covers loaded rows: `count` counts every row and `amount` excludes status 3, so Σ count = `loaded_transactions` and Σ amount = `loaded_amount`. Sorted by amount desc, then count desc, then name.
- `next_page` = `nextPageOf(res, page, rows, 100)`. `truncated` is set only when days are trimmed to fit `STRUCTURED_MAX_CHARS` (`truncated_reason` `"Baris terakhir dipangkas karena hasil melebihi 250 KB."`, the same copy as T3 and T4).
- The text shows the range, total count, the loaded sum labelled "Baris dimuat … (tanpa refund penuh)" and the payment-mode split. For a customer filter it shows `pelanggan #<id>`, never the name (spec §6: names appear in text only in the piutang top 5), and never a phone number.
- `order_detail` projects legacy `data.sales`:
  - `total_bill` from its decimal string; `settled_at` and `payments[].paid_at` via `parseQasirDateTime`, which treats local times as Asia/Jakarta.
  - `items[]` from `carts[]`: `variant.product.name`; `variant.variant_name`, with `""` becoming `null`; price from `price_sell_unit`, else `price_sell`; line `total`.
  - `customer` is `null` when absent or `id` is 0.
  - `cashier` is the trimmed `user_settled.name`, else `created_by_name`, else `null`.
  - `outlet_id` is `sales.outlet_id`, falling back to the session outlet when it is missing.
  - `credit` is non-null only when `status === 4`. Then `period` is the number of the string period, `unit`, and `due_date` comes from `installment.date`: `"DD <Bulan> YYYY"` or an ISO day, with `""` becoming `null`. `total` is `total_installment` and `remaining` is `remaining_debt`. Outside status 4 `remaining_debt` is meaningless and may be negative.
  - A missing `data.sales` record is `UPSTREAM_ERROR "Unexpected order.histories.legacy response"`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/widgets-transactions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { DispatchRequest } from "../../src/dispatcher/qasir-dispatcher";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import { orderDetailData, orderDetailInput, transactionsData, transactionsPageData } from "../../src/widgets/contract";
import {
  TRANSACTION_TOOLS,
  orderDetailTool,
  transactionsPageTool,
  transactionsTool,
} from "../../src/widgets/tools/transactions";
import { callWidgetTool, envelope } from "../stubs/widget-harness";

/** Synthetic order.histories.web item (staff and outlet names included so the test proves they are dropped). */
function sale(salesId: number, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sales_id: salesId,
    status: 2,
    date_time: "10:15",
    invoice_number: `INV${salesId}`,
    outlet_name: "Toko Contoh",
    settle_by: "Kasir Contoh  ",
    payment_mode: "CASH",
    amount: 100000,
    sales_type_name: "",
    ...over,
  };
}

const WEB_DATA = {
  // data.agg deliberately disagrees with the rows: it must never be used.
  agg: { total_items: 999, total_amount: 1 },
  sales: [
    {
      date: "2026-09-15",
      daily_amount: 450000,
      items: [
        sale(11, { amount: 250000, payment_mode: "QRIS", date_time: "17:54" }),
        sale(12, { amount: 200000 }),
        sale(13, { status: 3, amount: 75000 }),
      ],
    },
    {
      date: "2026-09-14",
      daily_amount: 284000,
      items: [sale(21, { status: 6, amount: 284000, payment_mode: "QRIS" }), sale(22, { status: 6, amount: 0 })],
    },
    { date: "", daily_amount: 5, items: [sale(99)] },
  ],
};

function webHandler(pagination: Record<string, unknown> | undefined, data: Record<string, unknown> = WEB_DATA) {
  return () => envelope(data, pagination);
}

const MORE = { current_page: 1, page_size: 100, total_page: 3, total_result: 250, next: "/api/v5/order/histories/web?page=2" };
const LAST = { current_page: 3, page_size: 100, total_page: 3, total_result: 250 };

describe("show_transactions", () => {
  it("loads web histories page 1 and summarizes loaded rows without data.agg", async () => {
    const call = await callWidgetTool(
      transactionsTool,
      { start_date: "2026-09-14", end_date: "2026-09-15" },
      { handlers: { "order.histories.web": webHandler(MORE) } },
    );

    expect(call.error).toBeUndefined();
    expect(call.dispatcher.calls.map((c) => c.req)).toEqual([
      {
        operationId: "order.histories.web",
        query: { page: 1, count: 100, start_date: "2026-09-14", end_date: "2026-09-15", outlet_ids: "645203" },
      },
    ]);

    const data = transactionsData.parse(call.structured);
    expect(data.view).toBe("transaksi");
    expect(data.outlet_id).toBe("645203");
    expect(data.range).toEqual({ start_date: "2026-09-14", end_date: "2026-09-15" });
    expect(data.customer).toBeNull();
    expect(data.days.map((d) => [d.date, d.daily_amount, d.items.length])).toEqual([
      ["2026-09-15", 450000, 3],
      ["2026-09-14", 284000, 2],
    ]);
    expect(data.days[0]!.items[0]).toEqual({
      sales_id: 11,
      time: "17:54",
      invoice: "INV11",
      payment_mode: "QRIS",
      amount: 250000,
      status: 2,
      status_label: "Selesai",
      sales_type: "",
    });
    expect(data.days[0]!.items[2]!.status_label).toBe("Refund");
    expect(data.days[1]!.items[0]!.status_label).toBe("Refund sebagian");
    expect(data.total_transactions).toBe(250);
    expect(data.loaded_transactions).toBe(5);
    // 250000 + 200000 + 284000 + 0; the status-3 row (75000) is excluded.
    expect(data.loaded_amount).toBe(734000);
    expect(data.payment_mode_totals).toEqual([
      { payment_mode: "QRIS", count: 2, amount: 534000 },
      { payment_mode: "CASH", count: 3, amount: 200000 },
    ]);
    expect(data.next_page).toBe(2);
    expect(data.truncated).toBe(false);

    const json = JSON.stringify(call.structured);
    expect(json).not.toContain("Kasir Contoh");
    expect(json).not.toContain("Toko Contoh");
    expect(json).not.toContain("999");

    expect(call.text).toContain("Transaksi 14 Sep 2026 – 15 Sep 2026 · outlet 645203");
    expect(call.text).toContain("Jumlah transaksi: 250.");
    expect(call.text).toContain("Baris dimuat: 5 transaksi, Rp 734.000 (tanpa refund penuh).");
    expect(call.text).toContain("- QRIS: 2 transaksi · Rp 534.000");
    expect(call.text).toContain("Masih ada transaksi lain");
  });

  it("filters by customer and fetches the customer name without putting it in the text", async () => {
    const call = await callWidgetTool(
      transactionsTool,
      { start_date: "2026-09-15", end_date: "2026-09-15", customer_id: 5001, outlet_id: "777" },
      {
        handlers: {
          "order.histories.web": webHandler(LAST),
          "customers.get": () => envelope({ customer: { id: 5001, fullname: "Pelanggan A", mobile: "0800-0000-0001" } }),
        },
      },
    );

    const web = call.dispatcher.calls.find((c) => c.req.operationId === "order.histories.web")!;
    expect(web.req.query).toEqual({
      page: 1,
      count: 100,
      start_date: "2026-09-15",
      end_date: "2026-09-15",
      outlet_ids: "777",
      customer_id: 5001,
    });
    const customer = call.dispatcher.calls.find((c) => c.req.operationId === "customers.get")!;
    expect(customer.req.path).toEqual({ customer_id: 5001 });

    const data = transactionsData.parse(call.structured);
    expect(data.customer).toEqual({ id: 5001, name: "Pelanggan A" });
    expect(data.next_page).toBeNull();
    expect(JSON.stringify(call.structured)).not.toContain("0800-0000-0001");
    expect(call.text).toContain("Transaksi 15 Sep 2026 · outlet 777 · pelanggan #5001");
    expect(call.text).not.toContain("Pelanggan A");
    expect(call.text).not.toContain("Masih ada transaksi lain");
  });

  it("keeps the list when customers.get fails upstream", async () => {
    const call = await callWidgetTool(
      transactionsTool,
      { start_date: "2026-09-15", end_date: "2026-09-15", customer_id: 5002 },
      {
        handlers: {
          "order.histories.web": webHandler(LAST),
          "customers.get": () => {
            throw new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream 404");
          },
        },
      },
    );

    const data = transactionsData.parse(call.structured);
    expect(data.customer).toEqual({ id: 5002, name: null });
    expect(data.loaded_transactions).toBe(5);
  });

  it("fails the call when customers.get reports an expired session", async () => {
    const call = await callWidgetTool(
      transactionsTool,
      { start_date: "2026-09-15", end_date: "2026-09-15", customer_id: 5002 },
      {
        handlers: {
          "order.histories.web": webHandler(LAST),
          "customers.get": () => {
            throw new AppError(ErrorCodes.QASIR_AUTH_EXPIRED, "Qasir session expired");
          },
        },
      },
    );

    expect(call.error).toEqual({
      code: "QASIR_AUTH_EXPIRED",
      message: "Qasir session expired",
      connect_url: "https://mcp.example.test/connect",
    });
  });

  it("reports an empty range", async () => {
    const call = await callWidgetTool(
      transactionsTool,
      { start_date: "2026-09-15", end_date: "2026-09-15" },
      { handlers: { "order.histories.web": webHandler({ current_page: 1, page_size: 100, total_page: 0, total_result: 0 }, { agg: {}, sales: [] }) } },
    );

    const data = transactionsData.parse(call.structured);
    expect(data.days).toEqual([]);
    expect(data.loaded_amount).toBe(0);
    expect(data.payment_mode_totals).toEqual([]);
    expect(data.next_page).toBeNull();
    expect(call.text).toContain("Tidak ada transaksi pada rentang ini.");
  });

  it("rejects ranges over 366 days before any dispatch", async () => {
    const call = await callWidgetTool(
      transactionsTool,
      { start_date: "2025-09-14", end_date: "2026-09-15" },
      { handlers: { "order.histories.web": webHandler(LAST) } },
    );

    expect(call.error?.code).toBe("INVALID_INPUT");
    expect(call.dispatcher.calls).toHaveLength(0);
  });
});

describe("transactions_page", () => {
  it("loads the requested page with the same filters", async () => {
    const call = await callWidgetTool(
      transactionsPageTool,
      { start_date: "2026-09-01", end_date: "2026-09-15", customer_id: 5001, page: 3 },
      { handlers: { "order.histories.web": webHandler(LAST) } },
    );

    expect(call.dispatcher.calls.map((c) => c.req.query)).toEqual([
      { page: 3, count: 100, start_date: "2026-09-01", end_date: "2026-09-15", outlet_ids: "645203", customer_id: 5001 },
    ]);
    const data = transactionsPageData.parse(call.structured);
    expect(data.page).toBe(3);
    expect(data.days).toHaveLength(2);
    expect(data.next_page).toBeNull();
    expect(call.text).toBe("Halaman 3 transaksi 1 Sep 2026 – 15 Sep 2026: 5 transaksi, Rp 734.000 (tanpa refund penuh).\nTidak ada halaman berikutnya.");
  });

  it("returns next_page while upstream has a next link", async () => {
    const call = await callWidgetTool(
      transactionsPageTool,
      { start_date: "2026-09-01", end_date: "2026-09-15", page: 2 },
      { handlers: { "order.histories.web": webHandler({ ...MORE, current_page: 2 }) } },
    );

    expect(transactionsPageData.parse(call.structured).next_page).toBe(3);
  });

  it("rejects a reversed range", async () => {
    const call = await callWidgetTool(
      transactionsPageTool,
      { start_date: "2026-09-15", end_date: "2026-09-01", page: 1 },
      { handlers: { "order.histories.web": webHandler(LAST) } },
    );

    expect(call.error?.code).toBe("INVALID_INPUT");
    expect(call.dispatcher.calls).toHaveLength(0);
  });
});

/** Synthetic order.histories.legacy `data.sales`, shaped like the verified payload. */
function legacySale(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1077271206,
    status: 2,
    status_refund: 1,
    invoice_number: "65715HNN",
    total_bill: "220000.00",
    total_paid: 250000,
    money_change: 30000,
    settled_at: "2026-09-14 15:35:25",
    outlet_id: 645203,
    is_installment_completed: false,
    created_by_name: "Kasir Cadangan ",
    customer: { id: 2001, name: "Pelanggan A", mobile: "0800-0000-0001", email: "" },
    carts: [
      {
        id: 1,
        price_sell: 220000,
        price_sell_unit: 110000,
        quantity: 2,
        total: 220000,
        variant: { id: 3, variant_name: "", product: { id: 4, name: "Kampas Rem Depan", category_id: 5 } },
      },
      {
        id: 2,
        price_sell: 15000,
        quantity: 1.5,
        total: 22500,
        variant: { id: 6, variant_name: "Tipe X", product: { id: 7, name: "Oli Mesin 1L", category_id: 5 } },
      },
    ],
    payments: [{ payment_mode: "CASH", payment_name: "TUNAI", amount: 250000, paid_date: "2026-09-14 15:35:25" }],
    user_settled: { id: 9, name: "Kasir Contoh ", title: "" },
    installment: { period: "0", unit: "", date: "", total_installment: 220000, remaining_debt: -30000 },
    ...over,
  };
}

function legacyHandler(sales: Record<string, unknown>) {
  return (req: DispatchRequest) => envelope({ sales: { ...sales, id: Number(req.path?.sales_id) } });
}

describe("order_detail", () => {
  it("projects a paid sale and never reports credit outside status 4", async () => {
    const call = await callWidgetTool(orderDetailTool, { sales_id: 1077271206 }, {
      handlers: { "order.histories.legacy": legacyHandler(legacySale()) },
    });

    expect(call.dispatcher.calls.map((c) => c.req)).toEqual([
      { operationId: "order.histories.legacy", path: { sales_id: 1077271206 } },
    ]);
    const data = orderDetailData.parse(call.structured);
    expect(data).toEqual({
      outlet_id: "645203",
      generated_at: "2026-09-15T03:00:00.000Z",
      truncated: false,
      truncated_reason: null,
      sales_id: 1077271206,
      invoice: "65715HNN",
      status: 2,
      status_label: "Selesai",
      settled_at: "2026-09-14T08:35:25.000Z",
      total_bill: 220000,
      total_paid: 250000,
      change: 30000,
      items: [
        { product: "Kampas Rem Depan", variant: null, quantity: 2, price: 110000, total: 220000 },
        { product: "Oli Mesin 1L", variant: "Tipe X", quantity: 1.5, price: 15000, total: 22500 },
      ],
      payments: [{ name: "TUNAI", mode: "CASH", amount: 250000, paid_at: "2026-09-14T08:35:25.000Z" }],
      customer: { id: 2001, name: "Pelanggan A", mobile: "0800-0000-0001" },
      credit: null,
      cashier: "Kasir Contoh",
    });

    expect(call.text).toContain("Nota 65715HNN · Selesai · 14 Sep 2026");
    expect(call.text).toContain("Total Rp 220.000 · dibayar Rp 250.000 · kembalian Rp 30.000");
    expect(call.text).toContain("- Oli Mesin 1L (Tipe X) × 1,5 = Rp 22.500");
    expect(call.text).not.toContain("0800-0000-0001");
    expect(call.text).not.toContain("Pelanggan A");
    expect(call.text).not.toContain("Kredit");
  });

  it("reports credit for an open credit sale (status 4)", async () => {
    const call = await callWidgetTool(orderDetailTool, { sales_id: 42 }, {
      handlers: {
        "order.histories.legacy": legacyHandler(
          legacySale({
            status: 4,
            total_paid: 50000,
            money_change: 0,
            payments: [
              { payment_mode: "CASH", payment_name: "TUNAI", amount: 0, paid_date: "2026-08-01 09:00:00" },
              { payment_mode: "CASH", payment_name: "TUNAI", amount: 50000, paid_date: "2026-08-20 16:00:00" },
            ],
            installment: { period: "30", unit: "DAY", date: "31 Agustus 2026", total_installment: 242500, remaining_debt: 192500 },
          }),
        ),
      },
    });

    const data = orderDetailData.parse(call.structured);
    expect(data.sales_id).toBe(42);
    expect(data.status_label).toBe("Kredit belum lunas");
    expect(data.credit).toEqual({ period: 30, unit: "DAY", due_date: "2026-08-31", total: 242500, remaining: 192500 });
    expect(data.payments.map((p) => p.amount)).toEqual([0, 50000]);
    expect(call.text).toContain("Kredit belum lunas: sisa Rp 192.500 dari Rp 242.500, jatuh tempo 31 Agu 2026.");
  });

  it("handles missing customer, cashier and settle time", async () => {
    const call = await callWidgetTool(orderDetailTool, { sales_id: 7 }, {
      handlers: {
        "order.histories.legacy": legacyHandler(
          legacySale({
            customer: { id: 0, name: "", mobile: "" },
            user_settled: { id: 0, name: "", title: "" },
            created_by_name: "",
            settled_at: "",
            outlet_id: undefined,
            status: 4,
            installment: { period: "0", unit: "", date: "", total_installment: 1000, remaining_debt: 1000 },
          }),
        ),
      },
    });

    const data = orderDetailData.parse(call.structured);
    expect(data.customer).toBeNull();
    expect(data.cashier).toBeNull();
    expect(data.settled_at).toBeNull();
    // No sales.outlet_id: falls back to the session outlet.
    expect(data.outlet_id).toBe("645203");
    expect(data.credit).toEqual({ period: 0, unit: "", due_date: null, total: 1000, remaining: 1000 });
  });

  it("maps a malformed upstream payload to UPSTREAM_ERROR", async () => {
    const call = await callWidgetTool(orderDetailTool, { sales_id: 7 }, {
      handlers: { "order.histories.legacy": () => envelope({ sales: null }) },
    });

    expect(call.error).toEqual({ code: "UPSTREAM_ERROR", message: "Unexpected order.histories.legacy response" });
  });

  it("rejects non-positive sales ids", () => {
    expect(orderDetailInput.safeParse({ sales_id: 0 }).success).toBe(false);
    expect(orderDetailInput.safeParse({ sales_id: 1.5 }).success).toBe(false);
  });
});

describe("transaction tool definitions", () => {
  it("exports the three tools with their budgets and description rules", () => {
    expect(TRANSACTION_TOOLS.map((t) => [t.name, t.maxRequests, t.view ?? null])).toEqual([
      ["show_transactions", 2, "transaksi"],
      ["transactions_page", 1, null],
      ["order_detail", 1, null],
    ]);
    expect(transactionsTool.description.startsWith("Open an interactive")).toBe(true);
    expect(transactionsTool.description.length).toBeLessThanOrEqual(600);
    for (const tool of [transactionsPageTool, orderDetailTool]) {
      expect(tool.description.startsWith("Widget helper:")).toBe(true);
      expect(tool.description.length).toBeLessThanOrEqual(300);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test tests/unit/widgets-transactions.test.ts`
Expected: FAIL with `Error: Cannot find module '../../src/widgets/tools/transactions' imported from …/tests/unit/widgets-transactions.test.ts`.

- [ ] **Step 3: Implement `src/widgets/tools/transactions.ts`**

```ts
import { AppError, ErrorCodes, isAppErrorLike } from "../../errors/codes";
import {
  APP_TOOL,
  PAGE_SIZE,
  STRUCTURED_MAX_CHARS,
  VIEW_TOOL,
  orderDetailInput,
  salesStatusLabel,
  transactionsInput,
  transactionsPageInput,
  type ToolOutput,
} from "../contract";
import { assertDateRange, jakartaDateOf, parseIndonesianDate, parseQasirDateTime } from "../qasir-dates";
import { isRecord, toNumber, toNumberOrNull, toText } from "../qasir-values";
import type { AnyWidgetToolDef, ToolContext, WidgetToolDef } from "./define";
import { capRows, envelopeData, formatQty, indoDate, joinLines, nextPageOf, pageInfo, recordsAt, rupiah } from "./shared";

type TransactionDay = ToolOutput<"show_transactions">["days"][number];
type TransactionItem = TransactionDay["items"][number];
type PaymentModeTotal = ToolOutput<"show_transactions">["payment_mode_totals"][number];
type OrderDetail = ToolOutput<"order_detail">;

const TRUNCATED_REASON = "Baris terakhir dipangkas karena hasil melebihi 250 KB.";
/** Web status 3 = fully refunded; its amount never counts toward loaded totals. */
const STATUS_REFUND = 3;
/** Legacy status 4 = credit sale not fully paid; installment fields mean nothing otherwise. */
const STATUS_OPEN_CREDIT = 4;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

/** Trim days so the payload, measured with its truncation fields set, fits STRUCTURED_MAX_CHARS. */
function fitDays<P extends object>(days: TransactionDay[], build: (days: TransactionDay[]) => P): P & { truncated: boolean; truncated_reason: string | null } {
  const capped = capRows(days, STRUCTURED_MAX_CHARS, (kept) => ({ ...build(kept), truncated: true, truncated_reason: TRUNCATED_REASON }));
  return { ...build(capped.rows), truncated: capped.truncated, truncated_reason: capped.truncated ? TRUNCATED_REASON : null };
}

function projectItem(raw: Record<string, unknown>): TransactionItem {
  const status = toNumber(raw.status);
  return {
    sales_id: toNumber(raw.sales_id),
    time: toText(raw.date_time),
    invoice: toText(raw.invoice_number),
    payment_mode: toText(raw.payment_mode),
    amount: toNumber(raw.amount),
    status,
    status_label: salesStatusLabel(status),
    sales_type: toText(raw.sales_type_name),
  };
}

/**
 * order.histories.web `data.sales[]` → contract days. Staff (`settle_by`) and outlet names are
 * dropped; groups without a YYYY-MM-DD date and items without a sales_id are skipped.
 */
export function projectDays(data: Record<string, unknown>): TransactionDay[] {
  const days: TransactionDay[] = [];
  for (const group of recordsAt(data, "sales")) {
    const date = toText(group.date);
    if (!ISO_DAY.test(date)) continue;
    days.push({
      date: date.slice(0, 10),
      daily_amount: toNumber(group.daily_amount),
      items: recordsAt(group, "items")
        .map(projectItem)
        .filter((item) => item.sales_id > 0),
    });
  }
  return days;
}

interface WebPage {
  days: TransactionDay[];
  items: TransactionItem[];
  totalResult: number | null;
  nextPage: number | null;
}

/** One order.histories.web page (count 100). `data.agg` is ignored: it does not reconcile with rows. */
async function fetchWebPage(
  ctx: ToolContext,
  input: { start_date: string; end_date: string; customer_id?: number | undefined },
  outletId: string,
  page: number,
): Promise<WebPage> {
  const res = await ctx.request({
    operationId: "order.histories.web",
    query: {
      page,
      count: PAGE_SIZE.transactions,
      start_date: input.start_date,
      end_date: input.end_date,
      outlet_ids: outletId,
      ...(input.customer_id !== undefined ? { customer_id: input.customer_id } : {}),
    },
  });
  const days = projectDays(envelopeData(res, "order.histories.web"));
  const items = days.flatMap((day) => day.items);
  return {
    days,
    items,
    totalResult: pageInfo(res)?.totalResult ?? null,
    nextPage: nextPageOf(res, page, items.length, PAGE_SIZE.transactions),
  };
}

/** Sum of amounts, excluding fully refunded (status 3) rows. */
function amountOf(items: TransactionItem[]): number {
  return items.reduce((sum, item) => (item.status === STATUS_REFUND ? sum : sum + item.amount), 0);
}

/** Per payment mode: count of every loaded row, amount excluding status 3; largest amount first. */
function paymentModeTotals(items: TransactionItem[]): PaymentModeTotal[] {
  const byMode = new Map<string, PaymentModeTotal>();
  for (const item of items) {
    const entry = byMode.get(item.payment_mode) ?? { payment_mode: item.payment_mode, count: 0, amount: 0 };
    entry.count += 1;
    if (item.status !== STATUS_REFUND) entry.amount += item.amount;
    byMode.set(item.payment_mode, entry);
  }
  return [...byMode.values()].sort(
    (a, b) => b.amount - a.amount || b.count - a.count || a.payment_mode.localeCompare(b.payment_mode),
  );
}

function rangeLabel(start: string, end: string): string {
  return start === end ? indoDate(start) : `${indoDate(start)} – ${indoDate(end)}`;
}

/** customers.get fullname; an upstream failure (e.g. deleted customer) degrades to null. */
async function customerName(ctx: ToolContext, customerId: number): Promise<string | null> {
  try {
    const res = await ctx.request({ operationId: "customers.get", path: { customer_id: customerId } });
    const customer = envelopeData(res, "customers.get").customer;
    return isRecord(customer) ? toText(customer.fullname) || null : null;
  } catch (err) {
    if (isAppErrorLike(err) && err.code === ErrorCodes.UPSTREAM_ERROR) return null;
    throw err;
  }
}

export const transactionsTool: WidgetToolDef<typeof transactionsInput> = {
  name: VIEW_TOOL.transaksi,
  title: "Riwayat transaksi",
  description:
    "Open an interactive sales-transaction widget for a date range: transactions grouped by day with time, invoice, payment method, amount and status, plus a receipt detail per sale. Use it for today, this week, this month or the last 30 days, or for one customer's purchases (`customer_id`). Open (unpaid) credit sales are not listed; use the customer debts widget for those.",
  input: transactionsInput,
  maxRequests: 2,
  view: "transaksi",
  async run(input, ctx) {
    assertDateRange(input.start_date, input.end_date);
    const outletId = await ctx.outletId(input.outlet_id);
    const [page, name] = await Promise.all([
      fetchWebPage(ctx, input, outletId, 1),
      input.customer_id !== undefined ? customerName(ctx, input.customer_id) : Promise.resolve(null),
    ]);

    const loadedAmount = amountOf(page.items);
    const totals = paymentModeTotals(page.items);
    const build = (days: TransactionDay[]) => ({
      view: "transaksi" as const,
      ...ctx.meta(outletId),
      range: { start_date: input.start_date, end_date: input.end_date },
      customer: input.customer_id !== undefined ? { id: input.customer_id, name } : null,
      days,
      total_transactions: page.totalResult,
      loaded_transactions: page.items.length,
      loaded_amount: loadedAmount,
      payment_mode_totals: totals,
      next_page: page.nextPage,
    });
    const structured: ToolOutput<"show_transactions"> = fitDays(page.days, build);

    const total = page.totalResult ?? page.items.length;
    const text = joinLines([
      `Transaksi ${rangeLabel(input.start_date, input.end_date)} · outlet ${outletId}${input.customer_id !== undefined ? ` · pelanggan #${input.customer_id}` : ""}`,
      `Jumlah transaksi: ${total}.`,
      page.items.length === 0
        ? "Tidak ada transaksi pada rentang ini."
        : `Baris dimuat: ${page.items.length} transaksi, ${rupiah(loadedAmount)} (tanpa refund penuh).`,
      totals.length > 0 && "Per metode pembayaran (baris dimuat):",
      ...totals.slice(0, 8).map((t) => `- ${t.payment_mode || "Tanpa metode"}: ${t.count} transaksi · ${rupiah(t.amount)}`),
      page.nextPage !== null && "Masih ada transaksi lain; buka widget untuk memuat halaman berikutnya.",
    ]);
    return { text, structured };
  },
};

export const transactionsPageTool: WidgetToolDef<typeof transactionsPageInput> = {
  name: APP_TOOL.transactionsPage,
  title: "Halaman transaksi berikutnya",
  description: "Widget helper: loads one more page (100 rows) of day-grouped sales transactions for the transaksi view, with the same range and customer filter.",
  input: transactionsPageInput,
  maxRequests: 1,
  async run(input, ctx) {
    assertDateRange(input.start_date, input.end_date);
    const outletId = await ctx.outletId(input.outlet_id);
    const page = await fetchWebPage(ctx, input, outletId, input.page);
    const build = (days: TransactionDay[]) => ({ ...ctx.meta(outletId), page: input.page, days, next_page: page.nextPage });
    const structured: ToolOutput<"transactions_page"> = fitDays(page.days, build);
    const text = joinLines([
      `Halaman ${input.page} transaksi ${rangeLabel(input.start_date, input.end_date)}: ${page.items.length} transaksi, ${rupiah(amountOf(page.items))} (tanpa refund penuh).`,
      page.nextPage === null ? "Tidak ada halaman berikutnya." : `Halaman berikutnya: ${page.nextPage}.`,
    ]);
    return { text, structured };
  },
};

/** Legacy installment.date: "DD <Bulan> YYYY", or an ISO day; "" and zero dates → null. */
function dueDateOf(value: unknown): string | null {
  const text = toText(value);
  if (ISO_DAY.test(text)) return text.startsWith("0001-01-01") ? null : text.slice(0, 10);
  return parseIndonesianDate(text);
}

/** order.histories.legacy `data.sales` → contract detail (without payload meta). */
export function projectOrderDetail(sale: Record<string, unknown>, salesId: number): Omit<OrderDetail, "outlet_id" | "generated_at" | "truncated" | "truncated_reason"> {
  const status = toNumber(sale.status);
  const items = recordsAt(sale, "carts").map((cart) => {
    const variant = isRecord(cart.variant) ? cart.variant : {};
    const product = isRecord(variant.product) ? variant.product : {};
    return {
      product: toText(product.name),
      variant: toText(variant.variant_name) || null,
      quantity: toNumber(cart.quantity),
      price: toNumberOrNull(cart.price_sell_unit) ?? toNumber(cart.price_sell),
      total: toNumber(cart.total),
    };
  });
  const payments = recordsAt(sale, "payments").map((p) => ({
    name: toText(p.payment_name),
    mode: toText(p.payment_mode),
    amount: toNumber(p.amount),
    paid_at: parseQasirDateTime(p.paid_date),
  }));
  const rawCustomer = isRecord(sale.customer) ? sale.customer : null;
  const customerId = rawCustomer ? toNumber(rawCustomer.id) : 0;
  const installment = isRecord(sale.installment) ? sale.installment : null;
  const settled = isRecord(sale.user_settled) ? toText(sale.user_settled.name) : "";
  return {
    sales_id: toNumber(sale.id) || salesId,
    invoice: toText(sale.invoice_number),
    status,
    status_label: salesStatusLabel(status),
    settled_at: parseQasirDateTime(sale.settled_at),
    total_bill: toNumber(sale.total_bill),
    total_paid: toNumber(sale.total_paid),
    change: toNumber(sale.money_change),
    items,
    payments,
    customer:
      rawCustomer && customerId > 0
        ? { id: customerId, name: toText(rawCustomer.name), mobile: toText(rawCustomer.mobile) || null }
        : null,
    credit:
      status === STATUS_OPEN_CREDIT && installment
        ? {
            period: toNumberOrNull(installment.period),
            unit: toText(installment.unit),
            due_date: dueDateOf(installment.date),
            total: toNumber(installment.total_installment),
            remaining: toNumber(installment.remaining_debt),
          }
        : null,
    cashier: settled || toText(sale.created_by_name) || null,
  };
}

export const orderDetailTool: WidgetToolDef<typeof orderDetailInput> = {
  name: APP_TOOL.orderDetail,
  title: "Rincian transaksi",
  description: "Widget helper: receipt detail of one sale (items, payments, customer, credit status, cashier) for the transaksi and piutang views.",
  input: orderDetailInput,
  maxRequests: 1,
  async run(input, ctx) {
    const res = await ctx.request({ operationId: "order.histories.legacy", path: { sales_id: input.sales_id } });
    const sale = envelopeData(res, "order.histories.legacy").sales;
    if (!isRecord(sale)) throw new AppError(ErrorCodes.UPSTREAM_ERROR, "Unexpected order.histories.legacy response");
    const detail = projectOrderDetail(sale, input.sales_id);
    const outletId = toText(sale.outlet_id) || (await ctx.outletId());
    const structured: OrderDetail = { ...ctx.meta(outletId), ...detail };

    const settled = detail.settled_at ? ` · ${indoDate(jakartaDateOf(detail.settled_at))}` : "";
    const text = joinLines([
      `Nota ${detail.invoice || `#${detail.sales_id}`} · ${detail.status_label}${settled}`,
      `Total ${rupiah(detail.total_bill)} · dibayar ${rupiah(detail.total_paid)} · kembalian ${rupiah(detail.change)}`,
      `${detail.items.length} item:`,
      ...detail.items.slice(0, 10).map((item) => `- ${item.product}${item.variant ? ` (${item.variant})` : ""} × ${formatQty(item.quantity)} = ${rupiah(item.total)}`),
      detail.items.length > 10 && `…dan ${detail.items.length - 10} item lainnya.`,
      detail.payments.length > 0 && `Pembayaran: ${detail.payments.map((p) => `${p.name || p.mode} ${rupiah(p.amount)}`).join(", ")}`,
      detail.credit &&
        `Kredit belum lunas: sisa ${rupiah(detail.credit.remaining)} dari ${rupiah(detail.credit.total)}${detail.credit.due_date ? `, jatuh tempo ${indoDate(detail.credit.due_date)}` : ""}.`,
    ]);
    return { text, structured };
  },
};

export const TRANSACTION_TOOLS: readonly AnyWidgetToolDef[] = [transactionsTool, transactionsPageTool, orderDetailTool];
```

- [ ] **Step 4: Run the tests and types**

Run: `bun run test tests/unit/widgets-transactions.test.ts && bun run check-types`
Expected: `Test Files  1 passed (1)`, `Tests  15 passed (15)`; `tsc` exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/tools/transactions.ts tests/unit/widgets-transactions.test.ts
git commit -m "feat(widgets): transaction view, pager and order detail tools

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Debt tools (piutang)

**Files:**
- Create: `src/widgets/tools/debts.ts`
- Test: `tests/unit/widgets-debts.test.ts`

**Interfaces:**
- Consumes:
  - `src/widgets/contract.ts` (T1): `AGING_BUCKET_KEYS`, `AGING_BUCKET_LABEL`, `APP_TOOL`, `VIEW_TOOL`, `CUSTOMER_INSTALLMENT_MAX_PAGES` (3), `DEBT_DETAIL_MAX_INVOICES` (40), `DEBT_SCAN_START_DATE`, `INSTALLMENT_MAX_PAGES` (12), `PAGE_SIZE.installments` (100), `STRUCTURED_MAX_CHARS`, `customerDebtsInput`, `customerDebtDetailInput`, `customerDebtsData`, `customerDebtDetailData`, `type AgingBucketKey`, `type ToolOutput`.
  - `src/widgets/qasir-dates.ts` (T1): `agingBucket`, `bucketSaleDateRange`, `daysBetween`, `jakartaDateOf`, `parseIndonesianDate`, `parseQasirDateTime`.
  - `src/widgets/qasir-values.ts` (T1): `isRecord`, `toNumber`, `toText`.
  - `src/widgets/tools/define.ts` (T2): `WidgetToolDef`, `AnyWidgetToolDef`, `ToolContext` (`ctx.today`, `ctx.outletId()`, `ctx.request()` resolving to `DispatchResult.data`, `ctx.meta()`).
  - `src/widgets/tools/shared.ts` (T2): `capRows`, `envelopeData`, `indoDate`, `isUpstream404`, `joinLines`, `pageInfo`, `recordsAt`, `rupiah`.
  - `tests/stubs/widget-harness.ts` (T2): `callWidgetTool`, `envelope`. `tests/stubs/codemode-harness.ts`: `FixtureHandler`.
  - Upstream operations (registry schemas in `src/registry/ops/catalog.ts` and `reports.ts`):
    - `order.histories.installment`: query `{ page, count, start_date, end_date, outlet_ids, customer_id? }`
    - `reports.summaries.installment`: query `{ start_date, end_date, outlet_ids }`
    - `order.histories.legacy`: path `{ sales_id }`
    - `customers.get`: path `{ customer_id }`
- Produces:
  - `export const customerDebtsTool: WidgetToolDef<typeof customerDebtsInput>`: name `show_customer_debts`, view `piutang`, `maxRequests` 20.
  - `export const customerDebtDetailTool: WidgetToolDef<typeof customerDebtDetailInput>`: name `customer_debt_detail`, app-only, `maxRequests` 45.
  - `export const DEBT_TOOLS: readonly AnyWidgetToolDef[]` = `[customerDebtsTool, customerDebtDetailTool]` (consumed by T11).

**Behaviour this task pins (spec §2 "Qasir data", §4.2 item 6):**
- **Installment scan.** `order.histories.installment` holds only open credit (status 4). Each page returns count+1 rows, and its totals are lower bounds.
  - Page from `2015-01-01` to Jakarta today with `count: 100`. Follow `pagination.next` until it is absent or a page is empty, stopping after the page cap (12, or 3 for one customer).
  - Dedupe by `sales_id`.
  - `capped` means the last allowed page still had `next`; it sets `truncated`.
- **Row fields.** The sale date comes from `sales[].date` (`"YYYY-MM-DD HH:MM:SS"`, Jakarta local) via `parseQasirDateTime` then `jakartaDateOf`. Other fields:
  - The row amount is `items[].amount`. Never use `sales[].total_amount`, which is a per-day total.
  - `due_date` is parsed with `parseIndonesianDate` (`""` becomes `null`).
- **Buckets.** Aging is by sale age in days. Each bucket's `receivable` is `total_receivable` from its own `reports.summaries.installment` call, over the sale-date range from `bucketSaleDateRange`.
  - `summary.receivable_total` is the sum of the seven bucket receivables.
  - Invoice, customer and credit counts come from the scanned list.
- **Overdue.** An invoice is overdue when `due_date < today`. `nearest_due_date` is the customer's earliest due date. `max_days_overdue` is the largest `today − due_date` (0 when nothing is overdue).
- **Default customer order.** Customers with overdue invoices come first, then `credit_total` descending, then `customer_id` ascending.
- **Text.**
  - `show_customer_debts` lists the top 5 customers by `credit_total`, with digit runs that look like phone numbers scrubbed out of their names.
  - `customer_debt_detail` text carries neither the name nor the phone number.
- **Detail.**
  - `remaining = installment.remaining_debt` only when `status === 4`; otherwise it is 0, because on paid-off sales the field holds −change. `paid = total_paid`, and `total = installment.total_installment`, falling back to the list amount.
  - `days_overdue` is `null` when nothing remains or there is no due date.
  - Zero-amount placeholder payments are dropped.
  - The oldest 40 open sales get receipts; the rest set `truncated`.
  - A `customers.get` "Upstream 404" falls back to the list name.
- **Budgets.** `show_customer_debts` needs at most 12 list pages + 7 summaries = 19 requests, within its 20. `customer_debt_detail` needs at most 3 list pages + 1 `customers.get` + 40 receipts = 44, within its 45. Both worst cases are tested.

- [ ] **Step 1: Write the failing debt tool tests**

All fixtures are synthetic: names like "Pelanggan A" and phones like "0800-0000-0001". The clock is fixed at 2026-09-15 10:00 Jakarta.

`tests/unit/widgets-debts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { DispatchRequest } from "../../src/dispatcher/qasir-dispatcher";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import { STRUCTURED_MAX_CHARS, customerDebtDetailData, customerDebtsData } from "../../src/widgets/contract";
import { customerDebtDetailTool, customerDebtsTool, DEBT_TOOLS } from "../../src/widgets/tools/debts";
import type { FixtureHandler } from "../stubs/codemode-harness";
import { callWidgetTool, envelope } from "../stubs/widget-harness";

// Fixed clock: 2026-09-15T03:00Z is 10:00 on 15 Sep 2026 in Jakarta.
const NOW = new Date("2026-09-15T03:00:00Z");

interface CreditSale {
  sales_id: number;
  customer_id: number;
  customer_name: string;
  /** Dashboard local time, "YYYY-MM-DD HH:MM:SS". */
  date: string;
  /** "DD <Bulan> YYYY" or "". */
  due: string;
  amount: number;
}

/** One order.histories.installment sales[] group (always exactly one item upstream). */
function group(sale: CreditSale): Record<string, unknown> {
  return {
    date: sale.date,
    total_amount: sale.amount * 3, // per-day total upstream; must never be used as the row amount
    items: [
      {
        sales_id: sale.sales_id,
        customer_id: sale.customer_id,
        customer_name: sale.customer_name,
        due_date: sale.due,
        amount: sale.amount,
        date_time: sale.due,
        time: sale.date.slice(11, 16),
        invoice_number: `INV-${sale.sales_id}`,
        outlet_name: "Outlet Contoh",
        status_order: "",
      },
    ],
  };
}

function installmentPage(page: number, sales: CreditSale[], hasNext: boolean): Record<string, unknown> {
  return envelope(
    { sales: sales.map(group) },
    {
      current_page: page,
      total_page: page + (hasNext ? 1 : 0),
      total_result: page * 101,
      ...(hasNext ? { next: `/api/v5/order/histories/installment?page=${page + 1}` } : {}),
    },
  );
}

const A1: CreditSale = { sales_id: 1001, customer_id: 11, customer_name: "Pelanggan A", date: "2026-09-12 13:27:33", due: "12 Oktober 2026", amount: 500_000 };
const A2: CreditSale = { sales_id: 1002, customer_id: 11, customer_name: "Pelanggan A", date: "2026-08-01 09:00:00", due: "31 Agustus 2026", amount: 250_000 };
const B1: CreditSale = { sales_id: 1003, customer_id: 12, customer_name: "Pelanggan B 0800-0000-0002", date: "2025-06-01 10:00:00", due: "01 Juli 2025", amount: 1_000_000 };
// 00:30 Jakarta on 8 Sep is still 7 Sep in UTC: the sale must land in 0–7 hari, not 8–30.
const C1: CreditSale = { sales_id: 1004, customer_id: 13, customer_name: "Pelanggan C", date: "2026-09-08 00:30:00", due: "", amount: 2_000_000 };
const D1: CreditSale = { sales_id: 1005, customer_id: 14, customer_name: "Pelanggan D", date: "2016-03-10 08:00:00", due: "10 April 2016", amount: 75_000 };

/** Receivable per bucket, keyed by the bucket's sale-date start. */
const RECEIVABLE_BY_START: Record<string, number> = {
  "2026-09-08": 2_400_000,
  "2026-06-17": 200_000,
  "2024-09-15": 900_000,
  "2015-01-01": 75_000,
};

function summaryHandler(): FixtureHandler {
  return (req) => {
    const start = String(req.query?.start_date);
    const receivable = RECEIVABLE_BY_START[start] ?? 0;
    return envelope({ total_customer: receivable > 0 ? 1 : 0, total_down_payment: 0, total_receivable: receivable });
  };
}

function queriesFor(calls: Array<{ req: DispatchRequest }>, operationId: string) {
  return calls.filter((c) => c.req.operationId === operationId).map((c) => c.req.query ?? {});
}

describe("show_customer_debts", () => {
  const pages: Record<number, Record<string, unknown>> = {
    // B1 appears on both pages (row shifted across the page boundary): counted once.
    1: installmentPage(1, [A1, A2, B1], true),
    2: installmentPage(2, [B1, C1, D1], false),
  };
  const handlers: Record<string, FixtureHandler> = {
    "order.histories.installment": (req) => pages[Number(req.query?.page)] ?? installmentPage(3, [], false),
    "reports.summaries.installment": summaryHandler(),
  };

  it("pages the installment list from 2015-01-01 to Jakarta today and asks one summary per aging bucket", async () => {
    const { dispatcher, error } = await callWidgetTool(customerDebtsTool, {}, { handlers, now: NOW });
    expect(error).toBeUndefined();
    expect(queriesFor(dispatcher.calls, "order.histories.installment")).toEqual([
      { page: 1, count: 100, start_date: "2015-01-01", end_date: "2026-09-15", outlet_ids: "645203" },
      { page: 2, count: 100, start_date: "2015-01-01", end_date: "2026-09-15", outlet_ids: "645203" },
    ]);
    const summaryRanges = queriesFor(dispatcher.calls, "reports.summaries.installment")
      .map((q) => `${q.start_date}..${q.end_date}`)
      .sort();
    expect(summaryRanges).toEqual(
      [
        "2026-09-08..2026-09-15",
        "2026-08-16..2026-09-07",
        "2026-06-17..2026-08-15",
        "2026-03-19..2026-06-16",
        "2025-09-15..2026-03-18",
        "2024-09-15..2025-09-14",
        "2015-01-01..2024-09-14",
      ].sort(),
    );
    for (const call of dispatcher.calls) expect(call.opts?.allowMutation).toBeUndefined();
  });

  it("builds buckets, summary and overdue-first customers that parse with the contract", async () => {
    const { structured } = await callWidgetTool(customerDebtsTool, {}, { handlers, now: NOW });
    const data = customerDebtsData.parse(structured);
    expect(data).toMatchObject({ view: "piutang", outlet_id: "645203", as_of: "2026-09-15", truncated: false, truncated_reason: null, focus_customer_id: null });
    expect(data.generated_at).toBe(NOW.toISOString());
    expect(data.buckets.map((b) => [b.key, b.invoices, b.customers, b.credit_total, b.receivable])).toEqual([
      ["0-7", 2, 2, 2_500_000, 2_400_000],
      ["8-30", 0, 0, 0, 0],
      ["31-90", 1, 1, 250_000, 200_000],
      ["91-180", 0, 0, 0, 0],
      ["181-365", 0, 0, 0, 0],
      ["366-730", 1, 1, 1_000_000, 900_000],
      ["gt-730", 1, 1, 75_000, 75_000],
    ]);
    expect(data.buckets[0]!.label).toBe("0–7 hari");
    expect(data.summary).toEqual({
      receivable_total: 3_575_000,
      customers: 4,
      open_invoices: 5,
      credit_total: 3_825_000,
      overdue_invoices: 3,
      overdue_customers: 3,
    });
    expect(data.customers).toEqual([
      { customer_id: 12, name: "Pelanggan B 0800-0000-0002", invoices: 1, credit_total: 1_000_000, oldest_sale_date: "2025-06-01", oldest_bucket: "366-730", nearest_due_date: "2025-07-01", overdue_invoices: 1, max_days_overdue: 441 },
      { customer_id: 11, name: "Pelanggan A", invoices: 2, credit_total: 750_000, oldest_sale_date: "2026-08-01", oldest_bucket: "31-90", nearest_due_date: "2026-08-31", overdue_invoices: 1, max_days_overdue: 15 },
      { customer_id: 14, name: "Pelanggan D", invoices: 1, credit_total: 75_000, oldest_sale_date: "2016-03-10", oldest_bucket: "gt-730", nearest_due_date: "2016-04-10", overdue_invoices: 1, max_days_overdue: 3810 },
      { customer_id: 13, name: "Pelanggan C", invoices: 1, credit_total: 2_000_000, oldest_sale_date: "2026-09-08", oldest_bucket: "0-7", nearest_due_date: null, overdue_invoices: 0, max_days_overdue: 0 },
    ]);
  });

  it("summarizes in Indonesian with the top 5 customers by credit and no phone numbers", async () => {
    const { text, result } = await callWidgetTool(customerDebtsTool, {}, { handlers, now: NOW });
    expect(result.content).toHaveLength(1);
    expect(text.length).toBeLessThanOrEqual(2_000);
    expect(text).toContain("Sisa piutang (laporan Qasir): Rp 3.575.000");
    expect(text).toContain("4 pelanggan, 5 nota kredit terbuka");
    expect(text).toContain("Lewat jatuh tempo: 3 nota dari 3 pelanggan");
    expect(text).toContain("- 0–7 hari: Rp 2.400.000 (2 nota)");
    const ranking = text.split("\n").filter((line) => /^\d\. /.test(line));
    expect(ranking.map((line) => line.split(":")[0])).toEqual(["1. Pelanggan C", "2. Pelanggan B …", "3. Pelanggan A", "4. Pelanggan D"]);
    expect(text).not.toMatch(/0800/);
  });

  it("marks the focus customer from input and uses an explicit outlet", async () => {
    const { structured, text, dispatcher } = await callWidgetTool(
      customerDebtsTool,
      { customer_id: 11, outlet_id: "777" },
      { handlers, now: NOW },
    );
    const data = customerDebtsData.parse(structured);
    expect(data.focus_customer_id).toBe(11);
    expect(data.outlet_id).toBe("777");
    for (const call of dispatcher.calls) expect(call.req.query?.outlet_ids).toBe("777");
    expect(text).toContain("Pelanggan #11: 2 nota terbuka, nilai kredit Rp 750.000.");
  });

  it("follows next through count+1 pages and stops at the page cap with truncated set, within budget", async () => {
    const customerNames = Array.from({ length: 30 }, (_, i) => `Pelanggan ${i + 1}`);
    const endless: FixtureHandler = (req) => {
      const page = Number(req.query?.page);
      // count=100 returns 101 rows, every page has a next link.
      const sales = Array.from({ length: 101 }, (_, i) => ({
        sales_id: page * 1_000 + i,
        customer_id: 100 + (i % 30),
        customer_name: customerNames[i % 30]!,
        date: "2026-09-01 10:00:00",
        due: "01 Oktober 2026",
        amount: 10_000,
      }));
      return installmentPage(page, sales, true);
    };
    const { structured, dispatcher, error } = await callWidgetTool(customerDebtsTool, {}, {
      handlers: { "order.histories.installment": endless, "reports.summaries.installment": summaryHandler() },
      now: NOW,
    });
    expect(error).toBeUndefined();
    expect(queriesFor(dispatcher.calls, "order.histories.installment").map((q) => q.page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(dispatcher.calls).toHaveLength(19);
    const data = customerDebtsData.parse(structured);
    expect(data.summary.open_invoices).toBe(12 * 101);
    expect(data.summary.customers).toBe(30);
    expect(data.truncated).toBe(true);
    expect(data.truncated_reason).toContain("12 halaman");
  });

  it("stops paging when a page is empty even if upstream still sends next", async () => {
    const { dispatcher, structured } = await callWidgetTool(customerDebtsTool, {}, {
      handlers: {
        "order.histories.installment": (req) =>
          Number(req.query?.page) === 1 ? installmentPage(1, [A1], true) : installmentPage(2, [], true),
        "reports.summaries.installment": summaryHandler(),
      },
      now: NOW,
    });
    expect(queriesFor(dispatcher.calls, "order.histories.installment")).toHaveLength(2);
    expect(customerDebtsData.parse(structured).truncated).toBe(false);
  });

  it("trims customers from the tail to stay under the structured cap", async () => {
    const longName = (id: number) => `Pelanggan ${id} ${"x".repeat(180)}`;
    const handler: FixtureHandler = (req) => {
      const page = Number(req.query?.page);
      const sales = Array.from({ length: 101 }, (_, i) => {
        const id = page * 1_000 + i;
        return { sales_id: id, customer_id: id, customer_name: longName(id), date: "2026-09-01 10:00:00", due: "", amount: 5_000 };
      });
      return installmentPage(page, sales, page < 7);
    };
    const { structured, error } = await callWidgetTool(customerDebtsTool, {}, {
      handlers: { "order.histories.installment": handler, "reports.summaries.installment": summaryHandler() },
      now: NOW,
    });
    expect(error).toBeUndefined();
    const data = customerDebtsData.parse(structured);
    expect(JSON.stringify(structured).length).toBeLessThanOrEqual(STRUCTURED_MAX_CHARS);
    expect(data.summary.customers).toBe(707);
    expect(data.customers.length).toBeLessThan(707);
    expect(data.truncated).toBe(true);
    expect(data.truncated_reason).toContain("Daftar pelanggan dipotong");
  });

  it("maps an expired Qasir session to QASIR_AUTH_EXPIRED with the connect URL", async () => {
    const { error, structured } = await callWidgetTool(customerDebtsTool, {}, {
      handlers: {
        "order.histories.installment": () => {
          throw new AppError(ErrorCodes.QASIR_AUTH_EXPIRED, "Qasir session expired");
        },
        "reports.summaries.installment": summaryHandler(),
      },
      now: NOW,
    });
    expect(structured).toBeUndefined();
    expect(error).toEqual({ code: "QASIR_AUTH_EXPIRED", message: "Qasir session expired", connect_url: "https://mcp.example.test/connect" });
  });
});

describe("customer_debt_detail", () => {
  // Sale 1006 was paid off after the list was read: legacy status 2, remaining_debt is -change.
  const PAID_OFF: CreditSale = { sales_id: 1006, customer_id: 11, customer_name: "Pelanggan A", date: "2026-07-01 10:00:00", due: "31 Juli 2026", amount: 300_000 };
  const LEGACY: Record<number, Record<string, unknown>> = {
    1001: {
      id: 1001,
      status: 4,
      invoice_number: "INV-1001",
      total_bill: "500000.00",
      total_paid: 100_000,
      settled_at: "2026-09-12 13:27:33",
      installment: { period: "30", unit: "DAY", date: "12 Oktober 2026", total_installment: 500_000, remaining_debt: 400_000 },
      payments: [
        { payment_mode: "CASH", payment_name: "TUNAI", amount: 0, paid_date: "2026-09-12 13:27:33" },
        { payment_mode: "TRANSFER", payment_name: "Transfer", amount: 100_000, paid_date: "2026-09-14 10:00:00" },
      ],
      customer: { id: 11, name: "Pelanggan A", mobile: "0800-0000-0001" },
    },
    1002: {
      id: 1002,
      status: 4,
      invoice_number: "INV-1002",
      total_bill: "250000.00",
      total_paid: 0,
      installment: { period: "30", unit: "DAY", date: "31 Agustus 2026", total_installment: 250_000, remaining_debt: 250_000 },
      payments: [{ payment_mode: "CASH", payment_name: "TUNAI", amount: 0, paid_date: "2026-08-01 09:00:00" }],
      customer: { id: 11, name: "Pelanggan A", mobile: "0800-0000-0001" },
    },
    1006: {
      id: 1006,
      status: 2,
      is_installment_completed: true,
      invoice_number: "INV-1006",
      total_bill: "300000.00",
      total_paid: 330_000,
      installment: { period: "0", unit: "", date: "", total_installment: 300_000, remaining_debt: -30_000 },
      payments: [
        { payment_mode: "CASH", payment_name: "TUNAI", amount: 0, paid_date: "2026-07-01 10:00:00" },
        { payment_mode: "CASH", payment_name: "TUNAI", amount: 330_000, paid_date: "2026-09-10 11:00:00" },
      ],
      customer: { id: 11, name: "Pelanggan A", mobile: "0800-0000-0001" },
    },
  };
  const handlers: Record<string, FixtureHandler> = {
    "order.histories.installment": () => installmentPage(1, [A1, A2, PAID_OFF], false),
    "order.histories.legacy": (req) => envelope({ sales: LEGACY[Number(req.path?.sales_id)] }),
    "customers.get": () => envelope({ customer: { id: 11, fullname: "Pelanggan A", mobile: "0800-0000-0001" } }),
  };

  it("filters the installment list by customer and loads one receipt per open sale plus the profile", async () => {
    const { dispatcher, error } = await callWidgetTool(customerDebtDetailTool, { customer_id: 11 }, { handlers, now: NOW });
    expect(error).toBeUndefined();
    expect(queriesFor(dispatcher.calls, "order.histories.installment")).toEqual([
      { page: 1, count: 100, start_date: "2015-01-01", end_date: "2026-09-15", outlet_ids: "645203", customer_id: 11 },
    ]);
    expect(dispatcher.calls.filter((c) => c.req.operationId === "order.histories.legacy").map((c) => c.req.path?.sales_id).sort()).toEqual([1001, 1002, 1006]);
    expect(dispatcher.calls.filter((c) => c.req.operationId === "customers.get").map((c) => c.req.path)).toEqual([{ customer_id: 11 }]);
    expect(dispatcher.calls).toHaveLength(5);
  });

  it("reads remaining only from status-4 receipts, paid from total_paid, and drops zero placeholder payments", async () => {
    const { structured } = await callWidgetTool(customerDebtDetailTool, { customer_id: 11 }, { handlers, now: NOW });
    const data = customerDebtDetailData.parse(structured);
    expect(data.customer).toEqual({ id: 11, name: "Pelanggan A", mobile: "0800-0000-0001" });
    expect(data.invoices).toEqual([
      { sales_id: 1006, invoice: "INV-1006", sale_date: "2026-07-01", due_date: "2026-07-31", days_overdue: null, bucket: "31-90", total: 300_000, paid: 330_000, remaining: 0, payments: [{ name: "TUNAI", amount: 330_000, paid_at: "2026-09-10T04:00:00.000Z" }] },
      { sales_id: 1002, invoice: "INV-1002", sale_date: "2026-08-01", due_date: "2026-08-31", days_overdue: 15, bucket: "31-90", total: 250_000, paid: 0, remaining: 250_000, payments: [] },
      { sales_id: 1001, invoice: "INV-1001", sale_date: "2026-09-12", due_date: "2026-10-12", days_overdue: 0, bucket: "0-7", total: 500_000, paid: 100_000, remaining: 400_000, payments: [{ name: "Transfer", amount: 100_000, paid_at: "2026-09-14T03:00:00.000Z" }] },
    ]);
    expect(data.totals).toEqual({ total: 1_050_000, paid: 430_000, remaining: 650_000 });
    expect(data).toMatchObject({ outlet_id: "645203", truncated: false, truncated_reason: null });
  });

  it("text carries totals but neither the customer's name nor phone", async () => {
    const { text } = await callWidgetTool(customerDebtDetailTool, { customer_id: 11 }, { handlers, now: NOW });
    expect(text).toContain("3 nota kredit terbuka");
    expect(text).toContain("sisa Rp 650.000");
    expect(text).toContain("Lewat jatuh tempo: 1 nota, terlama 15 hari.");
    expect(text).not.toContain("Pelanggan A");
    expect(text).not.toMatch(/0800/);
  });

  it("falls back to the list name when the customer profile is gone (upstream 404)", async () => {
    const { structured } = await callWidgetTool(customerDebtDetailTool, { customer_id: 11 }, {
      handlers: {
        ...handlers,
        "customers.get": () => {
          throw new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream 404");
        },
      },
      now: NOW,
    });
    expect(customerDebtDetailData.parse(structured).customer).toEqual({ id: 11, name: "Pelanggan A", mobile: "0800-0000-0001" });
  });

  it("caps pages and receipts in the worst case and still fits the 45-request budget", async () => {
    const pageOf: FixtureHandler = (req) => {
      const page = Number(req.query?.page);
      const sales = Array.from({ length: 101 }, (_, i) => ({
        sales_id: page * 1_000 + i,
        customer_id: 11,
        customer_name: "Pelanggan A",
        // Older sales on later pages, like upstream (date descending).
        date: `20${String(25 - page).padStart(2, "0")}-01-${String(28 - (i % 28)).padStart(2, "0")} 10:00:00`,
        due: "",
        amount: 1_000,
      }));
      return installmentPage(page, sales, true);
    };
    const receipt: FixtureHandler = (req) =>
      envelope({
        sales: {
          id: req.path?.sales_id,
          status: 4,
          invoice_number: `INV-${req.path?.sales_id}`,
          total_paid: 0,
          installment: { total_installment: 1_000, remaining_debt: 1_000, date: "" },
          payments: [],
        },
      });
    const { structured, dispatcher, error } = await callWidgetTool(customerDebtDetailTool, { customer_id: 11 }, {
      handlers: {
        "order.histories.installment": pageOf,
        "order.histories.legacy": receipt,
        "customers.get": () => envelope({ customer: { id: 11, fullname: "Pelanggan A", mobile: "" } }),
      },
      now: NOW,
    });
    expect(error).toBeUndefined();
    expect(dispatcher.calls).toHaveLength(3 + 1 + 40);
    const data = customerDebtDetailData.parse(structured);
    expect(data.invoices).toHaveLength(40);
    // The oldest open sales come from the last page scanned.
    expect(data.invoices.every((inv) => inv.sales_id >= 3_000)).toBe(true);
    expect(data.customer.mobile).toBeNull();
    expect(data.truncated).toBe(true);
    expect(data.truncated_reason).toContain("3 halaman");
    expect(data.truncated_reason).toContain("40 nota tertua dari 303");
  });

  it("returns an empty, valid payload when the customer has no open credit", async () => {
    const { structured, text, dispatcher } = await callWidgetTool(customerDebtDetailTool, { customer_id: 99 }, {
      handlers: {
        "order.histories.installment": () => envelope({ sales: [] }),
        "customers.get": () => envelope({ customer: { id: 99, fullname: "Pelanggan Z", mobile: "0800-0000-0009" } }),
      },
      now: NOW,
    });
    const data = customerDebtDetailData.parse(structured);
    expect(data.invoices).toEqual([]);
    expect(data.totals).toEqual({ total: 0, paid: 0, remaining: 0 });
    expect(text).toContain("tidak punya nota kredit terbuka");
    expect(dispatcher.calls.map((c) => c.req.operationId).sort()).toEqual(["customers.get", "order.histories.installment"]);
  });
});

describe("debt tool registration metadata", () => {
  it("exports both tools with their budgets and description rules", () => {
    expect(DEBT_TOOLS.map((t) => [t.name, t.maxRequests, t.view ?? null])).toEqual([
      ["show_customer_debts", 20, "piutang"],
      ["customer_debt_detail", 45, null],
    ]);
    expect(customerDebtsTool.description.startsWith("Open an interactive")).toBe(true);
    expect(customerDebtsTool.description.length).toBeLessThanOrEqual(600);
    expect(customerDebtDetailTool.description.startsWith("Widget helper:")).toBe(true);
    expect(customerDebtDetailTool.description.length).toBeLessThanOrEqual(300);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test tests/unit/widgets-debts.test.ts`
Expected: FAIL with `Error: Cannot find module '../../src/widgets/tools/debts' imported from …/tests/unit/widgets-debts.test.ts`.

- [ ] **Step 3: Implement `src/widgets/tools/debts.ts`**

```ts
import { AppError, ErrorCodes } from "../../errors/codes";
import {
  AGING_BUCKET_KEYS,
  AGING_BUCKET_LABEL,
  APP_TOOL,
  CUSTOMER_INSTALLMENT_MAX_PAGES,
  DEBT_DETAIL_MAX_INVOICES,
  DEBT_SCAN_START_DATE,
  INSTALLMENT_MAX_PAGES,
  PAGE_SIZE,
  STRUCTURED_MAX_CHARS,
  VIEW_TOOL,
  customerDebtDetailInput,
  customerDebtsInput,
  type AgingBucketKey,
  type ToolOutput,
} from "../contract";
import {
  agingBucket,
  bucketSaleDateRange,
  daysBetween,
  jakartaDateOf,
  parseIndonesianDate,
  parseQasirDateTime,
} from "../qasir-dates";
import { isRecord, toNumber, toText } from "../qasir-values";
import type { AnyWidgetToolDef, ToolContext, WidgetToolDef } from "./define";
import { capRows, envelopeData, indoDate, isUpstream404, joinLines, pageInfo, recordsAt, rupiah } from "./shared";

type DebtCustomer = ToolOutput<"show_customer_debts">["customers"][number];
type DebtInvoice = ToolOutput<"customer_debt_detail">["invoices"][number];

/** One open credit sale from order.histories.installment (status 4 only upstream). */
interface OpenCredit {
  sales_id: number;
  customer_id: number;
  customer_name: string;
  invoice: string;
  /** Jakarta calendar date of the sale (sales[].date is dashboard local time). */
  sale_date: string;
  due_date: string | null;
  /** items[].amount = installment.total_installment (the credit value, not what is still owed). */
  amount: number;
}

/**
 * Flatten one installment page. Each sales[] group holds one item; group
 * total_amount is a per-day total and is ignored. Rows without a sales_id or a
 * parseable sale date are skipped.
 */
function parseInstallmentPage(res: unknown): OpenCredit[] {
  const data = envelopeData(res, "order.histories.installment");
  const rows: OpenCredit[] = [];
  for (const group of recordsAt(data, "sales")) {
    const saleAt = parseQasirDateTime(group.date);
    if (!saleAt) continue;
    const sale_date = jakartaDateOf(saleAt);
    for (const item of recordsAt(group, "items")) {
      const sales_id = toNumber(item.sales_id);
      if (!Number.isSafeInteger(sales_id) || sales_id <= 0) continue;
      rows.push({
        sales_id,
        customer_id: toNumber(item.customer_id),
        customer_name: toText(item.customer_name),
        invoice: toText(item.invoice_number),
        sale_date,
        due_date: parseIndonesianDate(item.due_date),
        amount: toNumber(item.amount),
      });
    }
  }
  return rows;
}

/**
 * Page order.histories.installment from DEBT_SCAN_START_DATE to today. Upstream
 * returns count+1 rows per page and lower-bound totals, so follow
 * pagination.next until it is absent (or a page is empty), dedupe by sales_id,
 * and stop after maxPages. `capped` is true when the last allowed page still
 * had a next link.
 */
async function scanOpenCredit(
  ctx: ToolContext,
  outletId: string,
  maxPages: number,
  customerId?: number,
): Promise<{ rows: OpenCredit[]; capped: boolean }> {
  const bySale = new Map<number, OpenCredit>();
  for (let page = 1; page <= maxPages; page++) {
    const res = await ctx.request({
      operationId: "order.histories.installment",
      query: {
        page,
        count: PAGE_SIZE.installments,
        start_date: DEBT_SCAN_START_DATE,
        end_date: ctx.today,
        outlet_ids: outletId,
        ...(customerId !== undefined ? { customer_id: customerId } : {}),
      },
    });
    const rows = parseInstallmentPage(res);
    for (const row of rows) if (!bySale.has(row.sales_id)) bySale.set(row.sales_id, row);
    if (pageInfo(res)?.hasNext !== true || rows.length === 0) return { rows: [...bySale.values()], capped: false };
  }
  return { rows: [...bySale.values()], capped: true };
}

/** reports.summaries.installment total_receivable for the sale dates of one aging bucket. */
async function bucketReceivable(ctx: ToolContext, outletId: string, bucket: AgingBucketKey): Promise<number> {
  const range = bucketSaleDateRange(bucket, ctx.today);
  const res = await ctx.request({
    operationId: "reports.summaries.installment",
    query: { start_date: range.start_date, end_date: range.end_date, outlet_ids: outletId },
  });
  return toNumber(envelopeData(res, "reports.summaries.installment").total_receivable);
}

function saleAgeBucket(row: OpenCredit, today: string): AgingBucketKey {
  return agingBucket(daysBetween(row.sale_date, today));
}

function daysOverdue(dueDate: string | null, today: string): number {
  return dueDate === null ? 0 : Math.max(0, daysBetween(dueDate, today));
}

/** Customer names can carry merchant-typed phone numbers; text blocks never show them. */
function textSafeName(name: string): string {
  return name.replace(/\+?\d[\d\s.-]{6,}\d/g, "…");
}

function customerLabel(name: string, id: number): string {
  return name || `Pelanggan #${id}`;
}

function aggregateCustomers(rows: OpenCredit[], today: string): DebtCustomer[] {
  const byCustomer = new Map<number, DebtCustomer>();
  for (const row of rows) {
    const overdue = daysOverdue(row.due_date, today);
    const current = byCustomer.get(row.customer_id);
    if (!current) {
      byCustomer.set(row.customer_id, {
        customer_id: row.customer_id,
        name: customerLabel(row.customer_name, row.customer_id),
        invoices: 1,
        credit_total: row.amount,
        oldest_sale_date: row.sale_date,
        oldest_bucket: saleAgeBucket(row, today),
        nearest_due_date: row.due_date,
        overdue_invoices: overdue > 0 ? 1 : 0,
        max_days_overdue: overdue,
      });
      continue;
    }
    current.invoices += 1;
    current.credit_total += row.amount;
    if (row.sale_date < current.oldest_sale_date) {
      current.oldest_sale_date = row.sale_date;
      current.oldest_bucket = saleAgeBucket(row, today);
    }
    if (row.due_date !== null && (current.nearest_due_date === null || row.due_date < current.nearest_due_date)) {
      current.nearest_due_date = row.due_date;
    }
    if (overdue > 0) current.overdue_invoices += 1;
    current.max_days_overdue = Math.max(current.max_days_overdue, overdue);
    if (current.name === `Pelanggan #${row.customer_id}` && row.customer_name) current.name = row.customer_name;
  }
  // Default order: customers with overdue invoices first, then by credit value.
  return [...byCustomer.values()].sort(
    (a, b) =>
      Number(b.overdue_invoices > 0) - Number(a.overdue_invoices > 0) ||
      b.credit_total - a.credit_total ||
      a.customer_id - b.customer_id,
  );
}

export const customerDebtsTool: WidgetToolDef<typeof customerDebtsInput> = {
  name: VIEW_TOOL.piutang,
  title: "Piutang pelanggan",
  description:
    "Open an interactive Piutang (customer debt) widget: all open credit sales aged 0–7 days, 8–30 days, 1–3 months, 3–6 months, 6–12 months, 1–2 years and over 2 years, with the Qasir receivable per age bucket, overdue invoices and customers ranked by credit value. Use it when the user asks who still owes money, about unpaid credit (kasbon/piutang), overdue debts or debt aging. Pass customer_id to highlight one customer. Read-only.",
  input: customerDebtsInput,
  // Worst case: INSTALLMENT_MAX_PAGES (12) list pages + 7 bucket summaries = 19.
  maxRequests: 20,
  view: "piutang",
  async run(input, ctx) {
    const outletId = await ctx.outletId(input.outlet_id);
    const today = ctx.today;
    const [scan, receivables] = await Promise.all([
      scanOpenCredit(ctx, outletId, INSTALLMENT_MAX_PAGES),
      Promise.all(AGING_BUCKET_KEYS.map((key) => bucketReceivable(ctx, outletId, key))),
    ]);
    const rows = scan.rows;

    const buckets = AGING_BUCKET_KEYS.map((key, index) => {
      const inBucket = rows.filter((row) => saleAgeBucket(row, today) === key);
      return {
        key,
        label: AGING_BUCKET_LABEL[key],
        invoices: inBucket.length,
        customers: new Set(inBucket.map((row) => row.customer_id)).size,
        credit_total: inBucket.reduce((sum, row) => sum + row.amount, 0),
        receivable: receivables[index] ?? 0,
      };
    });
    const overdueRows = rows.filter((row) => daysOverdue(row.due_date, today) > 0);
    const summary = {
      receivable_total: buckets.reduce((sum, b) => sum + b.receivable, 0),
      customers: new Set(rows.map((row) => row.customer_id)).size,
      open_invoices: rows.length,
      credit_total: rows.reduce((sum, row) => sum + row.amount, 0),
      overdue_invoices: overdueRows.length,
      overdue_customers: new Set(overdueRows.map((row) => row.customer_id)).size,
    };
    const customers = aggregateCustomers(rows, today);
    const focusId = input.customer_id ?? null;

    const scanReason = scan.capped
      ? `Daftar nota kredit dibatasi ${INSTALLMENT_MAX_PAGES} halaman (${rows.length} nota dimuat); sisa piutang per umur tetap dari laporan Qasir.`
      : null;
    const build = (kept: DebtCustomer[]) => {
      const cut = kept.length < customers.length;
      const reasons = [scanReason, cut ? `Daftar pelanggan dipotong: ${kept.length} dari ${customers.length} ditampilkan.` : null];
      const reason = reasons.filter((r): r is string => r !== null).join(" ");
      return {
        view: "piutang" as const,
        ...ctx.meta(outletId),
        truncated: reason !== "",
        truncated_reason: reason === "" ? null : reason,
        as_of: today,
        summary,
        buckets,
        customers: kept,
        focus_customer_id: focusId,
      };
    };
    const capped = capRows(customers, STRUCTURED_MAX_CHARS, build);
    const structured = build(capped.rows);

    const top = [...customers].sort((a, b) => b.credit_total - a.credit_total || a.customer_id - b.customer_id).slice(0, 5);
    const focus = focusId === null ? undefined : customers.find((c) => c.customer_id === focusId);
    const text = joinLines([
      `Piutang pelanggan per ${indoDate(today)} (outlet ${outletId}).`,
      `Sisa piutang (laporan Qasir): ${rupiah(summary.receivable_total)}.`,
      `${summary.customers} pelanggan, ${summary.open_invoices} nota kredit terbuka, nilai kredit ${rupiah(summary.credit_total)}.`,
      `Lewat jatuh tempo: ${summary.overdue_invoices} nota dari ${summary.overdue_customers} pelanggan.`,
      "Sisa piutang per umur nota:",
      ...buckets.map((b) => `- ${b.label}: ${rupiah(b.receivable)} (${b.invoices} nota)`),
      top.length > 0 && "Nilai kredit terbesar:",
      ...top.map(
        (c, i) =>
          `${i + 1}. ${textSafeName(c.name)}: ${c.invoices} nota, ${rupiah(c.credit_total)}, nota tertua ${AGING_BUCKET_LABEL[c.oldest_bucket]}`,
      ),
      focusId !== null &&
        (focus
          ? `Pelanggan #${focusId}: ${focus.invoices} nota terbuka, nilai kredit ${rupiah(focus.credit_total)}.`
          : `Pelanggan #${focusId} tidak punya nota kredit terbuka.`),
      structured.truncated_reason && `Catatan: ${structured.truncated_reason}`,
    ]);
    return { text, structured };
  },
};

async function customerProfile(ctx: ToolContext, customerId: number): Promise<Record<string, unknown> | null> {
  try {
    const res = await ctx.request({ operationId: "customers.get", path: { customer_id: customerId } });
    const customer = envelopeData(res, "customers.get").customer;
    return isRecord(customer) ? customer : null;
  } catch (err) {
    if (isUpstream404(err)) return null;
    throw err;
  }
}

function legacySale(res: unknown): Record<string, unknown> {
  const sale = envelopeData(res, "order.histories.legacy").sales;
  if (!isRecord(sale)) throw new AppError(ErrorCodes.UPSTREAM_ERROR, "Unexpected order.histories.legacy response");
  return sale;
}

function invoiceFromSale(row: OpenCredit, sale: Record<string, unknown>, today: string): DebtInvoice {
  const installment = isRecord(sale.installment) ? sale.installment : {};
  // remaining_debt means "still owed" only on status 4 (open credit); elsewhere it is -change.
  const remaining = toNumber(sale.status) === 4 ? Math.max(0, toNumber(installment.remaining_debt)) : 0;
  const due = row.due_date ?? parseIndonesianDate(installment.date);
  return {
    sales_id: row.sales_id,
    invoice: toText(sale.invoice_number) || row.invoice,
    sale_date: row.sale_date,
    due_date: due,
    days_overdue: remaining > 0 && due !== null ? daysOverdue(due, today) : null,
    bucket: saleAgeBucket(row, today),
    total: toNumber(installment.total_installment) || row.amount,
    paid: toNumber(sale.total_paid),
    remaining,
    payments: recordsAt(sale, "payments")
      .filter((p) => toNumber(p.amount) !== 0)
      .map((p) => ({
        name: toText(p.payment_name) || toText(p.payment_mode) || "Pembayaran",
        amount: toNumber(p.amount),
        paid_at: parseQasirDateTime(p.paid_date),
      })),
  };
}

export const customerDebtDetailTool: WidgetToolDef<typeof customerDebtDetailInput> = {
  name: APP_TOOL.customerDebtDetail,
  title: "Detail piutang pelanggan",
  description:
    "Widget helper: one customer's open credit invoices with due dates, payments and remaining debt from each receipt. Used by the Piutang widget when a customer row is expanded.",
  input: customerDebtDetailInput,
  // Worst case: CUSTOMER_INSTALLMENT_MAX_PAGES (3) + customers.get (1) + DEBT_DETAIL_MAX_INVOICES (40) = 44.
  maxRequests: 45,
  async run(input, ctx) {
    const outletId = await ctx.outletId(input.outlet_id);
    const today = ctx.today;
    const [scan, profile] = await Promise.all([
      scanOpenCredit(ctx, outletId, CUSTOMER_INSTALLMENT_MAX_PAGES, input.customer_id),
      customerProfile(ctx, input.customer_id),
    ]);
    // Oldest debt first; the detail fan-out covers the oldest DEBT_DETAIL_MAX_INVOICES.
    const open = scan.rows
      .filter((row) => row.customer_id === input.customer_id)
      .sort((a, b) => (a.sale_date < b.sale_date ? -1 : a.sale_date > b.sale_date ? 1 : a.sales_id - b.sales_id));
    const selected = open.slice(0, DEBT_DETAIL_MAX_INVOICES);
    const sales = await Promise.all(
      selected.map(async (row) => ({
        row,
        sale: legacySale(await ctx.request({ operationId: "order.histories.legacy", path: { sales_id: row.sales_id } })),
      })),
    );
    const invoices = sales.map(({ row, sale }) => invoiceFromSale(row, sale, today));

    const legacyCustomer = sales.map(({ sale }) => sale.customer).find(isRecord);
    const customer = {
      id: input.customer_id,
      name:
        toText(profile?.fullname) ||
        open[0]?.customer_name ||
        toText(legacyCustomer?.name) ||
        `Pelanggan #${input.customer_id}`,
      mobile: toText(profile?.mobile) || toText(legacyCustomer?.mobile) || null,
    };

    const reasons = [
      scan.capped ? `Daftar nota kredit dibatasi ${CUSTOMER_INSTALLMENT_MAX_PAGES} halaman.` : null,
      open.length > selected.length ? `Detail dibatasi ${selected.length} nota tertua dari ${open.length} nota terbuka.` : null,
    ].filter((r): r is string => r !== null);
    const build = (kept: DebtInvoice[]) => {
      const all = kept.length < invoices.length ? [...reasons, `Daftar nota dipotong: ${kept.length} dari ${invoices.length} ditampilkan.`] : reasons;
      return {
        ...ctx.meta(outletId),
        truncated: all.length > 0,
        truncated_reason: all.length > 0 ? all.join(" ") : null,
        customer,
        invoices: kept,
        totals: {
          total: kept.reduce((sum, inv) => sum + inv.total, 0),
          paid: kept.reduce((sum, inv) => sum + inv.paid, 0),
          remaining: kept.reduce((sum, inv) => sum + inv.remaining, 0),
        },
      };
    };
    const structured = build(capRows(invoices, STRUCTURED_MAX_CHARS, build).rows);

    const overdue = structured.invoices.filter((inv) => (inv.days_overdue ?? 0) > 0);
    const oldest = structured.invoices[0];
    const text =
      structured.invoices.length === 0
        ? joinLines([`Pelanggan #${input.customer_id} tidak punya nota kredit terbuka (outlet ${outletId}).`, structured.truncated_reason && `Catatan: ${structured.truncated_reason}`])
        : joinLines([
            `Piutang pelanggan #${input.customer_id} (outlet ${outletId}): ${structured.invoices.length} nota kredit terbuka.`,
            `Total kredit ${rupiah(structured.totals.total)}, dibayar ${rupiah(structured.totals.paid)}, sisa ${rupiah(structured.totals.remaining)}.`,
            overdue.length > 0
              ? `Lewat jatuh tempo: ${overdue.length} nota, terlama ${Math.max(...overdue.map((inv) => inv.days_overdue ?? 0))} hari.`
              : "Belum ada nota yang lewat jatuh tempo.",
            oldest && `Nota tertua: ${indoDate(oldest.sale_date)} (${AGING_BUCKET_LABEL[oldest.bucket]}).`,
            structured.truncated_reason && `Catatan: ${structured.truncated_reason}`,
          ]);
    return { text, structured };
  },
};

export const DEBT_TOOLS: readonly AnyWidgetToolDef[] = [customerDebtsTool, customerDebtDetailTool];
```

- [ ] **Step 4: Run the tests and types**

Run: `bun run test tests/unit/widgets-debts.test.ts && bun run check-types`
Expected: `Tests  15 passed (15)`; both `tsc` runs exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/tools/debts.ts tests/unit/widgets-debts.test.ts
git commit -m "feat(widgets): customer debt aging and per-customer debt detail tools

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Widget foundation (toolchain, bridge, query policy, router shell)

**Files:**
- Modify: `package.json` (widget devDependencies, `widgets:*` scripts, `check-types`), `bun.lock` (via `bun add`)
- Create: `widgets/index.html`, `widgets/vite.config.ts`, `widgets/tsconfig.json`, `widgets/vitest.config.ts`
- Create: `widgets/src/main.tsx`, `widgets/src/styles.css`
- Create: `widgets/src/app/AppShell.tsx`, `widgets/src/app/router.tsx`, `widgets/src/app/queryClient.ts`, `widgets/src/app/viewPaths.ts`, `widgets/src/app/search.ts`
- Create: `widgets/src/routes/index.ts`
- Create: `widgets/src/bridge/bridge.ts`, `widgets/src/bridge/extAppsBridge.ts`, `widgets/src/bridge/mockBridge.ts`, `widgets/src/bridge/initialResult.ts`, `widgets/src/bridge/useToolQuery.ts`
- Create: `widgets/src/lib/format.ts`, `widgets/src/lib/dates.ts`, `widgets/src/lib/errors.ts`
- Create: `widgets/dev/fixtures.ts`
- Test: `widgets/test/setup.ts`, `widgets/test/dates.test.ts`, `widgets/test/format.test.ts`, `widgets/test/bridge.test.ts`, `widgets/test/fixtures.test.ts`, `widgets/test/query.test.tsx`, `widgets/test/search.test.ts`, `widgets/test/AppShell.test.tsx`, `widgets/test/initialView.test.ts`

**Interfaces:**
- Consumes:
  - T1 (`src/widgets/contract.ts`): `VIEWS`, `ViewName`, `VIEW_TOOL`, `WIDGET_TOOL_NAMES`, `TOOL_SCHEMAS`, `ToolName`, `ToolInput`, `ToolOutput`, `toolErrorBody`, `isoDate`, `PRODUCT_ORDERS`, `ProductOrder`, `PO_STATUSES`, `PO_STATUS_FILTERS`, `AGING_BUCKET_KEYS`, `AGING_BUCKET_LABEL`, `AgingBucketKey`, `STOCK_MOVEMENT_TYPES`, `poStatusLabel`, `salesStatusLabel`, `stockMovementLabel`.
  - `@modelcontextprotocol/ext-apps` 2.0.0: `App` (`callServerTool`, `openLink`, `sendMessage`, `updateModelContext`, `requestDisplayMode`, `getHostContext`, `getHostCapabilities`, `addEventListener("toolinput" | "toolresult" | "toolcancelled" | "hostcontextchanged")`); `/react`: `useApp`, `useHostStyles`.
- Produces (T9–T15 import these exact names; paths are relative, widget code imports the contract as `../../../src/widgets/contract` from `widgets/src/<dir>/`, `../../src/widgets/contract` from `widgets/test/` and `widgets/dev/`):
  - `widgets/src/bridge/bridge.ts`:
    - `class ToolCallError extends Error { readonly code: string; readonly connectUrl: string | undefined; constructor(body: { code: string; message: string; connect_url?: string }) }`
    - `interface HostInfo { theme: "light" | "dark"; displayMode: "inline" | "fullscreen" | "pip"; canFullscreen: boolean; canSendMessage: boolean; canUpdateContext: boolean; canOpenLinks: boolean }`
    - `interface Bridge { readonly host: HostInfo; callTool<N extends ToolName>(name: N, args: ToolInput<N>, signal?: AbortSignal): Promise<ToolOutput<N>>; openLink(url: string): Promise<void>; sendMessage(text: string): Promise<void>; updateContext(text: string): Promise<void>; toggleFullscreen(): Promise<void> }`
    - `interface ToolResultLike { structuredContent?: unknown; isError?: boolean; content?: Array<{ type: string; text?: string }> }`
    - `function parseToolResult<N extends ToolName>(name: N, result: ToolResultLike): ToolOutput<N>`
    - `function toToolCallError(err: unknown): ToolCallError` (SDK `REQUEST_TIMEOUT` ⇒ `UPSTREAM_TIMEOUT`, else `UPSTREAM_ERROR`)
    - `const BridgeContext: React.Context<Bridge | null>`; `function useBridge(): Bridge`
  - `widgets/src/bridge/extAppsBridge.ts`: `const TOOL_CALL_TIMEOUT_MS = 45_000`; `function createExtAppsBridge(app: App): Bridge`
  - `widgets/src/bridge/mockBridge.ts`: `interface MockBridgeOptions { latencyMs?: number; failWith?: Partial<Record<ToolName, string>>; host?: Partial<HostInfo> }`; `interface MockBridge extends Bridge { readonly calls: Array<{ name: ToolName; args: unknown }>; readonly openedLinks: string[]; readonly sentMessages: string[]; readonly contextUpdates: string[] }`; `const MOCK_CONNECT_URL`; `function createMockBridge(options?: MockBridgeOptions): MockBridge`
  - `widgets/dev/fixtures.ts`: `const FIXTURES: { [N in ToolName]: (args: ToolInput<N>) => ToolOutput<N> }`; `const SAMPLE_ARGS: { [N in ToolName]: ToolInput<N> }`; `const FIXTURE_TODAY = "2026-09-15"`; `const FIXTURE_OUTLET_ID = "100001"`
  - `widgets/src/bridge/useToolQuery.ts`: `function toolQueryKey<N extends ToolName>(name: N, args: ToolInput<N>): readonly [N, ToolInput<N>]`; `function useToolQuery<N extends ToolName>(name: N, args: ToolInput<N>, options?: { enabled?: boolean }): UseQueryResult<ToolOutput<N>, ToolCallError>`; `type PageToolName`; `interface MorePages<Row> { rows: Row[]; hasMore: boolean; loadMore: () => void; isFetching: boolean; error: ToolCallError | null }`; `function useMorePages<N extends PageToolName, Row>(opts: { tool: N; args: Omit<ToolInput<N>, "page">; startPage: number | null; rowsOf: (page: ToolOutput<N>) => Row[]; enabled?: boolean }): MorePages<Row>`
  - `widgets/src/bridge/initialResult.ts`: `function seedInitialResult(queryClient: QueryClient, name: ToolName, args: Record<string, unknown>, result: unknown): boolean`; `interface InitialToolCall`; `function createInitialToolCall(): InitialToolCall`; `const INITIAL_RESULT_WAIT_MS = 90_000`; `function primeInitialQuery<N extends ToolName>(queryClient: QueryClient, bridge: Bridge, name: N, args: ToolInput<N>, call: InitialToolCall, waitMs?: number): void`
  - `widgets/src/app/queryClient.ts`: `const NO_RETRY: ReadonlySet<string>`; `function shouldRetry(failureCount: number, error: unknown): boolean`; `function createWidgetQueryClient(): QueryClient`
  - `widgets/src/app/viewPaths.ts`: `const VIEW_PATH` (``as const satisfies Record<ViewName, `/${ViewName}`>``); `const VIEW_LABEL: Record<ViewName, string>`; `function viewFromMarker(marker: string | undefined): ViewName`
  - `widgets/src/app/search.ts`: `penjualanSearch`, `produkSearch`, `stokSearch`, `pembelianSearch`, `transaksiSearch`, `piutangSearch`, `VIEW_SEARCH`, types `PenjualanSearch` … `PiutangSearch`, `DEFAULT_PRESET`, `DEBT_SORTS`, `DebtSort`; `function searchFromToolArgs(view: ViewName, args: Record<string, unknown>, today?: string): Record<string, unknown>`; `function toolArgsFromSearch(view: ViewName, search: Record<string, unknown>, today: string): Record<string, unknown>`; `function viewPathWithSearch(view: ViewName, search: Record<string, unknown>): string`
  - `widgets/src/lib/dates.ts`: `PRESET_KEYS`, `type PresetKey`, `type RangePresetKey`, `interface DateRangeValue`, `PRESET_LABEL`, `isIsoDate`, `addIsoDays`, `isoDaysBetween`, `jakartaTodayBrowser(now?: Date): string`, `presetRange(key: RangePresetKey, today: string): DateRangeValue`, `matchPreset(start: string, end: string, today: string): RangePresetKey | null`, `daysAgoLabel(days: number | null): string`
  - `widgets/src/lib/format.ts`: `formatRupiah(n)`, `formatNumber(n, maxFractionDigits = 2)`, `formatDate(isoDate)`, `formatDateTime(iso)`, `formatTime(iso)`, `formatPercent(p)`
  - `widgets/src/lib/errors.ts`: `interface ErrorCopy { title; body; retryable; connectUrl? }`; `function errorCopy(err: ToolCallError): ErrorCopy`
  - `widgets/src/app/router.tsx`: `const rootRoute`; `function NotFoundPanel()`; `function createWidgetRouter(opts: { initialPath: string })`; `type WidgetRouter`
  - `widgets/src/routes/index.ts`: `const VIEW_ROUTES: Array<(root: typeof rootRoute) => AnyRoute>` (empty; T12–T14 append)
  - `widgets/src/app/AppShell.tsx`: `const APP_INFO`; `const TOOL_INPUT_WAIT_MS = 1_000`; `const LATE_TOOL_INPUT_WAIT_MS = INITIAL_RESULT_WAIT_MS`; `interface InitialViewOptions { view: ViewName; call: InitialToolCall; queryClient: QueryClient; getBridge: () => Bridge | null; open: (path: string) => void; canApplyLate: () => boolean; navigate: (path: string) => void; today?: () => string; inputWaitMs?: number; lateInputWaitMs?: number }`; `function startInitialView(opts: InitialViewOptions): () => void`; `function atViewDefaults(view: ViewName, location: { pathname: string; search: string }): boolean`; `function AppShell(props: { view: ViewName; bridge?: Bridge }): JSX.Element`
  - `widgets/src/styles.css` Tailwind tokens (use these class names, not raw colors): `bg-surface`, `bg-surface-muted`, `bg-surface-strong`, `text-fg`, `text-fg-muted`, `text-fg-subtle`, `border-line`, `border-line-muted`, `ring-focus`/`outline-focus`, `{text,bg,border}-{info,danger,success,warning}` plus `bg-{info,danger,success,warning}-soft`, `rounded-sm|md|lg` (host radii), `font-sans`/`font-mono` (host fonts).

Decisions this task fixes for later tasks:
- Default presets: `penjualan` and `produk` open on `7_hari`, `transaksi` on `hari_ini` (`DEFAULT_PRESET`). `searchFromToolArgs` stores a matching preset name (`{ preset: "7_hari" }`) or `{ preset: "custom", start_date, end_date }`.
- The opening view tool call is never repeated: `AppShell` waits up to 1 s for `toolinput`, normalizes it with `toolArgsFromSearch(searchFromToolArgs(args))`, and `primeInitialQuery` makes the first `useToolQuery` for that key await the host's `toolresult` (up to 90 s) before falling back to `callServerTool`.
- A `toolinput` that arrives after that first second is not dropped. The router opens on the view's defaults, and `startInitialView` keeps listening for up to `LATE_TOOL_INPUT_WAIT_MS` (90 s). When the late input arrives and the viewer is still on that view with its default search params (`atViewDefaults`), it primes the query for the model's arguments and replaces the router location with them, so the host's result is used (e.g. `show_stock_browser {search:"Kopi"}` still shows the searched list). Once the viewer has changed view or filters, the late input is ignored. The defaults call already made is not cancelled.
- `NO_RETRY` also contains `CONTRACT_MISMATCH` (deterministic failure).
- `main.tsx` loads the mock bridge through a dynamic import inside `import.meta.env.DEV`, so fixtures never reach the production HTML.
- `vite.config.ts` sets `build.cssTarget` to browsers with native `light-dark()` so Lightning CSS keeps it (the host sets `color-scheme` at runtime).

- [ ] **Step 1: Add the widget devDependencies**

Run:

```bash
bun add -d --exact @modelcontextprotocol/ext-apps@2.0.0 @tailwindcss/vite@4.3.3 @tanstack/react-form@1.33.5 @tanstack/react-pacer@0.23.0 @tanstack/react-query@5.102.8 @tanstack/react-router@1.170.36 @tanstack/react-table@9.2.4 @tanstack/react-virtual@3.14.13 @testing-library/dom@10.4.2 @testing-library/react@16.3.3 @types/react@19.3.0 @types/react-dom@19.3.0 @vitejs/plugin-react@6.1.1 happy-dom@20.14.5 react@19.3.0 react-dom@19.3.0 tailwindcss@4.3.3 vite@8.3.0 vite-plugin-singlefile@2.3.3
```

Expected: `installed …` for all 19 packages and `Saved lockfile`. `package.json` `devDependencies` now reads:

```json
  "devDependencies": {
    "@cloudflare/workers-types": "^5.20260915.1",
    "@modelcontextprotocol/client": "2.0.0",
    "@modelcontextprotocol/ext-apps": "2.0.0",
    "@tailwindcss/vite": "4.3.3",
    "@tanstack/react-form": "1.33.5",
    "@tanstack/react-pacer": "0.23.0",
    "@tanstack/react-query": "5.102.8",
    "@tanstack/react-router": "1.170.36",
    "@tanstack/react-table": "9.2.4",
    "@tanstack/react-virtual": "3.14.13",
    "@testing-library/dom": "10.4.2",
    "@testing-library/react": "16.3.3",
    "@types/node": "^26.5.1",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@vitejs/plugin-react": "6.1.1",
    "happy-dom": "20.14.5",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "tailwindcss": "4.3.3",
    "typescript": "^7.0.2",
    "vite": "8.3.0",
    "vite-plugin-singlefile": "2.3.3",
    "vitest": "^5.0.0",
    "wrangler": "^4.131.2"
  }
```

The widget packages are build/test-time only: the Worker serves the prebuilt HTML string (T10), so nothing moves to `dependencies`.

- [ ] **Step 2: Add the widget scripts**

In `package.json`, replace:

```json
    "check-types": "tsc --noEmit && tsc --noEmit -p tsconfig.scripts.json",
```

with:

```json
    "check-types": "tsc --noEmit && tsc --noEmit -p tsconfig.scripts.json && tsc --noEmit -p widgets/tsconfig.json",
```

and replace:

```json
    "deploy": "wrangler deploy"
  },
```

with:

```json
    "deploy": "wrangler deploy",
    "widgets:dev": "vite --config widgets/vite.config.ts",
    "widgets:build": "vite build --config widgets/vite.config.ts",
    "widgets:test": "vitest run --config widgets/vitest.config.ts",
    "widgets:check-types": "tsc --noEmit -p widgets/tsconfig.json"
  },
```

The root `vitest.config.ts` only includes `tests/**/*.test.ts` and the root `tsconfig.json` only `src/**/*.ts` + `tests/**/*.ts`, so `widgets/` is covered solely by these scripts. `widgets/dist/` and `widgets/node_modules/.vite` are already ignored by the root `.gitignore` (`dist/`, `node_modules/`).

- [ ] **Step 3: Create the Vite project files**

`widgets/index.html`:

```html
<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <title>Manujujaya</title>
  </head>
  <body>
    <div id="root" data-view="__MJ_VIEW__"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`widgets/vite.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const widgetRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  root: widgetRoot,
  plugins: [react(), tailwindcss(), viteSingleFile()],
  // The SPA imports the shared contract from ../src/widgets/contract.ts.
  server: { fs: { allow: [repoRoot] } },
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    // Hosts that render MCP Apps support light-dark(); keep it untranspiled so the
    // host-applied color-scheme on <html> switches the fallback palette.
    cssTarget: ["chrome123", "edge123", "firefox120", "safari17.5"],
  },
});
```

`widgets/tsconfig.json`:

```jsonc
{
  // Widget SPA (DOM + React). The root tsconfig is Worker-only and does not include widgets/.
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["vite/client", "node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src", "test", "dev", "vite.config.ts", "vitest.config.ts"]
}
```

`widgets/vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  test: {
    environment: "happy-dom",
    include: ["test/**/*.test.{ts,tsx}"],
    setupFiles: ["./test/setup.ts"],
    testTimeout: 15_000,
  },
});
```

`widgets/test/setup.ts`:

```ts
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only auto-cleans when vitest globals are enabled; they are not.
afterEach(() => {
  cleanup();
});
```

- [ ] **Step 4: Write the failing date and formatter tests**

`widgets/test/dates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  PRESET_KEYS,
  PRESET_LABEL,
  addIsoDays,
  daysAgoLabel,
  isIsoDate,
  isoDaysBetween,
  jakartaTodayBrowser,
  matchPreset,
  presetRange,
} from "../src/lib/dates";

describe("presetRange", () => {
  // 2026-09-15 is a Tuesday.
  const today = "2026-09-15";

  it("covers every preset as of a mid-month Tuesday", () => {
    expect(presetRange("hari_ini", today)).toEqual({ start_date: "2026-09-15", end_date: "2026-09-15" });
    expect(presetRange("kemarin", today)).toEqual({ start_date: "2026-09-14", end_date: "2026-09-14" });
    expect(presetRange("7_hari", today)).toEqual({ start_date: "2026-09-09", end_date: "2026-09-15" });
    expect(presetRange("minggu_ini", today)).toEqual({ start_date: "2026-09-14", end_date: "2026-09-15" });
    expect(presetRange("bulan_ini", today)).toEqual({ start_date: "2026-09-01", end_date: "2026-09-15" });
    expect(presetRange("30_hari", today)).toEqual({ start_date: "2026-08-17", end_date: "2026-09-15" });
  });

  it("starts weeks on Monday", () => {
    expect(presetRange("minggu_ini", "2026-09-14")).toEqual({ start_date: "2026-09-14", end_date: "2026-09-14" }); // Monday
    expect(presetRange("minggu_ini", "2026-09-13")).toEqual({ start_date: "2026-09-07", end_date: "2026-09-13" }); // Sunday
    expect(presetRange("minggu_ini", "2026-10-01")).toEqual({ start_date: "2026-09-28", end_date: "2026-10-01" }); // Thursday
  });

  it("crosses month and year boundaries", () => {
    expect(presetRange("kemarin", "2026-03-01")).toEqual({ start_date: "2026-02-28", end_date: "2026-02-28" });
    expect(presetRange("kemarin", "2024-03-01")).toEqual({ start_date: "2024-02-29", end_date: "2024-02-29" });
    expect(presetRange("7_hari", "2026-01-03")).toEqual({ start_date: "2025-12-28", end_date: "2026-01-03" });
    expect(presetRange("bulan_ini", "2026-09-01")).toEqual({ start_date: "2026-09-01", end_date: "2026-09-01" });
    expect(presetRange("minggu_ini", "2027-01-01")).toEqual({ start_date: "2026-12-28", end_date: "2027-01-01" });
  });

  it("labels every preset in Indonesian", () => {
    expect(PRESET_KEYS.map((key) => PRESET_LABEL[key])).toEqual([
      "Hari ini",
      "Kemarin",
      "7 hari terakhir",
      "Minggu ini",
      "Bulan ini",
      "30 hari terakhir",
      "Pilih tanggal",
    ]);
  });
});

describe("matchPreset", () => {
  it("recognizes preset ranges and returns null for custom ones", () => {
    expect(matchPreset("2026-09-15", "2026-09-15", "2026-09-15")).toBe("hari_ini");
    expect(matchPreset("2026-09-09", "2026-09-15", "2026-09-15")).toBe("7_hari");
    expect(matchPreset("2026-09-01", "2026-09-15", "2026-09-15")).toBe("bulan_ini");
    expect(matchPreset("2026-08-01", "2026-08-20", "2026-09-15")).toBeNull();
  });
});

describe("date arithmetic", () => {
  it("adds days and counts days between ISO dates", () => {
    expect(addIsoDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addIsoDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(isoDaysBetween("2026-09-01", "2026-09-15")).toBe(14);
  });

  it("validates real calendar dates", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("15-09-2026")).toBe(false);
    expect(isIsoDate(20260915)).toBe(false);
  });
});

describe("jakartaTodayBrowser", () => {
  it("uses Asia/Jakarta, not UTC", () => {
    expect(jakartaTodayBrowser(new Date("2026-09-14T18:30:00Z"))).toBe("2026-09-15");
    expect(jakartaTodayBrowser(new Date("2026-09-14T16:59:59Z"))).toBe("2026-09-14");
  });
});

describe("daysAgoLabel", () => {
  it("renders relative days", () => {
    expect(daysAgoLabel(null)).toBe("—");
    expect(daysAgoLabel(0)).toBe("Hari ini");
    expect(daysAgoLabel(1)).toBe("Kemarin");
    expect(daysAgoLabel(43)).toBe("43 hari lalu");
  });
});
```

`widgets/test/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatNumber, formatPercent, formatRupiah, formatTime } from "../src/lib/format";

/** Intl uses no-break spaces; compare with plain spaces. */
const plain = (s: string) => s.replace(/[  ]/g, " ");

describe("formatRupiah", () => {
  it("formats IDR without decimals", () => {
    expect(plain(formatRupiah(1_250_000))).toBe("Rp 1.250.000");
    expect(plain(formatRupiah(0))).toBe("Rp 0");
    expect(plain(formatRupiah(1_999.6))).toBe("Rp 2.000");
    expect(plain(formatRupiah(-5_000))).toBe("-Rp 5.000");
  });

  it("keeps the no-break space so amounts never wrap", () => {
    expect(formatRupiah(1_000)).toContain(" ");
  });
});

describe("formatNumber", () => {
  it("uses id-ID separators and at most 2 decimals by default", () => {
    expect(formatNumber(1234.5)).toBe("1.234,5");
    expect(formatNumber(2.456)).toBe("2,46");
    expect(formatNumber(2.456, 0)).toBe("2");
    expect(formatNumber(Number.NaN)).toBe("0");
  });
});

describe("dates", () => {
  it("formats calendar dates", () => {
    expect(formatDate("2026-09-15")).toBe("15 Sep 2026");
    expect(formatDate("2026-05-02")).toBe("2 Mei 2026");
    expect(formatDate("")).toBe("—");
  });

  it("formats instants in Asia/Jakarta", () => {
    expect(formatDateTime("2026-09-15T03:32:00.000Z")).toBe("15 Sep 2026 10.32");
    expect(formatDateTime("2026-09-14T17:05:00.000Z")).toBe("15 Sep 2026 00.05");
    expect(formatTime("2026-09-15T03:32:00.000Z")).toBe("10.32");
    expect(formatDateTime("not a date")).toBe("—");
  });
});

describe("formatPercent", () => {
  it("rounds to one decimal with a comma", () => {
    expect(formatPercent(43.37)).toBe("43,4%");
    expect(formatPercent(3496.08)).toBe("3.496,1%");
    expect(formatPercent(null)).toBe("—");
  });
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `bun run widgets:test test/dates.test.ts test/format.test.ts`
Expected: FAIL with `Failed to resolve import "../src/lib/dates" from "widgets/test/dates.test.ts"` and `Failed to resolve import "../src/lib/format" from "widgets/test/format.test.ts"`.

- [ ] **Step 6: Implement the date and format helpers**

The widget keeps its own date arithmetic instead of importing `src/widgets/qasir-dates.ts`, which pulls in `src/errors/codes.ts` and is outside the T10 source hash.

`widgets/src/lib/dates.ts`:

```ts
/** Calendar helpers for the widget. Dates are "YYYY-MM-DD" strings in Asia/Jakarta. */

export const PRESET_KEYS = ["hari_ini", "kemarin", "7_hari", "minggu_ini", "bulan_ini", "30_hari", "custom"] as const;
export type PresetKey = (typeof PRESET_KEYS)[number];
export type RangePresetKey = Exclude<PresetKey, "custom">;

export const PRESET_LABEL: Record<PresetKey, string> = {
  hari_ini: "Hari ini",
  kemarin: "Kemarin",
  "7_hari": "7 hari terakhir",
  minggu_ini: "Minggu ini",
  bulan_ini: "Bulan ini",
  "30_hari": "30 hari terakhir",
  custom: "Pilih tanggal",
};

export interface DateRangeValue {
  start_date: string;
  end_date: string;
}

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

function utcDay(iso: string): number {
  const m = ISO_DATE.exec(iso);
  if (!m) throw new RangeError(`Invalid date: ${iso}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** "2026-08-31" + 1 → "2026-09-01". */
export function addIsoDays(iso: string, days: number): string {
  return new Date(utcDay(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (negative when b is earlier). */
export function isoDaysBetween(a: string, b: string): number {
  return Math.round((utcDay(b) - utcDay(a)) / DAY_MS);
}

/** Calendar date in Asia/Jakarta for the given instant. */
export function jakartaTodayBrowser(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Inclusive range for a preset as of `today`. Weeks start on Monday. */
export function presetRange(key: RangePresetKey, today: string): DateRangeValue {
  switch (key) {
    case "hari_ini":
      return { start_date: today, end_date: today };
    case "kemarin": {
      const yesterday = addIsoDays(today, -1);
      return { start_date: yesterday, end_date: yesterday };
    }
    case "7_hari":
      return { start_date: addIsoDays(today, -6), end_date: today };
    case "minggu_ini": {
      const weekday = new Date(utcDay(today)).getUTCDay(); // 0 = Sunday
      return { start_date: addIsoDays(today, -((weekday + 6) % 7)), end_date: today };
    }
    case "bulan_ini":
      return { start_date: `${today.slice(0, 8)}01`, end_date: today };
    case "30_hari":
      return { start_date: addIsoDays(today, -29), end_date: today };
  }
}

const MATCH_ORDER: readonly RangePresetKey[] = ["hari_ini", "kemarin", "7_hari", "30_hari", "minggu_ini", "bulan_ini"];

/** The preset whose range equals start..end as of today, or null. */
export function matchPreset(start: string, end: string, today: string): RangePresetKey | null {
  for (const key of MATCH_ORDER) {
    const range = presetRange(key, today);
    if (range.start_date === start && range.end_date === end) return key;
  }
  return null;
}

/** null ⇒ "—", 0 ⇒ "Hari ini", 1 ⇒ "Kemarin", n ⇒ "n hari lalu". */
export function daysAgoLabel(days: number | null): string {
  if (days === null || !Number.isFinite(days)) return "—";
  const whole = Math.max(0, Math.floor(days));
  if (whole === 0) return "Hari ini";
  if (whole === 1) return "Kemarin";
  return `${whole} hari lalu`;
}
```

`widgets/src/lib/format.ts`:

```ts
/** Indonesian (id-ID) formatters. Outputs keep Intl's no-break spaces (e.g. "Rp 1.250.000"). */

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const numberFormats = new Map<number, Intl.NumberFormat>();
const dateFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateTimeFormat = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Jakarta",
});

const EMPTY = "—";

/** 1250000 → "Rp 1.250.000" (IDR, no decimals). */
export function formatRupiah(n: number): string {
  return rupiah.format(Number.isFinite(n) ? n : 0);
}

/** 1234.5 → "1.234,5"; at most `maxFractionDigits` decimals (default 2). */
export function formatNumber(n: number, maxFractionDigits = 2): string {
  let format = numberFormats.get(maxFractionDigits);
  if (!format) {
    format = new Intl.NumberFormat("id-ID", { maximumFractionDigits: maxFractionDigits });
    numberFormats.set(maxFractionDigits, format);
  }
  return format.format(Number.isFinite(n) ? n : 0);
}

/** "2026-09-15" → "15 Sep 2026"; anything else → "—". */
export function formatDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return EMPTY;
  const d = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? EMPTY : dateFormat.format(d);
}

function jakartaParts(iso: string): Record<string, string> | null {
  const d = new Date(iso);
  if (iso === "" || Number.isNaN(d.getTime())) return null;
  const parts: Record<string, string> = {};
  for (const part of dateTimeFormat.formatToParts(d)) parts[part.type] = part.value;
  return parts;
}

/** ISO instant → "15 Sep 2026 10.32" in Asia/Jakarta; invalid → "—". */
export function formatDateTime(iso: string): string {
  const p = jakartaParts(iso);
  if (!p) return EMPTY;
  return `${p.day} ${p.month} ${p.year} ${p.hour}.${p.minute}`;
}

/** ISO instant → "10.32" in Asia/Jakarta; invalid → "—". */
export function formatTime(iso: string): string {
  const p = jakartaParts(iso);
  if (!p) return EMPTY;
  return `${p.hour}.${p.minute}`;
}

/** 43.37 → "43,4%"; null → "—". */
export function formatPercent(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return EMPTY;
  return `${formatNumber(p, 1)}%`;
}
```

- [ ] **Step 7: Run the tests and all type checks**

Run: `bun run widgets:test test/dates.test.ts test/format.test.ts && bun run check-types`
Expected: 2 test files PASS (15 tests); all three `tsc` runs exit 0.

- [ ] **Step 8: Commit**

```bash
git add package.json bun.lock widgets/index.html widgets/vite.config.ts widgets/tsconfig.json widgets/vitest.config.ts widgets/test/setup.ts widgets/src/lib/dates.ts widgets/src/lib/format.ts widgets/test/dates.test.ts widgets/test/format.test.ts
git commit -m "feat(widgets): Vite/React/TanStack toolchain, Jakarta presets and id-ID formatters

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 9: Write the failing bridge, error-copy and fixture tests**

`widgets/test/bridge.test.ts`:

```ts
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
```

`widgets/test/fixtures.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TOOL_SCHEMAS, WIDGET_TOOL_NAMES, type ToolName } from "../../src/widgets/contract";
import { ToolCallError } from "../src/bridge/bridge";
import { MOCK_CONNECT_URL, createMockBridge } from "../src/bridge/mockBridge";
import { FIXTURES, SAMPLE_ARGS } from "../dev/fixtures";

const TOOL_NAMES = Object.keys(TOOL_SCHEMAS) as ToolName[];

describe("FIXTURES", () => {
  it("covers all 15 widget tools", () => {
    expect(Object.keys(FIXTURES).sort()).toEqual([...WIDGET_TOOL_NAMES].sort());
    expect(Object.keys(SAMPLE_ARGS).sort()).toEqual([...WIDGET_TOOL_NAMES].sort());
  });

  it.each(TOOL_NAMES)("%s: sample args are valid input and the payload parses with the contract", (name) => {
    const args = SAMPLE_ARGS[name];
    expect(TOOL_SCHEMAS[name].input.safeParse(args).success).toBe(true);
    const payload = (FIXTURES[name] as (a: unknown) => unknown)(args);
    const parsed = TOOL_SCHEMAS[name].output.safeParse(payload);
    expect(parsed.error?.issues ?? []).toEqual([]);
  });

  it("is deterministic", () => {
    expect(FIXTURES.show_customer_debts({})).toEqual(FIXTURES.show_customer_debts({}));
    expect(FIXTURES.stock_page({ page: 2 })).toEqual(FIXTURES.stock_page({ page: 2 }));
  });

  it("contains no real-looking Indonesian phone numbers", () => {
    const all = JSON.stringify(TOOL_NAMES.map((name) => (FIXTURES[name] as (a: unknown) => unknown)(SAMPLE_ARGS[name])));
    expect(all).not.toMatch(/(?:\+62|62|0)8[1-9]\d{6,}/);
  });

  it("pages until next_page is null", () => {
    let page: number | null = 1;
    let rows = 0;
    while (page !== null) {
      const result: ReturnType<typeof FIXTURES.stock_page> = FIXTURES.stock_page({ page });
      rows += result.rows.length;
      page = result.next_page;
    }
    expect(rows).toBe(FIXTURES.show_stock_browser({}).total_rows);
  });
});

describe("createMockBridge", () => {
  it("answers from fixtures and records calls", async () => {
    const bridge = createMockBridge();
    const data = await bridge.callTool("show_stock_browser", { search: "Kopi" });
    expect(data.view).toBe("stok");
    expect(data.rows.every((row) => row.name.includes("Kopi"))).toBe(true);
    expect(bridge.calls).toEqual([{ name: "show_stock_browser", args: { search: "Kopi" } }]);
  });

  it("rejects invalid input like the server", async () => {
    const bridge = createMockBridge();
    await expect(bridge.callTool("stock_page", { page: 501 })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("fails configured tools with a ToolCallError", async () => {
    const bridge = createMockBridge({ failWith: { show_customer_debts: "QASIR_AUTH_EXPIRED" } });
    const err = await bridge.callTool("show_customer_debts", {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ToolCallError);
    expect(err).toMatchObject({ code: "QASIR_AUTH_EXPIRED", connectUrl: MOCK_CONNECT_URL });
  });

  it("honours abort signals during simulated latency", async () => {
    const bridge = createMockBridge({ latencyMs: 1_000 });
    const controller = new AbortController();
    const pending = bridge.callTool("stock_velocity", { inventory_id: 5003 }, controller.signal);
    controller.abort(new Error("cancelled"));
    await expect(pending).rejects.toThrow("cancelled");
  });

  it("records host actions", async () => {
    const bridge = createMockBridge({ host: { canFullscreen: false } });
    await bridge.openLink("https://mcp.example/connect");
    await bridge.sendMessage("Halo");
    await bridge.updateContext("Tampilan: stok");
    await bridge.toggleFullscreen();
    expect(bridge.openedLinks).toEqual(["https://mcp.example/connect"]);
    expect(bridge.sentMessages).toEqual(["Halo"]);
    expect(bridge.contextUpdates).toEqual(["Tampilan: stok"]);
    expect(bridge.host).toMatchObject({ canFullscreen: false, displayMode: "fullscreen" });
  });
});
```

- [ ] **Step 10: Run the tests to verify they fail**

Run: `bun run widgets:test test/bridge.test.ts test/fixtures.test.ts`
Expected: FAIL with `Failed to resolve import "../src/bridge/bridge" from "widgets/test/bridge.test.ts"` and `Failed to resolve import "../src/bridge/mockBridge" from "widgets/test/fixtures.test.ts"`.

- [ ] **Step 11: Implement the bridge contract and error copy**

`parseToolResult` is the only place tool results are interpreted: errors become `ToolCallError`, successes are parsed with the T1 contract (unknown fields stripped, mismatches reported as `CONTRACT_MISMATCH` with at most three issue paths and no values).

`widgets/src/bridge/bridge.ts`:

```ts
import { createContext, useContext } from "react";
import { TOOL_SCHEMAS, toolErrorBody, type ToolInput, type ToolName, type ToolOutput } from "../../../src/widgets/contract";

/** A failed tool call, carrying the server's error `code` (or a widget-side code such as CONTRACT_MISMATCH). */
export class ToolCallError extends Error {
  readonly code: string;
  readonly connectUrl: string | undefined;

  constructor(body: { code: string; message: string; connect_url?: string }) {
    super(body.message);
    this.name = "ToolCallError";
    this.code = body.code;
    this.connectUrl = body.connect_url;
  }
}

export interface HostInfo {
  theme: "light" | "dark";
  displayMode: "inline" | "fullscreen" | "pip";
  canFullscreen: boolean;
  canSendMessage: boolean;
  canUpdateContext: boolean;
  canOpenLinks: boolean;
}

/** Everything a view needs from its host. Implemented by the ext-apps App and by the dev/test mock. */
export interface Bridge {
  readonly host: HostInfo;
  callTool<N extends ToolName>(name: N, args: ToolInput<N>, signal?: AbortSignal): Promise<ToolOutput<N>>;
  openLink(url: string): Promise<void>;
  sendMessage(text: string): Promise<void>;
  updateContext(text: string): Promise<void>;
  toggleFullscreen(): Promise<void>;
}

/** The subset of CallToolResult the widget reads. */
export interface ToolResultLike {
  structuredContent?: unknown;
  isError?: boolean;
  content?: Array<{ type: string; text?: string }>;
}

const SDK_INPUT_ERROR_PREFIX = "Input validation error";

function errorBodyFromText(text: string): { code: string; message: string; connect_url?: string } {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      const body = toolErrorBody.safeParse(JSON.parse(trimmed));
      if (body.success) return body.data;
    } catch {
      // Not JSON; fall through to the text rules.
    }
  }
  if (trimmed.startsWith(SDK_INPUT_ERROR_PREFIX)) return { code: "INVALID_INPUT", message: trimmed };
  return { code: "UPSTREAM_ERROR", message: trimmed === "" ? "Tool call failed" : trimmed };
}

/**
 * isError ⇒ throw ToolCallError (JSON {code,message,connect_url?} body; SDK "Input validation error…" text ⇒
 * INVALID_INPUT; other text ⇒ UPSTREAM_ERROR). Success ⇒ structuredContent parsed with the tool's contract
 * schema (unknown fields stripped); a mismatch ⇒ ToolCallError CONTRACT_MISMATCH.
 */
export function parseToolResult<N extends ToolName>(name: N, result: ToolResultLike): ToolOutput<N> {
  if (result.isError) {
    const text = result.content?.find((block) => block.type === "text" && typeof block.text === "string")?.text ?? "";
    throw new ToolCallError(errorBodyFromText(text));
  }
  const parsed = TOOL_SCHEMAS[name].output.safeParse(result.structuredContent);
  if (!parsed.success) {
    const paths = parsed.error.issues
      .slice(0, 3)
      .map((issue) => issue.path.map(String).join(".") || "(root)")
      .join(", ");
    throw new ToolCallError({ code: "CONTRACT_MISMATCH", message: `${name} returned unexpected data at ${paths}` });
  }
  return parsed.data as ToolOutput<N>;
}

/** Normalizes anything a host call can throw into a ToolCallError. */
export function toToolCallError(err: unknown): ToolCallError {
  if (err instanceof ToolCallError) return err;
  const code = typeof err === "object" && err !== null ? (err as { code?: unknown }).code : undefined;
  const message = err instanceof Error ? err.message : String(err);
  if (code === "REQUEST_TIMEOUT") return new ToolCallError({ code: "UPSTREAM_TIMEOUT", message });
  return new ToolCallError({ code: "UPSTREAM_ERROR", message });
}

export const BridgeContext = createContext<Bridge | null>(null);

export function useBridge(): Bridge {
  const bridge = useContext(BridgeContext);
  if (!bridge) throw new Error("useBridge must be used inside <BridgeContext.Provider>");
  return bridge;
}
```

`widgets/src/lib/errors.ts`:

```ts
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
```

- [ ] **Step 12: Implement the ext-apps bridge**

`host` is a getter so it always reflects the latest host context; `AppShell` re-creates the bridge object on `hostcontextchanged` so React consumers re-render.

`widgets/src/bridge/extAppsBridge.ts`:

```ts
import type { App } from "@modelcontextprotocol/ext-apps";
import type { ToolInput, ToolName, ToolOutput } from "../../../src/widgets/contract";
import { parseToolResult, toToolCallError, type Bridge, type HostInfo } from "./bridge";

export const TOOL_CALL_TIMEOUT_MS = 45_000;

function hostInfoOf(app: App): HostInfo {
  const context = app.getHostContext();
  const capabilities = app.getHostCapabilities();
  return {
    theme: context?.theme === "dark" ? "dark" : "light",
    displayMode: context?.displayMode ?? "inline",
    canFullscreen: context?.availableDisplayModes?.includes("fullscreen") ?? false,
    canSendMessage: Boolean(capabilities?.message),
    canUpdateContext: Boolean(capabilities?.updateModelContext),
    canOpenLinks: Boolean(capabilities?.openLinks),
  };
}

/** Bridge over a connected ext-apps App. `host` is read from the latest host context on every access. */
export function createExtAppsBridge(app: App): Bridge {
  return {
    get host() {
      return hostInfoOf(app);
    },

    async callTool<N extends ToolName>(name: N, args: ToolInput<N>, signal?: AbortSignal): Promise<ToolOutput<N>> {
      let result;
      try {
        result = await app.callServerTool(
          { name, arguments: args as Record<string, unknown> },
          { timeout: TOOL_CALL_TIMEOUT_MS, ...(signal ? { signal } : {}) },
        );
      } catch (err) {
        if (signal?.aborted) throw err;
        throw toToolCallError(err);
      }
      return parseToolResult(name, result);
    },

    async openLink(url: string): Promise<void> {
      const result = await app.openLink({ url });
      if (result.isError) throw new Error("Host menolak membuka tautan");
    },

    async sendMessage(text: string): Promise<void> {
      const result = await app.sendMessage({ role: "user", content: [{ type: "text", text }] });
      if (result.isError) throw new Error("Host menolak mengirim pesan");
    },

    async updateContext(text: string): Promise<void> {
      if (!app.getHostCapabilities()?.updateModelContext) return;
      await app.updateModelContext({ content: [{ type: "text", text }] });
    },

    async toggleFullscreen(): Promise<void> {
      const current = app.getHostContext()?.displayMode ?? "inline";
      await app.requestDisplayMode({ mode: current === "fullscreen" ? "inline" : "fullscreen" });
    },
  };
}
```

- [ ] **Step 13: Implement the fixtures and the mock bridge**

Fixtures are synthetic (Pelanggan A…F, Pemasok A…H, Kasir A, phones `0800-0000-000N`), deterministic (fixed `generated_at`, arithmetic noise instead of `Math.random`) and parse with every output schema. The mock bridge validates input with the real input schema and runs every payload through `parseToolResult`, so a fixture that drifts from the contract fails in dev and tests exactly like a server payload would.

`widgets/dev/fixtures.ts`:

```ts
/**
 * Synthetic, deterministic tool payloads for the mock bridge (widgets:dev, widget tests, smoke test).
 * Every payload parses with TOOL_SCHEMAS[name].output. No real names, phone numbers or invoices.
 */
import {
  AGING_BUCKET_KEYS,
  AGING_BUCKET_LABEL,
  PO_STATUSES,
  STOCK_MOVEMENT_TYPES,
  poStatusLabel,
  salesStatusLabel,
  stockMovementLabel,
  type AgingBucketKey,
  type ProductOrder,
  type ToolInput,
  type ToolName,
  type ToolOutput,
} from "../../src/widgets/contract";
import { addIsoDays, isoDaysBetween } from "../src/lib/dates";

export const FIXTURE_OUTLET_ID = "100001";
export const FIXTURE_TODAY = "2026-09-15";
const GENERATED_AT = "2026-09-15T03:00:00.000Z";
const CATEGORIES = ["Minuman", "Makanan", "Snack", "Kebutuhan Rumah"] as const;
const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

function meta(outletId: string | undefined) {
  return { outlet_id: outletId ?? FIXTURE_OUTLET_ID, generated_at: GENERATED_AT, truncated: false, truncated_reason: null };
}

function pick<T>(items: readonly T[], index: number): T {
  return items[((index % items.length) + items.length) % items.length] as T;
}

/** Deterministic pseudo-random integer in [0, modulo). */
function noise(seed: number, modulo: number): number {
  return (seed * 7919 + 104_729) % modulo;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Inclusive day list, newest last, at most `max` days (the newest ones). */
function daysOf(start: string, end: string, max: number): string[] {
  const span = Math.max(0, isoDaysBetween(start, end));
  const first = Math.max(0, span + 1 - max);
  const days: string[] = [];
  for (let i = first; i <= span; i += 1) days.push(addIsoDays(start, i));
  return days;
}

function jakartaIso(date: string, hour: number, minute: number): string {
  return new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+07:00`).toISOString();
}

// ── Products ────────────────────────────────────────────────────────────────

const PRODUCT_PAGE_SIZE = 50;
const PRODUCT_PAGES = 3;

function productRow(rank: number, order: ProductOrder) {
  const total = PRODUCT_PAGE_SIZE * PRODUCT_PAGES;
  const byQuantity = order === "terlaris" || order === "kurang_laris";
  const descending = order === "terlaris" || order === "omzet_tertinggi";
  const position = descending ? rank : total + 1 - rank;
  const quantity = byQuantity ? (total + 1 - position) * 3 : 20 + noise(position, 30);
  const gross = byQuantity ? quantity * 8_500 : (total + 1 - position) * 42_000;
  return {
    rank,
    id: 1000 + position,
    name: `Produk ${position}`,
    category: pick(CATEGORIES, position),
    sku: `SKU-${1000 + position}`,
    quantity,
    unit: "pcs",
    gross,
    collected: Math.round(gross * 0.97),
  };
}

function productPage(order: ProductOrder, page: number) {
  const rows = Array.from({ length: PRODUCT_PAGE_SIZE }, (_, i) => productRow((page - 1) * PRODUCT_PAGE_SIZE + i + 1, order));
  return { rows, next_page: page < PRODUCT_PAGES ? page + 1 : null };
}

function categoryRows(count: number) {
  return CATEGORIES.slice(0, count).map((name, i) => {
    const gross = (CATEGORIES.length - i) * 1_150_000;
    return { id: 10 + i, name, quantity: (CATEGORIES.length - i) * 64, gross, collected: Math.round(gross * 0.97) };
  });
}

// ── Stock ───────────────────────────────────────────────────────────────────

const STOCK_PAGE_SIZE = 50;
const STOCK_CATALOG = Array.from({ length: 120 }, (_, i) => {
  const n = i + 1;
  const daysSinceSale = n % 9 === 0 ? null : noise(n, 120);
  const daysSinceAdjustment = n % 4 === 0 ? null : noise(n + 3, 200);
  return {
    inventory_id: 5000 + n,
    name: `${n % 3 === 0 ? "Kopi" : "Produk"} ${n} - Reguler`,
    stock: n % 7 === 0 ? 0 : noise(n, 60),
    price_sell: 5_000 + n * 250,
    last_sale_at: daysSinceSale === null ? null : jakartaIso(addIsoDays(FIXTURE_TODAY, -daysSinceSale), 9, 15),
    days_since_sale: daysSinceSale,
    last_adjustment_at: daysSinceAdjustment === null ? null : jakartaIso(addIsoDays(FIXTURE_TODAY, -daysSinceAdjustment), 17, 40),
    days_since_adjustment: daysSinceAdjustment,
  };
});

function stockMatches(search: string | undefined) {
  const needle = search?.trim().toLowerCase() ?? "";
  return needle === "" ? STOCK_CATALOG : STOCK_CATALOG.filter((row) => row.name.toLowerCase().includes(needle));
}

function stockSlice(search: string | undefined, page: number) {
  const matches = stockMatches(search);
  const rows = matches.slice((page - 1) * STOCK_PAGE_SIZE, page * STOCK_PAGE_SIZE);
  return { matches, rows, next_page: page * STOCK_PAGE_SIZE < matches.length ? page + 1 : null };
}

const HISTORY_PAGES = 3;

// ── Purchases ───────────────────────────────────────────────────────────────

const PURCHASE_PAGE_SIZE = 100;
const PURCHASE_TOTAL = 180;

function purchaseRow(n: number) {
  const status = pick(PO_STATUSES, noise(n, 5) === 0 ? 2 : n % 3 === 0 ? 1 : 0);
  return {
    id: String(70_000 + n),
    order_no: `PO-2026-${String(n).padStart(4, "0")}`,
    supplier: `Pemasok ${pick(LETTERS, n)}`,
    total: 250_000 + noise(n, 40) * 25_000,
    status,
    status_label: poStatusLabel(status),
    created_at: jakartaIso(addIsoDays(FIXTURE_TODAY, -Math.floor(n / 3)), 10, 5),
  };
}

function purchasePage(page: number) {
  const first = (page - 1) * PURCHASE_PAGE_SIZE + 1;
  const last = Math.min(page * PURCHASE_PAGE_SIZE, PURCHASE_TOTAL);
  const rows = [];
  for (let n = first; n <= last; n += 1) rows.push(purchaseRow(n));
  return { rows, next_page: last < PURCHASE_TOTAL ? page + 1 : null };
}

// ── Transactions ────────────────────────────────────────────────────────────

const PAYMENT_MODES = ["Tunai", "QRIS", "Transfer Bank"] as const;
const WEB_STATUSES = [2, 2, 2, 3, 2, 6] as const;

function transactionDay(date: string, dayIndex: number) {
  const items = Array.from({ length: 6 }, (_, i) => {
    const seed = dayIndex * 10 + i;
    const status = pick(WEB_STATUSES, i);
    return {
      sales_id: 900_000 + seed,
      time: `${String(8 + i * 2).padStart(2, "0")}:${String(noise(seed, 60)).padStart(2, "0")}`,
      invoice: `INV/${date.replaceAll("-", "")}/${String(seed).padStart(4, "0")}`,
      payment_mode: pick(PAYMENT_MODES, seed),
      amount: status === 6 ? 0 : 35_000 + noise(seed, 20) * 5_000,
      status,
      status_label: salesStatusLabel(status),
      sales_type: i % 2 === 0 ? "Dine In" : "Take Away",
    };
  });
  const daily_amount = items.filter((item) => item.status !== 3).reduce((sum, item) => sum + item.amount, 0);
  return { date, daily_amount, items };
}

// ── Debts ───────────────────────────────────────────────────────────────────

const DEBT_CUSTOMERS = LETTERS.slice(0, 6).map((letter, i) => ({
  customer_id: 3001 + i,
  name: `Pelanggan ${letter}`,
  invoices: 1 + (i % 3),
  credit_total: (6 - i) * 275_000,
  oldest_sale_date: addIsoDays(FIXTURE_TODAY, -[3, 20, 75, 150, 300, 800][i]!),
  oldest_bucket: AGING_BUCKET_KEYS[[0, 1, 2, 3, 4, 6][i]!] as AgingBucketKey,
  nearest_due_date: i === 5 ? null : addIsoDays(FIXTURE_TODAY, [10, -5, -40, 4, -200, 0][i]!),
  overdue_invoices: [0, 1, 2, 0, 1, 0][i]!,
  max_days_overdue: [0, 5, 40, 0, 200, 0][i]!,
}));

// ── Fixtures ────────────────────────────────────────────────────────────────

export const FIXTURES: { [N in ToolName]: (args: ToolInput<N>) => ToolOutput<N> } = {
  show_sales_dashboard: (args) => {
    const length = isoDaysBetween(args.start_date, args.end_date) + 1;
    const comparison = { start_date: addIsoDays(args.start_date, -length), end_date: addIsoDays(args.start_date, -1) };
    const trend = daysOf(args.start_date, args.end_date, 366).map((date, i) => ({
      date,
      amount: 900_000 + noise(i, 11) * 55_000,
      comparison_date: addIsoDays(date, -length),
      comparison_amount: 850_000 + noise(i + 5, 11) * 50_000,
    }));
    const gross = trend.reduce((sum, point) => sum + point.amount, 0);
    const transactions = length * 24;
    return {
      view: "penjualan",
      ...meta(args.outlet_id),
      range: { start_date: args.start_date, end_date: args.end_date },
      comparison,
      kpis: {
        sales_before_discount: gross + length * 15_000,
        discount: length * 15_000,
        gross_sales: gross,
        profit: Math.round(gross * 0.31),
        capital: Math.round(gross * 0.69),
        tax: Math.round(gross * 0.1),
        transactions,
        quantity: transactions * 3,
        average_ticket: Math.round(gross / transactions),
      },
      changes: {
        gross: { percent: 12.5, direction: "up" },
        profit: { percent: 3.2, direction: "down" },
        transactions: { percent: null, direction: null },
        quantity: { percent: 8, direction: "up" },
      },
      trend,
      payment_methods: [
        { name: "Tunai", quantity: 42, amount: Math.round(gross * 0.6) },
        { name: "QRIS", quantity: 18, amount: Math.round(gross * 0.3) },
        { name: "Transfer Bank", quantity: 5, amount: Math.round(gross * 0.1) },
      ],
      categories: categoryRows(4),
      top_products: productPage("terlaris", 1).rows.slice(0, 5),
      receivable: { total: 3_450_000, customers: 6 },
    };
  },

  show_product_ranking: (args) => {
    const order = args.order ?? "terlaris";
    const { rows, next_page } = productPage(order, 1);
    return {
      view: "produk",
      ...meta(args.outlet_id),
      range: { start_date: args.start_date, end_date: args.end_date },
      order,
      rows,
      categories: categoryRows(4),
      manual_transactions: { quantity: 3, gross: 45_000 },
      next_page,
    };
  },

  product_ranking_page: (args) => ({
    ...meta(args.outlet_id),
    order: args.order,
    page: args.page,
    ...productPage(args.order, args.page),
  }),

  show_stock_browser: (args) => {
    const search = args.search?.trim() || null;
    const { matches, rows, next_page } = stockSlice(args.search, 1);
    return { view: "stok", ...meta(args.outlet_id), search, rows, total_rows: matches.length, next_page };
  },

  stock_page: (args) => {
    const { rows, next_page } = stockSlice(args.search, args.page);
    return { ...meta(args.outlet_id), search: args.search?.trim() || null, page: args.page, rows, next_page };
  },

  stock_history: (args) => {
    const item = STOCK_CATALOG.find((row) => row.inventory_id === args.inventory_id);
    const stock = item?.stock ?? 12;
    const count = args.page < HISTORY_PAGES ? 50 : 20;
    const movements = Array.from({ length: count }, (_, i) => {
      const index = (args.page - 1) * 50 + i;
      const type = pick(STOCK_MOVEMENT_TYPES, noise(index, 7) === 0 ? 5 : index % 4 === 0 ? 1 : 0);
      const quantity = type === "sales" ? -(1 + noise(index, 3)) : 2 + noise(index, 10);
      return {
        id: `mv-${args.inventory_id}-${index + 1}`,
        at: jakartaIso(addIsoDays(FIXTURE_TODAY, -Math.floor(index / 4)), 8 + (index % 10), 30),
        type,
        type_label: stockMovementLabel(type),
        quantity,
        balance: Math.max(0, stock + index),
        note: type === "adjustment-plus" ? "Stok opname" : "",
        by: type === "sales" ? "Kasir A" : "Staf Gudang A",
        sales_id: type === "sales" ? String(900_000 + index) : null,
      };
    });
    return {
      ...meta(args.outlet_id),
      inventory_id: args.inventory_id,
      product_name: item ? item.name.replace(" - ", "-") : "Produk-Reguler",
      stock,
      page: args.page,
      movements,
      next_page: args.page < HISTORY_PAGES ? args.page + 1 : null,
    };
  },

  stock_velocity: (args) => {
    const item = STOCK_CATALOG.find((row) => row.inventory_id === args.inventory_id);
    const stock = item?.stock ?? 12;
    const sold = 45;
    const refunded = 1;
    const net = sold - refunded;
    const dailyRate = round2(net / 30);
    return {
      ...meta(args.outlet_id),
      inventory_id: args.inventory_id,
      stock,
      window_days: 30,
      sold,
      refunded,
      net_sold: net,
      daily_rate: dailyRate,
      days_of_cover: dailyRate > 0 ? round2(stock / dailyRate) : null,
      oldest_scanned_at: jakartaIso(addIsoDays(FIXTURE_TODAY, -31), 7, 0),
    };
  },

  show_purchase_orders: (args) => {
    const statusFilter = args.status ?? "semua";
    const scanned = statusFilter === "semua" ? purchasePage(1).rows : [...purchasePage(1).rows, ...purchasePage(2).rows];
    const statusCounts: Record<string, number> = {};
    for (const row of scanned) statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
    return {
      view: "pembelian",
      ...meta(args.outlet_id),
      status_filter: statusFilter,
      rows: statusFilter === "semua" ? scanned : scanned.filter((row) => row.status === statusFilter),
      status_counts: statusCounts,
      scanned_rows: scanned.length,
      total_rows: PURCHASE_TOTAL,
      next_page: statusFilter === "semua" ? 2 : null,
    };
  },

  purchase_orders_page: (args) => ({ ...meta(args.outlet_id), page: args.page, ...purchasePage(args.page) }),

  purchase_order_items: (args) => {
    const items = [
      { product: "Produk 1", variant: "Reguler", quantity: 10, received: 10, unit: "pcs", price: 12_000 },
      { product: "Produk 2", variant: "Besar", quantity: 6, received: 4, unit: "pcs", price: 18_500 },
      { product: "Kopi 3", variant: "", quantity: 2.5, received: 2.5, unit: "kg", price: 95_000 },
    ].map((item) => ({ ...item, subtotal: Math.round(item.quantity * item.price) }));
    return {
      ...meta(args.outlet_id),
      purchase_id: args.purchase_id,
      items,
      total: items.reduce((sum, item) => sum + item.subtotal, 0),
    };
  },

  show_transactions: (args) => {
    const days = daysOf(args.start_date, args.end_date, 7)
      .reverse()
      .map((date, i) => transactionDay(date, i));
    const loaded = days.flatMap((day) => day.items);
    const totals = new Map<string, { payment_mode: string; count: number; amount: number }>();
    for (const item of loaded) {
      const entry = totals.get(item.payment_mode) ?? { payment_mode: item.payment_mode, count: 0, amount: 0 };
      entry.count += 1;
      if (item.status !== 3) entry.amount += item.amount;
      totals.set(item.payment_mode, entry);
    }
    return {
      view: "transaksi",
      ...meta(args.outlet_id),
      range: { start_date: args.start_date, end_date: args.end_date },
      customer: args.customer_id === undefined ? null : { id: args.customer_id, name: "Pelanggan A" },
      days,
      total_transactions: loaded.length + 24,
      loaded_transactions: loaded.length,
      loaded_amount: loaded.filter((item) => item.status !== 3).reduce((sum, item) => sum + item.amount, 0),
      payment_mode_totals: [...totals.values()],
      next_page: 2,
    };
  },

  transactions_page: (args) => {
    const days = [0, 1].map((k) => {
      const date = addIsoDays(args.end_date, -(7 + (args.page - 2) * 2 + k));
      return transactionDay(date, 10 * args.page + k);
    });
    return { ...meta(args.outlet_id), page: args.page, days, next_page: args.page < 3 ? args.page + 1 : null };
  },

  order_detail: (args) => {
    const credit = args.sales_id % 5 === 0;
    const items = [
      { product: "Produk 1", variant: "Reguler", quantity: 2, price: 15_000 },
      { product: "Kopi 3", variant: null, quantity: 1, price: 22_000 },
    ].map((item) => ({ ...item, total: item.quantity * item.price }));
    const totalBill = items.reduce((sum, item) => sum + item.total, 0);
    const paid = credit ? 20_000 : 60_000;
    return {
      ...meta(undefined),
      sales_id: args.sales_id,
      invoice: `INV/20260915/${String(args.sales_id % 10_000).padStart(4, "0")}`,
      status: credit ? 4 : 2,
      status_label: credit ? "Kredit belum lunas" : salesStatusLabel(2),
      settled_at: credit ? null : "2026-09-15T02:32:00.000Z",
      total_bill: totalBill,
      total_paid: paid,
      change: credit ? 0 : paid - totalBill,
      items,
      payments: [{ name: credit ? "Uang muka" : "Tunai", mode: "cash", amount: paid, paid_at: "2026-09-15T02:32:00.000Z" }],
      customer: credit ? { id: 3001, name: "Pelanggan A", mobile: "0800-0000-0001" } : null,
      credit: credit ? { period: 30, unit: "hari", due_date: "2026-10-15", total: totalBill, remaining: totalBill - paid } : null,
      cashier: "Kasir A",
    };
  },

  show_customer_debts: (args) => {
    const buckets = AGING_BUCKET_KEYS.map((key, i) => {
      const members = DEBT_CUSTOMERS.filter((customer) => customer.oldest_bucket === key);
      const creditTotal = members.reduce((sum, customer) => sum + customer.credit_total, 0);
      return {
        key,
        label: AGING_BUCKET_LABEL[key],
        invoices: members.reduce((sum, customer) => sum + customer.invoices, 0),
        customers: members.length,
        credit_total: creditTotal,
        receivable: Math.round(creditTotal * (i < 3 ? 0.8 : 1)),
      };
    });
    const overdue = DEBT_CUSTOMERS.filter((customer) => customer.overdue_invoices > 0);
    const customers = [...DEBT_CUSTOMERS].sort(
      (a, b) => Number(b.overdue_invoices > 0) - Number(a.overdue_invoices > 0) || b.credit_total - a.credit_total,
    );
    return {
      view: "piutang",
      ...meta(args.outlet_id),
      as_of: FIXTURE_TODAY,
      summary: {
        receivable_total: buckets.reduce((sum, bucket) => sum + bucket.receivable, 0),
        customers: DEBT_CUSTOMERS.length,
        open_invoices: DEBT_CUSTOMERS.reduce((sum, customer) => sum + customer.invoices, 0),
        credit_total: DEBT_CUSTOMERS.reduce((sum, customer) => sum + customer.credit_total, 0),
        overdue_invoices: overdue.reduce((sum, customer) => sum + customer.overdue_invoices, 0),
        overdue_customers: overdue.length,
      },
      buckets,
      customers,
      focus_customer_id: args.customer_id ?? null,
    };
  },

  customer_debt_detail: (args) => {
    const index = Math.max(0, (args.customer_id - 3001) % LETTERS.length);
    const invoices = [0, 1, 2].map((k) => {
      const saleDate = addIsoDays(FIXTURE_TODAY, -(10 + k * 30));
      const dueDate = addIsoDays(saleDate, 30);
      const daysOverdue = isoDaysBetween(dueDate, FIXTURE_TODAY);
      const total = 150_000 + k * 50_000;
      const paid = k * 25_000;
      return {
        sales_id: 950_000 + args.customer_id * 10 + k,
        invoice: `INV/KREDIT/${args.customer_id}-${k + 1}`,
        sale_date: saleDate,
        due_date: dueDate,
        days_overdue: daysOverdue > 0 ? daysOverdue : null,
        bucket: pick(AGING_BUCKET_KEYS, k === 0 ? 1 : 2),
        total,
        paid,
        remaining: total - paid,
        payments: paid > 0 ? [{ name: "Tunai", amount: paid, paid_at: jakartaIso(addIsoDays(saleDate, 7), 11, 0) }] : [],
      };
    });
    return {
      ...meta(args.outlet_id),
      customer: {
        id: args.customer_id,
        name: `Pelanggan ${pick(LETTERS, index)}`,
        mobile: `0800-0000-${String(index + 1).padStart(4, "0")}`,
      },
      invoices,
      totals: {
        total: invoices.reduce((sum, invoice) => sum + invoice.total, 0),
        paid: invoices.reduce((sum, invoice) => sum + invoice.paid, 0),
        remaining: invoices.reduce((sum, invoice) => sum + invoice.remaining, 0),
      },
    };
  },
};

/** One valid argument object per tool, used by tests and the smoke test. */
export const SAMPLE_ARGS: { [N in ToolName]: ToolInput<N> } = {
  show_sales_dashboard: { start_date: "2026-09-09", end_date: FIXTURE_TODAY },
  show_product_ranking: { start_date: "2026-09-09", end_date: FIXTURE_TODAY, order: "terlaris" },
  product_ranking_page: { start_date: "2026-09-09", end_date: FIXTURE_TODAY, order: "terlaris", page: 2 },
  show_stock_browser: { search: "Kopi" },
  stock_page: { page: 2 },
  stock_history: { inventory_id: 5003, page: 1 },
  stock_velocity: { inventory_id: 5003 },
  show_purchase_orders: { status: "semua" },
  purchase_orders_page: { page: 2 },
  purchase_order_items: { purchase_id: "70001" },
  show_transactions: { start_date: FIXTURE_TODAY, end_date: FIXTURE_TODAY },
  transactions_page: { start_date: "2026-09-01", end_date: FIXTURE_TODAY, page: 2 },
  order_detail: { sales_id: 900_005 },
  show_customer_debts: {},
  customer_debt_detail: { customer_id: 3002 },
};
```

`widgets/src/bridge/mockBridge.ts`:

```ts
import { TOOL_SCHEMAS, type ToolInput, type ToolName, type ToolOutput } from "../../../src/widgets/contract";
import { FIXTURES } from "../../dev/fixtures";
import { ToolCallError, parseToolResult, type Bridge, type HostInfo } from "./bridge";

export interface MockBridgeOptions {
  latencyMs?: number;
  /** Tool name → error code the call fails with. */
  failWith?: Partial<Record<ToolName, string>>;
  host?: Partial<HostInfo>;
}

/** A Bridge answering from widgets/dev/fixtures.ts, recording what the view asked for. */
export interface MockBridge extends Bridge {
  readonly calls: Array<{ name: ToolName; args: unknown }>;
  readonly openedLinks: string[];
  readonly sentMessages: string[];
  readonly contextUpdates: string[];
}

export const MOCK_CONNECT_URL = "https://widget.example/connect";

function wait(ms: number, signal: AbortSignal | undefined): Promise<void> {
  if (signal?.aborted) return Promise.reject(signal.reason);
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

export function createMockBridge(options: MockBridgeOptions = {}): MockBridge {
  const host: HostInfo = {
    theme: "light",
    displayMode: "inline",
    canFullscreen: true,
    canSendMessage: true,
    canUpdateContext: true,
    canOpenLinks: true,
    ...options.host,
  };
  const calls: MockBridge["calls"] = [];
  const openedLinks: string[] = [];
  const sentMessages: string[] = [];
  const contextUpdates: string[] = [];

  return {
    host,
    calls,
    openedLinks,
    sentMessages,
    contextUpdates,

    async callTool<N extends ToolName>(name: N, args: ToolInput<N>, signal?: AbortSignal): Promise<ToolOutput<N>> {
      calls.push({ name, args });
      await wait(options.latencyMs ?? 0, signal);
      const failCode = options.failWith?.[name];
      if (failCode) {
        throw new ToolCallError({
          code: failCode,
          message: `Mock failure ${failCode}`,
          ...(failCode === "QASIR_AUTH_EXPIRED" ? { connect_url: MOCK_CONNECT_URL } : {}),
        });
      }
      const input = TOOL_SCHEMAS[name].input.safeParse(args);
      if (!input.success) {
        throw new ToolCallError({ code: "INVALID_INPUT", message: `Input validation error: Invalid arguments for tool ${name}` });
      }
      const fixture = FIXTURES[name] as (fixtureArgs: ToolInput<N>) => ToolOutput<N>;
      return parseToolResult(name, { structuredContent: fixture(args) });
    },

    async openLink(url: string): Promise<void> {
      openedLinks.push(url);
    },

    async sendMessage(text: string): Promise<void> {
      sentMessages.push(text);
    },

    async updateContext(text: string): Promise<void> {
      contextUpdates.push(text);
    },

    async toggleFullscreen(): Promise<void> {
      host.displayMode = host.displayMode === "fullscreen" ? "inline" : "fullscreen";
    },
  };
}
```

- [ ] **Step 14: Run the tests and widget types**

Run: `bun run widgets:test test/bridge.test.ts test/fixtures.test.ts && bun run widgets:check-types`
Expected: 2 test files PASS (32 tests); `tsc` exits 0.

- [ ] **Step 15: Commit**

```bash
git add widgets/src/bridge/bridge.ts widgets/src/bridge/extAppsBridge.ts widgets/src/bridge/mockBridge.ts widgets/src/lib/errors.ts widgets/dev/fixtures.ts widgets/test/bridge.test.ts widgets/test/fixtures.test.ts
git commit -m "feat(widgets): tool-result bridge (ext-apps + fixture mock), error copy and synthetic fixtures

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 16: Write the failing query-policy, seeding and paging tests**

`widgets/test/query.test.tsx`:

```tsx
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { NO_RETRY, createWidgetQueryClient, shouldRetry } from "../src/app/queryClient";
import { BridgeContext, ToolCallError, type Bridge } from "../src/bridge/bridge";
import { createInitialToolCall, primeInitialQuery, seedInitialResult } from "../src/bridge/initialResult";
import { createMockBridge } from "../src/bridge/mockBridge";
import { toolQueryKey, useMorePages, useToolQuery } from "../src/bridge/useToolQuery";
import { FIXTURES } from "../dev/fixtures";

function wrapperFor(bridge: Bridge, queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <BridgeContext.Provider value={bridge}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </BridgeContext.Provider>
    );
  };
}

describe("createWidgetQueryClient", () => {
  it("sets iframe-friendly defaults", () => {
    const queries = createWidgetQueryClient().getDefaultOptions().queries;
    expect(queries).toMatchObject({
      staleTime: 60_000,
      gcTime: 600_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      networkMode: "always",
    });
    expect(queries?.retry).toBe(shouldRetry);
  });

  it("retries once, never for auth, permission, input, rate-limit or contract errors", () => {
    const err = (code: string) => new ToolCallError({ code, message: code });
    expect(shouldRetry(0, err("UPSTREAM_ERROR"))).toBe(true);
    expect(shouldRetry(1, err("UPSTREAM_ERROR"))).toBe(false);
    expect(shouldRetry(0, err("UPSTREAM_TIMEOUT"))).toBe(true);
    for (const code of ["QASIR_AUTH_EXPIRED", "FORBIDDEN", "INVALID_INPUT", "QASIR_RATE_LIMITED", "CONTRACT_MISMATCH"]) {
      expect(NO_RETRY.has(code)).toBe(true);
      expect(shouldRetry(0, err(code))).toBe(false);
    }
    expect(shouldRetry(0, new Error("plain"))).toBe(true);
  });
});

describe("seedInitialResult", () => {
  const args = { inventory_id: 5003 };
  const payload = FIXTURES.stock_velocity(args);

  it("stores a valid result under the tool query key", () => {
    const queryClient = createWidgetQueryClient();
    expect(seedInitialResult(queryClient, "stock_velocity", args, { structuredContent: payload, content: [] })).toBe(true);
    expect(queryClient.getQueryData(toolQueryKey("stock_velocity", { inventory_id: 5003 }))).toEqual(payload);
  });

  it("seeds nothing for error results, contract mismatches and non-objects", () => {
    const queryClient = createWidgetQueryClient();
    const key = toolQueryKey("stock_velocity", args);
    expect(
      seedInitialResult(queryClient, "stock_velocity", args, {
        isError: true,
        content: [{ type: "text", text: '{"code":"FORBIDDEN","message":"no"}' }],
      }),
    ).toBe(false);
    expect(seedInitialResult(queryClient, "stock_velocity", args, { structuredContent: { view: "stok" } })).toBe(false);
    expect(seedInitialResult(queryClient, "stock_velocity", args, "nope")).toBe(false);
    expect(queryClient.getQueryData(key)).toBeUndefined();
  });
});

describe("primeInitialQuery", () => {
  const args = { inventory_id: 5003 };

  it("waits for the host result instead of calling the tool", async () => {
    const queryClient = createWidgetQueryClient();
    const bridge = createMockBridge();
    const call = createInitialToolCall();
    primeInitialQuery(queryClient, bridge, "stock_velocity", args, call);
    const { result } = renderHook(() => useToolQuery("stock_velocity", args), { wrapper: wrapperFor(bridge, queryClient) });
    expect(result.current.isPending).toBe(true);
    call.setResult({ structuredContent: FIXTURES.stock_velocity(args) });
    await waitFor(() => expect(result.current.data?.stock).toBe(FIXTURES.stock_velocity(args).stock));
    expect(bridge.calls).toEqual([]);
  });

  it("seeds synchronously when the result already arrived", () => {
    const queryClient = createWidgetQueryClient();
    const bridge = createMockBridge();
    const call = createInitialToolCall();
    call.setResult({ structuredContent: FIXTURES.stock_velocity(args) });
    primeInitialQuery(queryClient, bridge, "stock_velocity", args, call);
    expect(queryClient.getQueryData(toolQueryKey("stock_velocity", args))).toBeDefined();
  });

  it("surfaces a host error result as the query error without calling the tool", async () => {
    const queryClient = createWidgetQueryClient();
    const bridge = createMockBridge();
    const call = createInitialToolCall();
    primeInitialQuery(queryClient, bridge, "stock_velocity", args, call);
    const { result } = renderHook(() => useToolQuery("stock_velocity", args), { wrapper: wrapperFor(bridge, queryClient) });
    call.setResult({ isError: true, content: [{ type: "text", text: '{"code":"QASIR_AUTH_EXPIRED","message":"expired"}' }] });
    await waitFor(() => expect(result.current.error?.code).toBe("QASIR_AUTH_EXPIRED"));
    expect(bridge.calls).toEqual([]);
  });

  it("calls the tool when the host cancels the call", async () => {
    const queryClient = createWidgetQueryClient();
    const bridge = createMockBridge();
    const call = createInitialToolCall();
    primeInitialQuery(queryClient, bridge, "stock_velocity", args, call);
    call.cancel();
    await waitFor(() => expect(queryClient.getQueryData(toolQueryKey("stock_velocity", args))).toBeDefined());
    expect(bridge.calls).toEqual([{ name: "stock_velocity", args }]);
  });
});

describe("createInitialToolCall", () => {
  it("keeps the first input and times out when none arrives", async () => {
    const call = createInitialToolCall();
    expect(await call.waitForInput(5)).toBeNull();
    call.setInput({ search: "Kopi" });
    call.setInput({ search: "Teh" });
    expect(await call.waitForInput(5)).toEqual({ search: "Kopi" });
  });
});

describe("useToolQuery", () => {
  it("fetches through the bridge", async () => {
    const bridge = createMockBridge();
    const { result } = renderHook(() => useToolQuery("show_purchase_orders", { status: "completed" }), {
      wrapper: wrapperFor(bridge, createWidgetQueryClient()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.rows.every((row) => row.status === "completed")).toBe(true);
  });

  it("exposes ToolCallError codes", async () => {
    const bridge = createMockBridge({ failWith: { show_purchase_orders: "FORBIDDEN" } });
    const { result } = renderHook(() => useToolQuery("show_purchase_orders", {}), {
      wrapper: wrapperFor(bridge, createWidgetQueryClient()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.code).toBe("FORBIDDEN");
    expect(bridge.calls).toHaveLength(1); // FORBIDDEN is never retried
  });
});

describe("useMorePages", () => {
  it("loads nothing until asked, then follows next_page", async () => {
    const bridge = createMockBridge();
    const { result } = renderHook(
      () =>
        useMorePages({
          tool: "stock_page",
          args: {},
          startPage: 2,
          rowsOf: (page) => page.rows,
        }),
      { wrapper: wrapperFor(bridge, createWidgetQueryClient()) },
    );
    expect(result.current.rows).toEqual([]);
    expect(result.current.hasMore).toBe(true);
    expect(bridge.calls).toEqual([]);

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toHaveLength(50));
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toHaveLength(70));
    expect(result.current.hasMore).toBe(false);
    expect(bridge.calls).toEqual([
      { name: "stock_page", args: { page: 2 } },
      { name: "stock_page", args: { page: 3 } },
    ]);

    act(() => result.current.loadMore());
    expect(bridge.calls).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it("does nothing when there is no next page or it is disabled", () => {
    const bridge = createMockBridge();
    const wrapper = wrapperFor(bridge, createWidgetQueryClient());
    const none = renderHook(() => useMorePages({ tool: "stock_page", args: {}, startPage: null, rowsOf: (page) => page.rows }), {
      wrapper,
    });
    const disabled = renderHook(
      () => useMorePages({ tool: "stock_page", args: {}, startPage: 2, rowsOf: (page) => page.rows, enabled: false }),
      { wrapper },
    );
    act(() => {
      none.result.current.loadMore();
      disabled.result.current.loadMore();
    });
    expect(none.result.current.hasMore).toBe(false);
    expect(disabled.result.current.hasMore).toBe(false);
    expect(bridge.calls).toEqual([]);
  });

  it("reports page errors", async () => {
    const bridge = createMockBridge({ failWith: { transactions_page: "QASIR_RATE_LIMITED" } });
    const { result } = renderHook(
      () =>
        useMorePages({
          tool: "transactions_page",
          args: { start_date: "2026-09-01", end_date: "2026-09-15" },
          startPage: 2,
          rowsOf: (page) => page.days,
        }),
      { wrapper: wrapperFor(bridge, createWidgetQueryClient()) },
    );
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.error?.code).toBe("QASIR_RATE_LIMITED"));
  });
});
```

- [ ] **Step 17: Run the test to verify it fails**

Run: `bun run widgets:test test/query.test.tsx`
Expected: FAIL with `Failed to resolve import "../src/app/queryClient" from "widgets/test/query.test.tsx"`.

- [ ] **Step 18: Implement the query client, tool query hooks and initial-result seeding**

`widgets/src/app/queryClient.ts`:

```ts
import { QueryClient } from "@tanstack/react-query";
import { ToolCallError } from "../bridge/bridge";

/**
 * Codes that must not be retried automatically. QASIR_AUTH_EXPIRED especially: a second 401 clears the
 * shared Qasir session. CONTRACT_MISMATCH is deterministic.
 */
export const NO_RETRY: ReadonlySet<string> = new Set([
  "QASIR_AUTH_EXPIRED",
  "FORBIDDEN",
  "INVALID_INPUT",
  "QASIR_RATE_LIMITED",
  "CONTRACT_MISMATCH",
]);

/** At most one retry, never for NO_RETRY codes. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ToolCallError && NO_RETRY.has(error.code)) return false;
  return failureCount < 1;
}

/** Query defaults for a widget inside a chat iframe: no focus/reconnect refetches, 60 s fresh data. */
export function createWidgetQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: 60_000,
        gcTime: 600_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        networkMode: "always",
      },
    },
  });
}
```

`widgets/src/bridge/useToolQuery.ts`:

```ts
import { useInfiniteQuery, useQuery, type InfiniteData, type UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import type { ToolInput, ToolName, ToolOutput } from "../../../src/widgets/contract";
import { useBridge, type ToolCallError } from "./bridge";

/** Query key for one tool call. Query hashes keys with sorted object keys, so argument order does not matter. */
export function toolQueryKey<N extends ToolName>(name: N, args: ToolInput<N>): readonly [N, ToolInput<N>] {
  return [name, args] as const;
}

/** Calls `name` through the bridge; the query's AbortSignal is forwarded to the host call. */
export function useToolQuery<N extends ToolName>(
  name: N,
  args: ToolInput<N>,
  options?: { enabled?: boolean },
): UseQueryResult<ToolOutput<N>, ToolCallError> {
  const bridge = useBridge();
  return useQuery<ToolOutput<N>, ToolCallError, ToolOutput<N>, readonly [N, ToolInput<N>]>({
    queryKey: toolQueryKey(name, args),
    queryFn: ({ signal }) => bridge.callTool(name, args, signal),
    enabled: options?.enabled ?? true,
  });
}

export type PageToolName = "product_ranking_page" | "stock_page" | "stock_history" | "purchase_orders_page" | "transactions_page";

export interface MorePages<Row> {
  rows: Row[];
  hasMore: boolean;
  loadMore: () => void;
  isFetching: boolean;
  error: ToolCallError | null;
}

/**
 * Rows beyond the first page. Nothing is fetched until loadMore(): the first call fetches `startPage`,
 * later calls follow each page's `next_page`. `startPage: null` means there is nothing more to load.
 */
export function useMorePages<N extends PageToolName, Row>(opts: {
  tool: N;
  args: Omit<ToolInput<N>, "page">;
  startPage: number | null;
  rowsOf: (page: ToolOutput<N>) => Row[];
  enabled?: boolean;
}): MorePages<Row> {
  const bridge = useBridge();
  const enabled = (opts.enabled ?? true) && opts.startPage !== null;
  const query = useInfiniteQuery<
    ToolOutput<N>,
    ToolCallError,
    InfiniteData<ToolOutput<N>, number>,
    readonly [N, Omit<ToolInput<N>, "page">, number | null],
    number
  >({
    queryKey: [opts.tool, opts.args, opts.startPage] as const,
    initialPageParam: opts.startPage ?? 1,
    queryFn: ({ pageParam, signal }) =>
      bridge.callTool(opts.tool, { ...opts.args, page: pageParam } as unknown as ToolInput<N>, signal),
    getNextPageParam: (lastPage) => (lastPage as { next_page: number | null }).next_page ?? undefined,
    // Manual: loadMore() drives every fetch.
    enabled: false,
  });

  const { data, hasNextPage, isFetching, refetch, fetchNextPage } = query;
  const rowsOf = opts.rowsOf;
  // Recompute only when pages change; rowsOf is usually an inline arrow.
  const rows = useMemo(() => data?.pages.flatMap((page) => rowsOf(page)) ?? [], [data]);

  const hasMore = enabled && (data === undefined ? true : hasNextPage);
  const loadMore = () => {
    if (!enabled || isFetching) return;
    if (data === undefined) void refetch();
    else if (hasNextPage) void fetchNextPage();
  };

  return { rows, hasMore, loadMore, isFetching, error: query.error ?? null };
}
```

`widgets/src/bridge/initialResult.ts`:

```ts
import type { QueryClient } from "@tanstack/react-query";
import type { ToolInput, ToolName } from "../../../src/widgets/contract";
import { parseToolResult, type Bridge, type ToolResultLike } from "./bridge";
import { toolQueryKey } from "./useToolQuery";

function isToolResultLike(value: unknown): value is ToolResultLike {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Seeds queryClient with the host-delivered tool result: setQueryData(toolQueryKey(name, args), parsed).
 * Returns false (and seeds nothing) for error results, contract mismatches and non-objects.
 */
export function seedInitialResult(queryClient: QueryClient, name: ToolName, args: Record<string, unknown>, result: unknown): boolean {
  if (!isToolResultLike(result)) return false;
  try {
    const data = parseToolResult(name, result);
    queryClient.setQueryData(toolQueryKey(name, args as ToolInput<typeof name>), data);
    return true;
  } catch {
    return false;
  }
}

/** The view tool call that opened the widget, as announced by the host (toolinput → toolresult). */
export interface InitialToolCall {
  setInput(args: Record<string, unknown>): void;
  setResult(result: unknown): void;
  cancel(): void;
  /** The result if it has already arrived. */
  peekResult(): unknown;
  /** Resolves with the first arguments, or null after `timeoutMs`. */
  waitForInput(timeoutMs: number): Promise<Record<string, unknown> | null>;
  /** Resolves with the result, or null when cancelled, after `timeoutMs`, or when `signal` aborts. */
  waitForResult(timeoutMs: number, signal?: AbortSignal): Promise<unknown>;
}

export function createInitialToolCall(): InitialToolCall {
  let input: Record<string, unknown> | undefined;
  let result: unknown;
  let settled = false; // result arrived or call cancelled
  const inputWaiters = new Set<(args: Record<string, unknown>) => void>();
  const resultWaiters = new Set<(value: unknown) => void>();

  const settle = (value: unknown) => {
    if (settled) return;
    settled = true;
    result = value;
    for (const waiter of resultWaiters) waiter(value);
    resultWaiters.clear();
  };

  return {
    setInput(args) {
      if (input !== undefined) return;
      input = args;
      for (const waiter of inputWaiters) waiter(args);
      inputWaiters.clear();
    },
    setResult(value) {
      settle(value ?? null);
    },
    cancel() {
      settle(null);
    },
    peekResult() {
      return settled ? result : undefined;
    },
    waitForInput(timeoutMs) {
      if (input !== undefined) return Promise.resolve(input);
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          inputWaiters.delete(done);
          resolve(null);
        }, timeoutMs);
        const done = (args: Record<string, unknown>) => {
          clearTimeout(timer);
          resolve(args);
        };
        inputWaiters.add(done);
      });
    },
    waitForResult(timeoutMs, signal) {
      if (settled) return Promise.resolve(result);
      return new Promise((resolve) => {
        const finish = (value: unknown) => {
          clearTimeout(timer);
          resultWaiters.delete(finish);
          signal?.removeEventListener("abort", onAbort);
          resolve(value);
        };
        const onAbort = () => finish(null);
        const timer = setTimeout(() => finish(null), timeoutMs);
        resultWaiters.add(finish);
        signal?.addEventListener("abort", onAbort, { once: true });
      });
    },
  };
}

export const INITIAL_RESULT_WAIT_MS = 90_000;

/**
 * Makes the first query for the opening view tool use the host's result instead of calling the tool again.
 * Already delivered ⇒ seeded synchronously. Otherwise a fetch that awaits the host result (an error result
 * becomes the query error); if the host cancels or never delivers, it calls the tool through the bridge.
 */
export function primeInitialQuery<N extends ToolName>(
  queryClient: QueryClient,
  bridge: Bridge,
  name: N,
  args: ToolInput<N>,
  call: InitialToolCall,
  waitMs: number = INITIAL_RESULT_WAIT_MS,
): void {
  const delivered = call.peekResult();
  if (delivered != null && seedInitialResult(queryClient, name, args as Record<string, unknown>, delivered)) return;
  void queryClient.prefetchQuery({
    queryKey: toolQueryKey(name, args),
    queryFn: async ({ signal }) => {
      const hostResult = delivered != null ? delivered : await call.waitForResult(waitMs, signal);
      if (signal.aborted) throw signal.reason;
      if (isToolResultLike(hostResult)) return parseToolResult(name, hostResult);
      return bridge.callTool(name, args, signal);
    },
  });
}
```

- [ ] **Step 19: Run the test and widget types**

Run: `bun run widgets:test test/query.test.tsx && bun run widgets:check-types`
Expected: 1 test file PASS (14 tests); `tsc` exits 0.

- [ ] **Step 20: Commit**

```bash
git add widgets/src/app/queryClient.ts widgets/src/bridge/useToolQuery.ts widgets/src/bridge/initialResult.ts widgets/test/query.test.tsx
git commit -m "feat(widgets): iframe query policy, tool query hooks, paging and host result seeding

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 21: Write the failing search and shell tests**

`widgets/test/search.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TOOL_SCHEMAS, VIEWS, VIEW_TOOL, type ViewName } from "../../src/widgets/contract";
import {
  penjualanSearch,
  piutangSearch,
  searchFromToolArgs,
  stokSearch,
  toolArgsFromSearch,
  transaksiSearch,
  viewPathWithSearch,
} from "../src/app/search";
import { VIEW_LABEL, VIEW_PATH, viewFromMarker } from "../src/app/viewPaths";

const today = "2026-09-15";

describe("viewPaths", () => {
  it("maps every view to a path and an Indonesian label", () => {
    expect(VIEWS.map((view) => VIEW_PATH[view])).toEqual(["/penjualan", "/produk", "/stok", "/pembelian", "/transaksi", "/piutang"]);
    expect(VIEWS.map((view) => VIEW_LABEL[view])).toEqual(["Penjualan", "Produk", "Stok", "Pembelian", "Transaksi", "Piutang"]);
  });

  it("reads the resource marker, defaulting to penjualan", () => {
    expect(viewFromMarker("stok")).toBe("stok");
    expect(viewFromMarker(" Piutang ")).toBe("piutang");
    expect(viewFromMarker("__MJ_VIEW__")).toBe("penjualan");
    expect(viewFromMarker(undefined)).toBe("penjualan");
  });
});

describe("search schemas", () => {
  it("fill defaults and recover from malformed values", () => {
    expect(penjualanSearch.parse({})).toMatchObject({ preset: "7_hari" });
    expect(transaksiSearch.parse({ preset: "besok", start_date: "kemarin", customer_id: -3 })).toMatchObject({
      preset: "hari_ini",
      start_date: undefined,
      customer_id: undefined,
    });
    expect(stokSearch.parse({ search: 42 })).toMatchObject({ search: "" });
    expect(piutangSearch.parse({ sort: "x", bucket: "8-30" })).toMatchObject({ sort: "overdue", bucket: "8-30" });
  });
});

describe("tool args ⇄ search", () => {
  const cases: Array<[ViewName, Record<string, unknown>]> = [
    ["penjualan", { start_date: "2026-09-09", end_date: today }],
    ["penjualan", { start_date: "2026-08-01", end_date: "2026-08-20", outlet_id: "100001" }],
    ["produk", { start_date: "2026-09-01", end_date: today, order: "omzet_terendah" }],
    ["stok", { search: "Kopi" }],
    ["stok", {}],
    ["pembelian", { status: "completed" }],
    ["transaksi", { start_date: today, end_date: today, customer_id: 3001, outlet_id: "100001" }],
    ["piutang", { customer_id: 3001 }],
    ["piutang", {}],
  ];

  it.each(cases)("%s %j round-trips", (view, args) => {
    const search = searchFromToolArgs(view, args, today);
    expect(toolArgsFromSearch(view, search, today)).toEqual(args);
  });

  it("produces arguments the view tool accepts", () => {
    for (const [view, args] of cases) {
      const toolArgs = toolArgsFromSearch(view, searchFromToolArgs(view, args, today), today);
      expect(TOOL_SCHEMAS[VIEW_TOOL[view]].input.safeParse(toolArgs).success).toBe(true);
    }
  });

  it("names the preset when the range matches one", () => {
    expect(searchFromToolArgs("penjualan", { start_date: "2026-09-09", end_date: today }, today)).toEqual({ preset: "7_hari" });
    expect(searchFromToolArgs("transaksi", { start_date: "2026-08-01", end_date: "2026-08-20" }, today)).toEqual({
      preset: "custom",
      start_date: "2026-08-01",
      end_date: "2026-08-20",
    });
  });

  it("normalizes model arguments", () => {
    expect(toolArgsFromSearch("stok", searchFromToolArgs("stok", { search: "  Kopi  " }, today), today)).toEqual({ search: "Kopi" });
    expect(toolArgsFromSearch("pembelian", searchFromToolArgs("pembelian", {}, today), today)).toEqual({ status: "semua" });
    expect(toolArgsFromSearch("produk", searchFromToolArgs("produk", { start_date: "2026-09-15", end_date: "2026-09-15" }, today), today)).toEqual({
      start_date: today,
      end_date: today,
      order: "terlaris",
    });
  });

  it("falls back to the view's default range for bad or missing dates", () => {
    expect(toolArgsFromSearch("penjualan", searchFromToolArgs("penjualan", { start_date: "bad", end_date: today }, today), today)).toEqual({
      start_date: "2026-09-09",
      end_date: today,
    });
    expect(toolArgsFromSearch("transaksi", { preset: "custom", start_date: "2026-09-10" }, today)).toEqual({
      start_date: today,
      end_date: today,
    });
    expect(toolArgsFromSearch("produk", { preset: "bulan_ini" }, today)).toEqual({
      start_date: "2026-09-01",
      end_date: today,
      order: "terlaris",
    });
  });

  it("builds memory-history paths the router can parse back", () => {
    expect(viewPathWithSearch("stok", { search: "Kopi" })).toBe("/stok?search=Kopi");
    expect(viewPathWithSearch("transaksi", { preset: "hari_ini", customer_id: 3001 })).toBe("/transaksi?preset=hari_ini&customer_id=3001");
    expect(viewPathWithSearch("piutang", {})).toBe("/piutang");
  });
});
```

`widgets/test/AppShell.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "../src/app/AppShell";
import { createWidgetRouter } from "../src/app/router";
import { createMockBridge } from "../src/bridge/mockBridge";
import { VIEW_ROUTES } from "../src/routes";

describe("AppShell with the mock bridge", () => {
  it("renders the not-found panel while no view routes are registered", async () => {
    expect(VIEW_ROUTES).toHaveLength(0);
    const bridge = createMockBridge();
    const { container } = render(<AppShell view="stok" bridge={bridge} />);
    expect(await screen.findByText("Tampilan belum tersedia")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(container.querySelector("form")).toBeNull();
    expect(bridge.calls).toEqual([]);
  });

  it("creates independent routers over memory history", () => {
    const first = createWidgetRouter({ initialPath: "/stok?search=Kopi" });
    const second = createWidgetRouter({ initialPath: "/piutang" });
    expect(first.history.location.pathname).toBe("/stok");
    expect(first.history.location.search).toBe("?search=Kopi");
    expect(second.history.location.pathname).toBe("/piutang");
  });
});
```

The next file tests the hosted shell's opening logic without a host: `startInitialView` receives plain callbacks, and `atViewDefaults` reads a memory-history location.

`widgets/test/initialView.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { atViewDefaults, startInitialView, type InitialViewOptions } from "../src/app/AppShell";
import { createWidgetQueryClient } from "../src/app/queryClient";
import { createWidgetRouter } from "../src/app/router";
import { createInitialToolCall } from "../src/bridge/initialResult";
import { createMockBridge } from "../src/bridge/mockBridge";
import { toolQueryKey } from "../src/bridge/useToolQuery";
import { FIXTURES } from "../dev/fixtures";

const today = "2026-09-15";
const kopiKey = toolQueryKey("show_stock_browser", { search: "Kopi" });

function setup(overrides: Partial<InitialViewOptions> = {}) {
  const queryClient = createWidgetQueryClient();
  const bridge = createMockBridge();
  const call = createInitialToolCall();
  const opened: string[] = [];
  const navigated: string[] = [];
  const options: InitialViewOptions = {
    view: "stok",
    call,
    queryClient,
    getBridge: () => bridge,
    open: (path) => {
      opened.push(path);
    },
    canApplyLate: () => true,
    navigate: (path) => {
      navigated.push(path);
    },
    today: () => today,
    inputWaitMs: 10,
    lateInputWaitMs: 1_000,
    ...overrides,
  };
  return { queryClient, bridge, call, opened, navigated, options };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

describe("startInitialView", () => {
  it("opens on the model's arguments when toolinput arrives in time", async () => {
    const t = setup();
    const payload = FIXTURES.show_stock_browser({ search: "Kopi" });
    startInitialView(t.options);
    t.call.setInput({ search: "  Kopi " });
    t.call.setResult({ structuredContent: payload });
    await vi.waitFor(() => expect(t.opened).toEqual(["/stok?search=Kopi"]));
    expect(t.queryClient.getQueryData(kopiKey)).toEqual(payload);
    await settle();
    expect(t.navigated).toEqual([]);
    expect(t.bridge.calls).toEqual([]);
  });

  it("opens on the defaults, then moves to a late toolinput and uses the host's result", async () => {
    const t = setup();
    const payload = FIXTURES.show_stock_browser({ search: "Kopi" });
    startInitialView(t.options);
    await vi.waitFor(() => expect(t.opened).toEqual(["/stok"]));
    expect(t.navigated).toEqual([]);

    t.call.setInput({ search: "Kopi" });
    await vi.waitFor(() => expect(t.navigated).toEqual(["/stok?search=Kopi"]));
    expect(t.queryClient.getQueryState(kopiKey)?.status).toBe("pending");

    t.call.setResult({ structuredContent: payload });
    await vi.waitFor(() => expect(t.queryClient.getQueryData(kopiKey)).toEqual(payload));
    expect(t.opened).toEqual(["/stok"]);
    expect(t.bridge.calls).toEqual([]);
  });

  it("ignores a late toolinput once the viewer has changed view or filters", async () => {
    const t = setup({ canApplyLate: () => false });
    startInitialView(t.options);
    await vi.waitFor(() => expect(t.opened).toEqual(["/stok"]));
    t.call.setInput({ search: "Kopi" });
    await settle();
    expect(t.navigated).toEqual([]);
    expect(t.queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(t.bridge.calls).toEqual([]);
  });

  it("stops listening when disposed, before or after opening", async () => {
    const before = setup();
    startInitialView(before.options)();
    before.call.setInput({ search: "Kopi" });
    await settle();
    expect(before.opened).toEqual([]);

    const after = setup();
    const stop = startInitialView(after.options);
    await vi.waitFor(() => expect(after.opened).toEqual(["/stok"]));
    stop();
    after.call.setInput({ search: "Kopi" });
    await settle();
    expect(after.navigated).toEqual([]);
    expect(after.queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});

describe("atViewDefaults", () => {
  it("is true only while the location shows the view with its default search params", () => {
    expect(atViewDefaults("stok", { pathname: "/stok", search: "" })).toBe(true);
    expect(atViewDefaults("stok", { pathname: "/stok", search: "?search=" })).toBe(true);
    expect(atViewDefaults("stok", { pathname: "/stok", search: "?search=Kopi" })).toBe(false);
    expect(atViewDefaults("stok", { pathname: "/piutang", search: "" })).toBe(false);
    expect(atViewDefaults("transaksi", { pathname: "/transaksi", search: "?preset=hari_ini" })).toBe(true);
    expect(atViewDefaults("transaksi", { pathname: "/transaksi", search: "?preset=kemarin" })).toBe(false);
    expect(atViewDefaults("piutang", { pathname: "/piutang", search: "?sort=credit" })).toBe(false);
  });

  it("follows the router's memory history", async () => {
    const router = createWidgetRouter({ initialPath: "/stok" });
    expect(atViewDefaults("stok", router.history.location)).toBe(true);
    await router.navigate({ href: "/stok?search=Kopi", replace: true });
    expect(router.history.location.search).toBe("?search=Kopi");
    expect(router.history.length).toBe(1);
    expect(atViewDefaults("stok", router.history.location)).toBe(false);
  });
});
```

- [ ] **Step 22: Run the tests to verify they fail**

Run: `bun run widgets:test test/search.test.ts test/AppShell.test.tsx test/initialView.test.ts`
Expected: FAIL with `Failed to resolve import "../src/app/viewPaths" from "widgets/test/search.test.ts"`, `Failed to resolve import "../src/app/AppShell" from "widgets/test/AppShell.test.tsx"` and `Failed to resolve import "../src/app/AppShell" from "widgets/test/initialView.test.ts"`.

- [ ] **Step 23: Implement view paths and search params**

`widgets/src/app/viewPaths.ts`:

```ts
import { VIEWS, type ViewName } from "../../../src/widgets/contract";

export const VIEW_PATH = {
  penjualan: "/penjualan",
  produk: "/produk",
  stok: "/stok",
  pembelian: "/pembelian",
  transaksi: "/transaksi",
  piutang: "/piutang",
} as const satisfies Record<ViewName, `/${ViewName}`>;

export const VIEW_LABEL: Record<ViewName, string> = {
  penjualan: "Penjualan",
  produk: "Produk",
  stok: "Stok",
  pembelian: "Pembelian",
  transaksi: "Transaksi",
  piutang: "Piutang",
};

/** The view named by the resource marker (data-view) or ?view=; anything else ⇒ "penjualan". */
export function viewFromMarker(marker: string | undefined): ViewName {
  const candidate = marker?.trim().toLowerCase();
  return (VIEWS as readonly string[]).includes(candidate ?? "") ? (candidate as ViewName) : "penjualan";
}
```

`widgets/src/app/search.ts`:

```ts
/**
 * Router search params per view (zod 4). Every field is `.default(x).catch(x)` or `.optional().catch(undefined)`,
 * so Links may omit search and malformed values recover instead of throwing.
 */
import { defaultStringifySearch } from "@tanstack/react-router";
import { z } from "zod";
import { AGING_BUCKET_KEYS, PO_STATUS_FILTERS, PRODUCT_ORDERS, isoDate, type ViewName } from "../../../src/widgets/contract";
import {
  PRESET_KEYS,
  isIsoDate,
  jakartaTodayBrowser,
  matchPreset,
  presetRange,
  type DateRangeValue,
  type RangePresetKey,
} from "../lib/dates";
import { VIEW_PATH } from "./viewPaths";

/** Preset used when a date view opens without (valid) dates. */
export const DEFAULT_PRESET = {
  penjualan: "7_hari",
  produk: "7_hari",
  transaksi: "hari_ini",
} as const satisfies Partial<Record<ViewName, RangePresetKey>>;

export const DEBT_SORTS = ["overdue", "credit", "oldest"] as const;
export type DebtSort = (typeof DEBT_SORTS)[number];

const outletIdParam = z
  .string()
  .regex(/^[1-9]\d{0,11}$/)
  .optional()
  .catch(undefined);
const dateParam = isoDate.optional().catch(undefined);
const customerIdParam = z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional().catch(undefined);
function presetParam(fallback: RangePresetKey) {
  return z.enum(PRESET_KEYS).default(fallback).catch(fallback);
}

export const penjualanSearch = z.object({
  preset: presetParam(DEFAULT_PRESET.penjualan),
  start_date: dateParam,
  end_date: dateParam,
  outlet_id: outletIdParam,
});
export const produkSearch = z.object({
  preset: presetParam(DEFAULT_PRESET.produk),
  start_date: dateParam,
  end_date: dateParam,
  order: z.enum(PRODUCT_ORDERS).default("terlaris").catch("terlaris"),
  outlet_id: outletIdParam,
});
export const stokSearch = z.object({
  search: z.string().default("").catch(""),
  outlet_id: outletIdParam,
});
export const pembelianSearch = z.object({
  status: z.enum(PO_STATUS_FILTERS).default("semua").catch("semua"),
  outlet_id: outletIdParam,
});
export const transaksiSearch = z.object({
  preset: presetParam(DEFAULT_PRESET.transaksi),
  start_date: dateParam,
  end_date: dateParam,
  customer_id: customerIdParam,
  outlet_id: outletIdParam,
});
export const piutangSearch = z.object({
  customer_id: customerIdParam,
  bucket: z.enum(AGING_BUCKET_KEYS).optional().catch(undefined),
  sort: z.enum(DEBT_SORTS).default("overdue").catch("overdue"),
  outlet_id: outletIdParam,
});

export const VIEW_SEARCH = {
  penjualan: penjualanSearch,
  produk: produkSearch,
  stok: stokSearch,
  pembelian: pembelianSearch,
  transaksi: transaksiSearch,
  piutang: piutangSearch,
} as const;

export type PenjualanSearch = z.output<typeof penjualanSearch>;
export type ProdukSearch = z.output<typeof produkSearch>;
export type StokSearch = z.output<typeof stokSearch>;
export type PembelianSearch = z.output<typeof pembelianSearch>;
export type TransaksiSearch = z.output<typeof transaksiSearch>;
export type PiutangSearch = z.output<typeof piutangSearch>;

/** Drops undefined values so argument objects (and query keys) stay minimal. */
function compact(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function rangeSearch(args: Record<string, unknown>, today: string): Record<string, unknown> {
  const { start_date: start, end_date: end } = args;
  if (!isIsoDate(start) || !isIsoDate(end) || start > end) return {};
  const preset = matchPreset(start, end, today);
  return preset ? { preset } : { preset: "custom", start_date: start, end_date: end };
}

function rangeArgs(
  search: { preset: string; start_date?: string | undefined; end_date?: string | undefined },
  fallback: RangePresetKey,
  today: string,
): DateRangeValue {
  if (search.preset !== "custom") return presetRange(search.preset as RangePresetKey, today);
  const { start_date: start, end_date: end } = search;
  if (start && end && start <= end) return { start_date: start, end_date: end };
  return presetRange(fallback, today);
}

/** Search params for a view opened from its view tool's arguments (ontoolinput). */
export function searchFromToolArgs(
  view: ViewName,
  args: Record<string, unknown>,
  today: string = jakartaTodayBrowser(),
): Record<string, unknown> {
  const outlet = { outlet_id: args.outlet_id };
  switch (view) {
    case "penjualan":
      return compact(penjualanSearch.parse({ ...rangeSearch(args, today), ...outlet }));
    case "produk":
      return compact(produkSearch.parse({ ...rangeSearch(args, today), order: args.order, ...outlet }));
    case "stok":
      return compact(stokSearch.parse({ search: typeof args.search === "string" ? args.search.trim() : undefined, ...outlet }));
    case "pembelian":
      return compact(pembelianSearch.parse({ status: args.status, ...outlet }));
    case "transaksi":
      return compact(transaksiSearch.parse({ ...rangeSearch(args, today), customer_id: args.customer_id, ...outlet }));
    case "piutang":
      return compact(piutangSearch.parse({ customer_id: args.customer_id, ...outlet }));
  }
}

/** Tool arguments for a view from its (validated) search params + today (Jakarta). */
export function toolArgsFromSearch(view: ViewName, search: Record<string, unknown>, today: string): Record<string, unknown> {
  switch (view) {
    case "penjualan": {
      const s = penjualanSearch.parse(search);
      return compact({ ...rangeArgs(s, DEFAULT_PRESET.penjualan, today), outlet_id: s.outlet_id });
    }
    case "produk": {
      const s = produkSearch.parse(search);
      return compact({ ...rangeArgs(s, DEFAULT_PRESET.produk, today), order: s.order, outlet_id: s.outlet_id });
    }
    case "stok": {
      const s = stokSearch.parse(search);
      const text = s.search.trim().slice(0, 100);
      return compact({ search: text === "" ? undefined : text, outlet_id: s.outlet_id });
    }
    case "pembelian": {
      const s = pembelianSearch.parse(search);
      return compact({ status: s.status, outlet_id: s.outlet_id });
    }
    case "transaksi": {
      const s = transaksiSearch.parse(search);
      return compact({ ...rangeArgs(s, DEFAULT_PRESET.transaksi, today), customer_id: s.customer_id, outlet_id: s.outlet_id });
    }
    case "piutang": {
      const s = piutangSearch.parse(search);
      return compact({ customer_id: s.customer_id, outlet_id: s.outlet_id });
    }
  }
}

/** Memory-history entry for a view, e.g. "/stok?search=kopi". */
export function viewPathWithSearch(view: ViewName, search: Record<string, unknown>): string {
  return `${VIEW_PATH[view]}${defaultStringifySearch(search)}`;
}
```

- [ ] **Step 24: Implement the router, the empty route registry and the shell**

Route factories receive the root route as a parameter, so `routes/*.tsx` never import `app/router.tsx` at runtime (no import cycle). `AppShell` without a `bridge` prop registers the ext-apps listeners in `onAppCreated` (before `connect()`), renders a status panel until the App is connected and the first `toolinput` has been collected (≤ 1 s), then primes the opening query and mounts the router on `viewPathWithSearch(view, search)`. Without an input by then it mounts the router on the view's defaults and keeps listening (`startInitialView`). A late input replaces the router location (`navigate({ href, replace: true })`) only while `atViewDefaults` holds for the router's memory history. The hosted shell owns its router, so it can navigate it; `WidgetRoot` receives the router as a prop.

`widgets/src/routes/index.ts`:

```ts
import type { AnyRoute } from "@tanstack/react-router";
import type { rootRoute } from "../app/router";

/**
 * Route factories, one per view. Each receives the root route and returns
 * createRoute({ getParentRoute: () => root, path: VIEW_PATH[view], validateSearch, component }).
 * Tasks 12–14 append their factories here.
 */
export const VIEW_ROUTES: Array<(root: typeof rootRoute) => AnyRoute> = [];
```

`widgets/src/app/router.tsx`:

```tsx
import { Outlet, createMemoryHistory, createRootRoute, createRouter } from "@tanstack/react-router";
import { VIEW_ROUTES } from "../routes";

function AppLayout() {
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <Outlet />
    </div>
  );
}

export function NotFoundPanel() {
  return (
    <section role="alert" className="rounded-md border border-line bg-surface-muted p-4">
      <p className="font-semibold text-fg">Tampilan belum tersedia</p>
      <p className="mt-1 text-sm text-fg-muted">Tampilan ini belum ada di versi widget ini. Minta Claude membuka tampilan lain.</p>
    </section>
  );
}

export const rootRoute = createRootRoute({ component: AppLayout, notFoundComponent: NotFoundPanel });

/** Code-based route tree over in-memory history (the sandboxed iframe must not touch window.history). */
export function createWidgetRouter(opts: { initialPath: string }) {
  const routeTree = rootRoute.addChildren(VIEW_ROUTES.map((createViewRoute) => createViewRoute(rootRoute)));
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [opts.initialPath] }),
    defaultPreload: false,
    scrollRestoration: false,
    defaultNotFoundComponent: NotFoundPanel,
  });
}

export type WidgetRouter = ReturnType<typeof createWidgetRouter>;
```

`widgets/src/app/AppShell.tsx`:

```tsx
import type { App, McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { RouterProvider, deepEqual, defaultParseSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from "react";
import { VIEW_TOOL, type ToolInput, type ViewName } from "../../../src/widgets/contract";
import { BridgeContext, type Bridge } from "../bridge/bridge";
import { createExtAppsBridge } from "../bridge/extAppsBridge";
import { INITIAL_RESULT_WAIT_MS, createInitialToolCall, primeInitialQuery, type InitialToolCall } from "../bridge/initialResult";
import { jakartaTodayBrowser } from "../lib/dates";
import { createWidgetQueryClient } from "./queryClient";
import { createWidgetRouter, type WidgetRouter } from "./router";
import { VIEW_SEARCH, searchFromToolArgs, toolArgsFromSearch, viewPathWithSearch } from "./search";
import { VIEW_PATH } from "./viewPaths";

export const APP_INFO = { name: "manujujaya", version: "0.3.0" } as const;
/** How long the shell waits for the host's toolinput before routing with default filters. */
export const TOOL_INPUT_WAIT_MS = 1_000;
/** How long a toolinput that missed TOOL_INPUT_WAIT_MS can still replace the default filters. */
export const LATE_TOOL_INPUT_WAIT_MS = INITIAL_RESULT_WAIT_MS;

export interface InitialViewOptions {
  view: ViewName;
  call: InitialToolCall;
  queryClient: QueryClient;
  /** The current bridge (a host context change replaces it); null while the App is not connected. */
  getBridge: () => Bridge | null;
  /** Mounts the router on its first path: the model's arguments, or the view's defaults. Called at most once. */
  open: (path: string) => void;
  /** Whether a late toolinput may still move the router (false once the viewer changed view or filters). */
  canApplyLate: () => boolean;
  /** Replaces the mounted router's location with the late toolinput's path; its query is already primed. */
  navigate: (path: string) => void;
  today?: () => string;
  inputWaitMs?: number;
  lateInputWaitMs?: number;
}

/**
 * Opening sequence of the hosted shell. Waits `inputWaitMs` for toolinput. When it arrives, the shell primes the
 * opening query and opens on the model's arguments. When it does not, the shell opens on the defaults and keeps
 * listening for `lateInputWaitMs`, applying a late input through `navigate` while `canApplyLate()` holds.
 * Returns a dispose function.
 */
export function startInitialView(opts: InitialViewOptions): () => void {
  let active = true;
  const today = opts.today ?? (() => jakartaTodayBrowser());

  /** Primes the view tool query for the model's arguments; returns the matching router path. */
  const prime = (args: Record<string, unknown>): string | null => {
    const bridge = opts.getBridge();
    if (!bridge) return null;
    const day = today();
    const search = searchFromToolArgs(opts.view, args, day);
    const toolArgs = toolArgsFromSearch(opts.view, search, day);
    primeInitialQuery(opts.queryClient, bridge, VIEW_TOOL[opts.view], toolArgs as ToolInput<(typeof VIEW_TOOL)[ViewName]>, opts.call);
    return viewPathWithSearch(opts.view, search);
  };

  void opts.call.waitForInput(opts.inputWaitMs ?? TOOL_INPUT_WAIT_MS).then((args) => {
    if (!active) return;
    if (args) {
      opts.open(prime(args) ?? VIEW_PATH[opts.view]);
      return;
    }
    opts.open(VIEW_PATH[opts.view]);
    void opts.call.waitForInput(opts.lateInputWaitMs ?? LATE_TOOL_INPUT_WAIT_MS).then((late) => {
      if (!active || !late || !opts.canApplyLate()) return;
      const path = prime(late);
      if (path) opts.navigate(path);
    });
  });

  return () => {
    active = false;
  };
}

/** True while `location` (router memory history) shows `view` with its default search params. */
export function atViewDefaults(view: ViewName, location: { pathname: string; search: string }): boolean {
  if (location.pathname !== VIEW_PATH[view]) return false;
  const schema = VIEW_SEARCH[view];
  return deepEqual(schema.parse(defaultParseSearch(location.search)), schema.parse({}));
}

function insetsStyle(context: McpUiHostContext | undefined): CSSProperties | undefined {
  const insets = context?.safeAreaInsets;
  if (!insets) return undefined;
  return { paddingTop: insets.top, paddingRight: insets.right, paddingBottom: insets.bottom, paddingLeft: insets.left };
}

function WidgetRoot(props: { bridge: Bridge; queryClient: QueryClient; router: WidgetRouter; style?: CSSProperties | undefined }) {
  return (
    <BridgeContext.Provider value={props.bridge}>
      <QueryClientProvider client={props.queryClient}>
        <div className="mx-auto w-full max-w-5xl p-3 text-sm text-fg" style={props.style}>
          <RouterProvider router={props.router} />
        </div>
      </QueryClientProvider>
    </BridgeContext.Provider>
  );
}

function StatusPanel(props: { title: string; body: string; busy?: boolean }) {
  return (
    <div className="p-3 text-sm text-fg" role={props.busy ? "status" : "alert"} aria-busy={props.busy ?? false}>
      <p className="font-semibold">{props.title}</p>
      <p className="text-fg-muted">{props.body}</p>
    </div>
  );
}

function StandaloneShell(props: { view: ViewName; bridge: Bridge }) {
  const [queryClient] = useState(createWidgetQueryClient);
  const [router] = useState(() => createWidgetRouter({ initialPath: VIEW_PATH[props.view] }));
  return <WidgetRoot bridge={props.bridge} queryClient={queryClient} router={router} />;
}

function HostedShell(props: { view: ViewName }) {
  const { view } = props;
  const [queryClient] = useState(createWidgetQueryClient);
  const [initialCall] = useState(createInitialToolCall);
  const [hostVersion, setHostVersion] = useState(0);
  const [router, setRouter] = useState<WidgetRouter | null>(null);
  const routerRef = useRef<WidgetRouter | null>(null);
  const onHostChange = useRef(() => setHostVersion((v) => v + 1));

  const { app, error } = useApp({
    appInfo: APP_INFO,
    capabilities: { availableDisplayModes: ["inline", "fullscreen"] },
    onAppCreated: (created: App) => {
      // Registered before connect(): the host may send these right after the handshake.
      created.addEventListener("toolinput", (params) => initialCall.setInput(params.arguments ?? {}));
      created.addEventListener("toolresult", (result) => initialCall.setResult(result));
      created.addEventListener("toolcancelled", () => initialCall.cancel());
      created.addEventListener("hostcontextchanged", () => onHostChange.current());
    },
  });
  useHostStyles(app, app?.getHostContext());

  // A fresh object per host-context change re-renders consumers that read bridge.host.
  const bridge = useMemo(() => (app ? createExtAppsBridge(app) : null), [app, hostVersion]);
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;

  useEffect(() => {
    if (!app) return;
    return startInitialView({
      view,
      call: initialCall,
      queryClient,
      getBridge: () => bridgeRef.current,
      open: (path) => {
        const created = createWidgetRouter({ initialPath: path });
        routerRef.current = created;
        setRouter(created);
      },
      canApplyLate: () => routerRef.current !== null && atViewDefaults(view, routerRef.current.history.location),
      navigate: (path) => {
        void routerRef.current?.navigate({ href: path, replace: true });
      },
    });
  }, [app, initialCall, queryClient, view]);

  if (error) return <StatusPanel title="Tidak dapat terhubung" body="Widget gagal terhubung ke aplikasi obrolan. Muat ulang percakapan." />;
  if (!bridge || router === null) return <StatusPanel title="Memuat…" body="Menyiapkan tampilan Qasir." busy />;
  return <WidgetRoot bridge={bridge} queryClient={queryClient} router={router} style={insetsStyle(app?.getHostContext())} />;
}

/**
 * Real host: no `bridge` prop (ext-apps App over postMessage, host styles, initial tool call seeding).
 * Tests and widgets:dev: pass a bridge (e.g. createMockBridge()) and the view opens with default filters.
 */
export function AppShell(props: { view: ViewName; bridge?: Bridge }): JSX.Element {
  return props.bridge ? <StandaloneShell view={props.view} bridge={props.bridge} /> : <HostedShell view={props.view} />;
}
```

- [ ] **Step 25: Implement the entry point and the stylesheet**

`widgets/src/main.tsx`:

```tsx
import "./styles.css";
import { createRoot } from "react-dom/client";
import { AppShell } from "./app/AppShell";
import { viewFromMarker } from "./app/viewPaths";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root element");
const root = createRoot(container);

// No StrictMode: its double mount would close and re-create the ext-apps App (a second ui/initialize).
if (import.meta.env.DEV && window.parent === window) {
  // widgets:dev opened directly in a browser tab: fixture data, view from ?view=.
  // The dynamic import sits in a branch that production builds drop, so fixtures never ship.
  void import("./bridge/mockBridge").then(({ createMockBridge }) => {
    const view = viewFromMarker(new URLSearchParams(window.location.search).get("view") ?? undefined);
    root.render(<AppShell view={view} bridge={createMockBridge({ latencyMs: 400 })} />);
  });
} else {
  // Inside a host iframe: ext-apps App; the Worker replaced the data-view marker with the view name.
  root.render(<AppShell view={viewFromMarker(container.dataset.view)} />);
}
```

`widgets/src/styles.css`:

```css
/* Scan only the widget sources (not the whole repo) for class names. */
@import "tailwindcss" source("./");

/* `dark:` follows the host theme (ext-apps sets data-theme on <html>) or a .dark class. */
@custom-variant dark (&:where(.dark, .dark *, [data-theme="dark"], [data-theme="dark"] *));

/*
 * Host style variables (MCP Apps McpUiStyleVariableKey) with fallbacks. useHostStyles writes the host's
 * values as inline styles on <html>, which override these. light-dark() picks the fallback matching the
 * color-scheme the host applied (or the OS preference in widgets:dev).
 */
:root {
  color-scheme: light dark;
  --color-background-primary: light-dark(#ffffff, #1f1f1e);
  --color-background-secondary: light-dark(#f6f6f4, #2a2a28);
  --color-background-tertiary: light-dark(#ececea, #353532);
  --color-background-info: light-dark(#e8f0fe, #1d2b44);
  --color-background-danger: light-dark(#fdecec, #472222);
  --color-background-success: light-dark(#e7f6ec, #1f3a28);
  --color-background-warning: light-dark(#fdf3e1, #45361a);
  --color-text-primary: light-dark(#1a1a19, #f2f2f0);
  --color-text-secondary: light-dark(#5c5c58, #b8b8b3);
  --color-text-tertiary: light-dark(#86867f, #8f8f89);
  --color-text-info: light-dark(#1f5fbf, #8ab4f8);
  --color-text-danger: light-dark(#b42318, #f49b93);
  --color-text-success: light-dark(#1e7a3c, #7fd19b);
  --color-text-warning: light-dark(#9a5b00, #f2c26b);
  --color-border-primary: light-dark(#dcdcd8, #3d3d3a);
  --color-border-secondary: light-dark(#ececea, #333331);
  --color-ring-primary: light-dark(#1f5fbf, #8ab4f8);
  --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  --border-radius-sm: 6px;
  --border-radius-md: 8px;
  --border-radius-lg: 12px;
}

[data-theme="light"] {
  color-scheme: light;
}

[data-theme="dark"],
.dark {
  color-scheme: dark;
}

/*
 * Tailwind tokens mapped onto the host variables:
 * bg-surface / bg-surface-muted / bg-surface-strong, text-fg / text-fg-muted / text-fg-subtle,
 * border-line / border-line-muted, ring-focus, {bg,text}-{info,danger,success,warning}(-soft),
 * font-sans / font-mono, rounded-sm / rounded-md / rounded-lg.
 */
@theme inline {
  --color-surface: var(--color-background-primary);
  --color-surface-muted: var(--color-background-secondary);
  --color-surface-strong: var(--color-background-tertiary);
  --color-fg: var(--color-text-primary);
  --color-fg-muted: var(--color-text-secondary);
  --color-fg-subtle: var(--color-text-tertiary);
  --color-line: var(--color-border-primary);
  --color-line-muted: var(--color-border-secondary);
  --color-focus: var(--color-ring-primary);
  --color-info: var(--color-text-info);
  --color-info-soft: var(--color-background-info);
  --color-danger: var(--color-text-danger);
  --color-danger-soft: var(--color-background-danger);
  --color-success: var(--color-text-success);
  --color-success-soft: var(--color-background-success);
  --color-warning: var(--color-text-warning);
  --color-warning-soft: var(--color-background-warning);
  --radius-sm: var(--border-radius-sm);
  --radius-md: var(--border-radius-md);
  --radius-lg: var(--border-radius-lg);
}

@layer base {
  html,
  body {
    margin: 0;
    background-color: var(--color-background-primary);
    color: var(--color-text-primary);
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
  }

  button,
  input,
  select {
    font: inherit;
  }

  :focus-visible {
    outline: 2px solid var(--color-ring-primary);
    outline-offset: 2px;
  }
}
```

- [ ] **Step 26: Run every widget test, all type checks and the single-file build**

Run: `bun run widgets:test && bun run check-types && bun run widgets:build`
Expected: 8 test files PASS (86 tests); all three `tsc` runs exit 0; Vite prints `[plugin vite:singlefile] Inlining: index-….js` and `Inlining: style-….css`, then `widgets/dist/index.html  ~578 kB │ gzip: ~170 kB`.

Run: `ls widgets/dist && grep -o "__MJ_VIEW__" widgets/dist/index.html | wc -l && grep -c "Pelanggan" widgets/dist/index.html; grep -c "<form" widgets/dist/index.html; grep -o "light-dark(" widgets/dist/index.html | wc -l`
Expected: `index.html` only; marker count `1`; `0` (fixtures not bundled); `0` (no forms); a non-zero `light-dark(` count (not transpiled to `--lightningcss-*` fallbacks).

Run: `bun run test`
Expected: the root suite is unchanged and PASS (widget tests are not part of it).

- [ ] **Step 27: Commit**

```bash
git add widgets/src/app/viewPaths.ts widgets/src/app/search.ts widgets/src/routes/index.ts widgets/src/app/router.tsx widgets/src/app/AppShell.tsx widgets/src/main.tsx widgets/src/styles.css widgets/test/search.test.ts widgets/test/AppShell.test.tsx widgets/test/initialView.test.ts
git commit -m "feat(widgets): memory-history router shell, view search params and host styles

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

---

### Task 9: Shared widget components

**Files:**
- Create: `widgets/src/components/ui.ts`, `StatusBadge.tsx`, `EmptyState.tsx`, `Skeleton.tsx`, `KpiTile.tsx`, `BarList.tsx`, `LoadMoreFooter.tsx`, `ChipGroup.tsx`, `SearchInput.tsx`, `Sheet.tsx`, `ErrorPanel.tsx`, `PresetRangePicker.tsx`, `TrendChart.tsx`, `DataTable.tsx`, `ViewSwitcher.tsx`, `ViewFrame.tsx` (all under `widgets/src/components/`)
- Test: `widgets/test/components/display.test.tsx`, `ChipGroup.test.tsx`, `SearchInput.test.tsx`, `Sheet.test.tsx`, `ErrorPanel.test.tsx`, `PresetRangePicker.test.tsx`, `TrendChart.test.tsx`, `DataTable.test.tsx`, `ViewFrame.test.tsx` (all under `widgets/test/components/`)

**Interfaces:**
- Consumes:
  - T1 (`src/widgets/contract.ts`): `VIEWS`, `ViewName`, `MAX_RANGE_DAYS`.
  - T8: `widgets/src/bridge/bridge.ts` (`Bridge`, `BridgeContext`, `useBridge`, `ToolCallError`), `widgets/src/bridge/mockBridge.ts` (`createMockBridge`, tests only), `widgets/src/lib/errors.ts` (`errorCopy`), `widgets/src/lib/format.ts` (`formatRupiah`, `formatNumber`, `formatDate`, `formatPercent`), `widgets/src/lib/dates.ts` (`PRESET_KEYS`, `PresetKey`, `PRESET_LABEL`, `presetRange`, `isoDaysBetween`, `jakartaTodayBrowser`), `widgets/src/app/viewPaths.ts` (`VIEW_PATH`, `VIEW_LABEL`); the Tailwind tokens from `widgets/src/styles.css` (`bg-surface`, `bg-surface-muted`, `text-fg`, `text-fg-muted`, `text-fg-subtle`, `border-line`, `border-line-muted`, `{text,bg}-{info,danger,success,warning}`, `bg-*-soft`) and its global `:focus-visible` outline; `widgets/vitest.config.ts` (happy-dom, `test/setup.ts` cleanup).
  - Packages (installed by T8): `@tanstack/react-table` 9.2.4 (`useTable`, `tableFeatures`, `rowSortingFeature`, `createSortedRowModel`, `createColumnHelper`, `sortFn_*`, `table.FlexRender`), `@tanstack/react-virtual` (`useVirtualizer`), `@tanstack/react-form` (`useForm`), `@tanstack/react-pacer/debouncer` (`useDebouncedValue`), `@tanstack/react-query` (`useQueryClient`, `useIsFetching`), `@tanstack/react-router` (`Link`, `useLocation`).
- Produces (T12–T14 import these exact names from `widgets/src/components/<File>`):
  - `ui.ts`: `cx(...parts: Array<string | false | null | undefined>): string`; `type Tone = "success" | "warning" | "danger" | "neutral"`; `TONE_TEXT: Record<Tone, string>`; `TONE_BADGE: Record<Tone, string>`; `buttonClass: string`
  - `StatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode })`; `type StatusTone = Tone`
  - `EmptyState({ title, body }: { title: string; body?: string })`
  - `Skeleton({ rows = 5, note }: { rows?: number; note?: string })`
  - `KpiTile({ label, value, change, hint }: { label: string; value: string; change?: KpiChange; hint?: string })`; `interface KpiChange { percent: number | null; direction: "up" | "down" | null }` (same shape as the contract `changeSchema`)
  - `BarList({ items, emptyText }: { items: BarListItem[]; emptyText: string })`; `interface BarListItem { key: string; label: string; value: number; valueLabel: string; onSelect?: () => void }`
  - `LoadMoreFooter(props: LoadMoreFooterProps)`; `interface LoadMoreFooterProps { hasMore: boolean; isFetching: boolean; onLoadMore: () => void; loadedLabel: string }`
  - `ChipGroup<T extends string>(props: ChipGroupProps<T>)`; `interface ChipOption<T extends string> { value: T; label: string; count?: number }`; `type ChipGroupProps<T> = { options: ReadonlyArray<ChipOption<T>>; label?: string } & ({ multiple?: false; value: T; onChange: (value: T) => void } | { multiple: true; value: T[]; onChange: (value: T[]) => void })`
  - `SearchInput(props: SearchInputProps)`; `interface SearchInputProps { value: string; onChange: (value: string) => void; placeholder: string; debounceMs?: number /* 400 */; label?: string }`: emits the trimmed text after the debounce, on Enter, or on clear. It is a plain controlled `<input type="search">` debounced with Pacer `useDebouncedValue`, not a TanStack Form field; TanStack Form is used only for the custom date-range fields in `PresetRangePicker` (the spec §3.3 "TanStack Form for the date-range and search fields" is narrowed to date ranges)
  - `Sheet(props: SheetProps)`; `interface SheetProps { open: boolean; title: string; onClose: () => void; children: ReactNode }`
  - `ErrorPanel({ error, onRetry }: { error: ToolCallError; onRetry?: () => void })` (needs `BridgeContext`)
  - `PresetRangePicker(props: PresetRangePickerProps)`; `interface PresetRangePickerProps { value: PresetRangeValue; onChange: (value: PresetRangeValue) => void; today?: string }`; `interface PresetRangeValue { preset: PresetKey; start_date: string; end_date: string }`; `customRangeSchema` (zod)
  - `TrendChart(props: TrendChartProps)`; `interface TrendChartProps { points: TrendPoint[]; onSelectDate?: (date: string) => void }`; `interface TrendPoint { date: string; amount: number; comparisonAmount: number | null }`
  - `DataTable<Row extends RowData>(props: DataTableProps<Row>)`; `interface DataTableProps<Row> { rows: Row[]; columns: ColumnDef<Row>[]; getRowId: (row: Row) => string; onRowClick?: (row: Row) => void; renderExpanded?: (row: Row) => ReactNode; expandedRowId?: string | null; estimateRowHeight?: number /* 44 */; maxHeight?: number /* 560 */; emptyText: string; footer?: ReactNode; label?: string }`; `type ColumnDef<Row extends RowData> = TableColumnDef<DataTableFeatures, Row, any>`; `function dataColumnHelper<Row extends RowData>(): ColumnHelper<DataTableFeatures, Row>`; `const dataTableFeatures`; `type DataTableFeatures`; `interface DataColumnMeta { align?: "left" | "right"; minWidth?: number; grow?: number }`. Expansion is uncontrolled by default (a click toggles `renderExpanded` for that row, several rows can be open). Passing `expandedRowId` (a `getRowId` value, or `null` for none) makes it controlled: exactly the row with that id shows `renderExpanded`, and a click only calls `onRowClick`, so the parent sets the id there
  - `ViewSwitcher({ current }: { current: ViewName })`
  - `ViewFrame(props: ViewFrameProps)`; `interface ViewFrameProps { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }`: renders `<header>` (h1, subtitle, actions, "Muat ulang", "Layar penuh" when `bridge.host.canFullscreen`), `ViewSwitcher` for the current path, then `<main>`; must sit inside `RouterProvider`, `QueryClientProvider` and `BridgeContext` (AppShell provides all three)

Usage rules for T12–T14 (fixed here):
- Build DataTable columns once at module scope: `const col = dataColumnHelper<StockRow>(); const columns = col.columns([col.accessor("name", { header: "Produk", meta: { minWidth: 200, grow: 2 } }), ...])`. Accessor columns sort (numbers start descending, text ascending); `col.display({ id, header, cell })` columns do not. Plain `ColumnDef<Row>` objects with `id` + `accessorFn` + `cell` (for example `const COLUMNS: ColumnDef<StockRow>[] = [{ id: "name", header: "Produk", accessorFn: (r) => r.name, cell: (c) => c.getValue() }]`) are equivalent and sort the same way (T12–T13 use them); objects without `accessorFn` behave like display columns.
- Type chip option arrays as `ChipOption<T>[]`, otherwise TypeScript infers `T` from the first literal only.
- In happy-dom (no layout) DataTable renders the first `ceil(maxHeight / estimateRowHeight)` rows (13 by default) before the scroll box is measured, so route tests can assert on the first rows without stubbing sizes. Stubbing `offsetHeight`/`offsetWidth` is optional; it only makes the virtualizer measure (as the "virtualizes rows" test below does), which is needed only to test scrolling.
- A view that opens one detail at a time (for example a customer's debt detail) can pass `expandedRowId` and set it from `onRowClick`; the detail then renders directly under the clicked row inside the scroll box instead of below the table.
- No component renders `<form>`, `<a target>` or `dangerouslySetInnerHTML`; every button is `type="button"`.

- [ ] **Step 1: Write the failing display-component test**

`widgets/test/components/display.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BarList } from "../../src/components/BarList";
import { EmptyState } from "../../src/components/EmptyState";
import { KpiTile } from "../../src/components/KpiTile";
import { LoadMoreFooter } from "../../src/components/LoadMoreFooter";
import { Skeleton } from "../../src/components/Skeleton";
import { StatusBadge } from "../../src/components/StatusBadge";

describe("display components", () => {
  it("KpiTile shows value and change direction", () => {
    const { rerender } = render(
      <KpiTile label="Penjualan kotor" value="Rp 1.250.000" change={{ percent: 12.5, direction: "up" }} />,
    );
    expect(screen.getByText("Rp 1.250.000")).toBeTruthy();
    expect(screen.getByText(/▲/).parentElement?.textContent).toContain("Naik 12,5%");

    rerender(<KpiTile label="Laba kotor" value="Rp 0" change={{ percent: null, direction: null }} hint="Periode kosong" />);
    expect(screen.getByText("Belum ada pembanding")).toBeTruthy();
    expect(screen.getByText("Periode kosong")).toBeTruthy();
  });

  it("BarList renders selectable rows and the empty text", () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <BarList
        emptyText="Belum ada kategori"
        items={[
          { key: "1", label: "Oli", value: 300, valueLabel: "Rp 300", onSelect },
          { key: "2", label: "Busi", value: 100, valueLabel: "Rp 100" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Oli/ }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: /Busi/ })).toBeNull();

    rerender(<BarList emptyText="Belum ada kategori" items={[]} />);
    expect(screen.getByText("Belum ada kategori")).toBeTruthy();
  });

  it("StatusBadge, EmptyState and Skeleton render their copy", () => {
    render(
      <>
        <StatusBadge tone="danger">Refund</StatusBadge>
        <EmptyState title="Tidak ada transaksi" body="Coba periode lain." />
        <Skeleton rows={3} note="Memuat stok, bisa sampai 15 detik" />
      </>,
    );
    expect(screen.getByText("Refund")).toBeTruthy();
    expect(screen.getByText("Coba periode lain.")).toBeTruthy();
    expect(screen.getByText("Memuat stok, bisa sampai 15 detik")).toBeTruthy();
    expect(document.querySelectorAll('[aria-busy="true"] [aria-hidden="true"]')).toHaveLength(3);
  });

  it("LoadMoreFooter loads on click, disables while fetching and hides when done", () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(
      <LoadMoreFooter hasMore isFetching={false} onLoadMore={onLoadMore} loadedLabel="50 baris dimuat" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Muat lebih banyak" }));
    expect(onLoadMore).toHaveBeenCalledOnce();

    rerender(<LoadMoreFooter hasMore isFetching onLoadMore={onLoadMore} loadedLabel="50 baris dimuat" />);
    expect(screen.getByRole("button", { name: "Memuat…" })).toHaveProperty("disabled", true);

    rerender(<LoadMoreFooter hasMore={false} isFetching={false} onLoadMore={onLoadMore} loadedLabel="100 baris dimuat" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("100 baris dimuat")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run widgets:test test/components/display.test.tsx`
Expected: FAIL with `Failed to resolve import "../../src/components/<Name>" from "widgets/test/components/display.test.tsx". Does the file exist?`, where `<Name>` is one of the six components the test imports (Vite reports whichever it resolves first).

- [ ] **Step 3: Implement the class helpers and the display components**

Colors come only from the T8 tokens, so the host theme and host variables apply unchanged. Focus rings come from the global `:focus-visible` rule in `styles.css`.

`widgets/src/components/ui.ts`:

```ts
/** Class-name helpers shared by the widget components. Colors use the Tailwind tokens from styles.css. */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export type Tone = "success" | "warning" | "danger" | "neutral";

export const TONE_TEXT: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  neutral: "text-fg-muted",
};

export const TONE_BADGE: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-surface-muted text-fg-muted",
};

/** Secondary button on the host surface. */
export const buttonClass =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-line bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60";
```

`widgets/src/components/StatusBadge.tsx`:

```tsx
import type { ReactNode } from "react";
import { TONE_BADGE, cx, type Tone } from "./ui";

export type StatusTone = Tone;

export function StatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", TONE_BADGE[tone])}>
      {children}
    </span>
  );
}
```

`widgets/src/components/EmptyState.tsx`:

```tsx
export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div role="status" className="rounded-lg border border-dashed border-line px-4 py-8 text-center">
      <p className="text-sm font-medium text-fg">{title}</p>
      {body ? <p className="mt-1 text-sm text-fg-muted">{body}</p> : null}
    </div>
  );
}
```

`widgets/src/components/Skeleton.tsx`:

```tsx
export function Skeleton({ rows = 5, note }: { rows?: number; note?: string }) {
  return (
    <div role="status" aria-busy="true" className="space-y-2">
      <span className="sr-only">Memuat data…</span>
      {note ? <p className="text-sm text-fg-muted">{note}</p> : null}
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} aria-hidden="true" className="h-9 animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none" />
      ))}
    </div>
  );
}
```

`widgets/src/components/KpiTile.tsx`:

```tsx
import { formatPercent } from "../lib/format";
import { cx } from "./ui";

export interface KpiChange {
  percent: number | null;
  direction: "up" | "down" | null;
}

export function KpiTile({ label, value, change, hint }: { label: string; value: string; change?: KpiChange; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-fg">{value}</p>
      {change ? <ChangeLine change={change} /> : null}
      {hint ? <p className="mt-1 text-xs text-fg-muted">{hint}</p> : null}
    </div>
  );
}

function ChangeLine({ change }: { change: KpiChange }) {
  if (change.percent === null || change.direction === null) {
    return <p className="mt-1 text-xs text-fg-muted">Belum ada pembanding</p>;
  }
  const up = change.direction === "up";
  return (
    <p className={cx("mt-1 text-xs font-medium tabular-nums", up ? "text-success" : "text-danger")}>
      <span aria-hidden="true">{up ? "▲" : "▼"} </span>
      <span className="sr-only">{up ? "Naik " : "Turun "}</span>
      {formatPercent(change.percent)}
      <span className="font-normal text-fg-muted"> dari periode sebelumnya</span>
    </p>
  );
}
```

`widgets/src/components/BarList.tsx`:

```tsx
export interface BarListItem {
  key: string;
  label: string;
  value: number;
  valueLabel: string;
  onSelect?: () => void;
}

export function BarList({ items, emptyText }: { items: BarListItem[]; emptyText: string }) {
  if (items.length === 0) return <p className="py-4 text-sm text-fg-muted">{emptyText}</p>;
  const max = Math.max(0, ...items.map((item) => item.value));
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const width = max > 0 ? Math.max(2, (Math.max(0, item.value) / max) * 100) : 0;
        const body = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-fg" title={item.label}>
                {item.label}
              </span>
              <span className="shrink-0 tabular-nums text-fg-muted">{item.valueLabel}</span>
            </span>
            <span aria-hidden="true" className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-muted">
              <span className="block h-full rounded-full bg-info" style={{ width: `${width}%` }} />
            </span>
          </>
        );
        return (
          <li key={item.key}>
            {item.onSelect ? (
              <button type="button" onClick={item.onSelect} className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-surface-muted">
                {body}
              </button>
            ) : (
              <div className="px-2 py-1.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
```

`LoadMoreFooter` skips the observer's first notification (the initial state): an auto-resized inline iframe is always "visible", so auto-loading only happens when the footer scrolls into view (fullscreen), never in a loop.

`widgets/src/components/LoadMoreFooter.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { buttonClass } from "./ui";

export interface LoadMoreFooterProps {
  hasMore: boolean;
  isFetching: boolean;
  onLoadMore: () => void;
  /** e.g. "150 baris dimuat" */
  loadedLabel: string;
}

export function LoadMoreFooter({ hasMore, isFetching, onLoadMore, loadedLabel }: LoadMoreFooterProps) {
  const sentinel = useRef<HTMLDivElement>(null);
  const latest = useRef({ hasMore, isFetching, onLoadMore });

  useEffect(() => {
    latest.current = { hasMore, isFetching, onLoadMore };
  });

  useEffect(() => {
    const element = sentinel.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    // The first notification only reports the initial state. Auto-loading waits for the footer to
    // scroll into view, so an auto-resized inline frame (always "visible") never pages by itself.
    let initial = true;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      if (initial) {
        initial = false;
        return;
      }
      const current = latest.current;
      if (visible && current.hasMore && !current.isFetching) current.onLoadMore();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={sentinel} className="flex flex-wrap items-center justify-between gap-2 pt-2">
      <span className="text-xs text-fg-muted" aria-live="polite">
        {loadedLabel}
      </span>
      {hasMore ? (
        <button type="button" className={buttonClass} disabled={isFetching} onClick={onLoadMore}>
          {isFetching ? "Memuat…" : "Muat lebih banyak"}
        </button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run widgets:test test/components/display.test.tsx && bun run widgets:check-types`
Expected: 1 test file PASS (4 tests); `tsc` exits 0.

- [ ] **Step 5: Commit**

```bash
git add widgets/src/components/ui.ts widgets/src/components/StatusBadge.tsx widgets/src/components/EmptyState.tsx widgets/src/components/Skeleton.tsx widgets/src/components/KpiTile.tsx widgets/src/components/BarList.tsx widgets/src/components/LoadMoreFooter.tsx widgets/test/components/display.test.tsx
git commit -m "feat(widgets): KPI tile, bar list, badge, empty/skeleton states and load-more footer

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Write the failing ChipGroup and SearchInput tests**

`widgets/test/components/ChipGroup.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChipGroup, type ChipOption } from "../../src/components/ChipGroup";

type Status = "semua" | "order_processed" | "completed";
const options: ChipOption<Status>[] = [
  { value: "semua", label: "Semua" },
  { value: "order_processed", label: "Diproses", count: 3 },
  { value: "completed", label: "Selesai", count: 12 },
];

describe("ChipGroup", () => {
  it("single: marks the value pressed and emits only a different choice", () => {
    const onChange = vi.fn<(value: Status) => void>();
    render(<ChipGroup label="Status" options={options} value="semua" onChange={onChange} />);
    expect(screen.getByRole("group", { name: "Status" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Semua" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Selesai/ }).textContent).toContain("12");

    fireEvent.click(screen.getByRole("button", { name: "Semua" }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Diproses/ }));
    expect(onChange).toHaveBeenCalledWith("order_processed");
  });

  it("multiple: toggles values and keeps option order", () => {
    const onChange = vi.fn<(value: Status[]) => void>();
    const { rerender } = render(<ChipGroup multiple options={options} value={["completed"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Diproses/ }));
    expect(onChange).toHaveBeenLastCalledWith(["order_processed", "completed"]);

    rerender(<ChipGroup multiple options={options} value={["order_processed", "completed"]} onChange={onChange} />);
    expect(screen.getByRole("button", { name: /Diproses/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /Selesai/ }));
    expect(onChange).toHaveBeenLastCalledWith(["order_processed"]);
  });
});
```

`widgets/test/components/SearchInput.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchInput } from "../../src/components/SearchInput";

describe("SearchInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits one trimmed value after typing pauses", () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} placeholder="Cari produk" debounceMs={400} />);
    const input = screen.getByRole("searchbox", { name: "Cari produk" });

    for (const text of ["k", "ka", "kam", "kampas "]) {
      fireEvent.change(input, { target: { value: text } });
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("kampas");
  });

  it("emits immediately on Enter and on clear", () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} placeholder="Cari produk" />);
    const input = screen.getByRole("searchbox");

    fireEvent.change(input, { target: { value: "oli" } });
    act(() => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(onChange).toHaveBeenLastCalledWith("oli");

    fireEvent.click(screen.getByRole("button", { name: "Hapus pencarian" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("follows an outside value change without echoing it", () => {
    const onChange = vi.fn();
    const { rerender } = render(<SearchInput value="" onChange={onChange} placeholder="Cari" />);
    rerender(<SearchInput value="busi" onChange={onChange} placeholder="Cari" />);
    expect(screen.getByRole("searchbox")).toHaveProperty("value", "busi");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `bun run widgets:test test/components/ChipGroup.test.tsx test/components/SearchInput.test.tsx`
Expected: FAIL with `Failed to resolve import "../../src/components/ChipGroup" from "widgets/test/components/ChipGroup.test.tsx"` and `Failed to resolve import "../../src/components/SearchInput" from "widgets/test/components/SearchInput.test.tsx"`.

- [ ] **Step 8: Implement ChipGroup and SearchInput**

`SearchInput` keeps the raw text locally and emits through Pacer's `useDebouncedValue`. The `emitted` ref stops echoes: an outside `value` change replaces the text without calling `onChange`, and the same trimmed value is never emitted twice.

`widgets/src/components/ChipGroup.tsx`:

```tsx
import { formatNumber } from "../lib/format";
import { cx } from "./ui";

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface ChipGroupBase<T extends string> {
  /** Type the array as ChipOption<T>[] so T is the full union, not the first literal. */
  options: ReadonlyArray<ChipOption<T>>;
  /** Accessible name of the group, e.g. "Status". */
  label?: string;
}

export type ChipGroupProps<T extends string> = ChipGroupBase<T> &
  (
    | { multiple?: false; value: T; onChange: (value: T) => void }
    | { multiple: true; value: T[]; onChange: (value: T[]) => void }
  );

export function ChipGroup<T extends string>(props: ChipGroupProps<T>) {
  const selected = new Set<T>(props.multiple ? props.value : [props.value]);

  function choose(value: T) {
    if (props.multiple) {
      const next = new Set(selected);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      props.onChange(props.options.map((option) => option.value).filter((v) => next.has(v)));
    } else if (value !== props.value) {
      props.onChange(value);
    }
  }

  return (
    <div role="group" aria-label={props.label} className="flex flex-wrap gap-1.5">
      {props.options.map((option) => {
        const active = selected.has(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => choose(option.value)}
            className={cx(
              "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-sm",
              active ? "border-transparent bg-info-soft font-medium text-info" : "border-line text-fg hover:bg-surface-muted",
            )}
          >
            {option.label}
            {option.count !== undefined ? <span className="tabular-nums opacity-75">{formatNumber(option.count, 0)}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
```

`widgets/src/components/SearchInput.tsx`:

```tsx
import { useDebouncedValue } from "@tanstack/react-pacer/debouncer";
import { useEffect, useRef, useState } from "react";

export interface SearchInputProps {
  value: string;
  /** Called with the trimmed text once typing pauses for `debounceMs`, on Enter, or on clear. */
  onChange: (value: string) => void;
  placeholder: string;
  debounceMs?: number;
  /** Accessible name; defaults to the placeholder. */
  label?: string;
}

export function SearchInput({ value, onChange, placeholder, debounceMs = 400, label }: SearchInputProps) {
  const [text, setText] = useState(value);
  const [debounced, debouncer] = useDebouncedValue(text, { wait: debounceMs });
  const emitted = useRef(value.trim());
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // An outside change (navigation, reset) replaces the text without echoing it back.
  useEffect(() => {
    if (value.trim() !== emitted.current) {
      emitted.current = value.trim();
      setText(value);
    }
  }, [value]);

  useEffect(() => {
    const next = debounced.trim();
    if (next !== emitted.current) {
      emitted.current = next;
      onChangeRef.current(next);
    }
  }, [debounced]);

  function clear() {
    debouncer.cancel();
    setText("");
    if (emitted.current !== "") {
      emitted.current = "";
      onChangeRef.current("");
    }
  }

  return (
    <div className="relative">
      <input
        type="search"
        enterKeyHint="search"
        maxLength={100}
        value={text}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            debouncer.flush();
          } else if (event.key === "Escape" && text !== "") {
            event.preventDefault();
            clear();
          }
        }}
        className="h-9 w-full rounded-md border border-line bg-surface pl-3 pr-16 text-sm text-fg placeholder:text-fg-subtle"
      />
      {text !== "" ? (
        <button
          type="button"
          onClick={clear}
          aria-label="Hapus pencarian"
          className="absolute inset-y-1 right-1 rounded px-2 text-xs text-fg-muted hover:bg-surface-muted"
        >
          Hapus
        </button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `bun run widgets:test test/components/ChipGroup.test.tsx test/components/SearchInput.test.tsx && bun run widgets:check-types`
Expected: 2 test files PASS (5 tests); `tsc` exits 0.

- [ ] **Step 10: Commit**

```bash
git add widgets/src/components/ChipGroup.tsx widgets/src/components/SearchInput.tsx widgets/test/components/ChipGroup.test.tsx widgets/test/components/SearchInput.test.tsx
git commit -m "feat(widgets): chip group and debounced search input

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 11: Write the failing Sheet and ErrorPanel tests**

`widgets/test/components/Sheet.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sheet } from "../../src/components/Sheet";

describe("Sheet", () => {
  it("renders nothing while closed", () => {
    render(
      <Sheet open={false} title="Riwayat stok" onClose={vi.fn()}>
        isi
      </Sheet>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is a labelled modal dialog that takes focus and closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="Riwayat stok" onClose={onClose}>
        <button type="button">Muat lebih banyak</button>
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "Riwayat stok" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(dialog);

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the Tutup button and keeps Tab inside the panel", () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="Detail nota" onClose={onClose}>
        <button type="button">Lihat transaksi pelanggan ini</button>
      </Sheet>,
    );
    const close = screen.getByRole("button", { name: "Tutup" });
    const last = screen.getByRole("button", { name: "Lihat transaksi pelanggan ini" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(close);

    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

`widgets/test/components/ErrorPanel.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { BridgeContext, ToolCallError, type Bridge } from "../../src/bridge/bridge";
import { createMockBridge } from "../../src/bridge/mockBridge";
import { ErrorPanel } from "../../src/components/ErrorPanel";

const CONNECT_URL = "https://mcp.example.test/connect";

function renderWithBridge(bridge: Bridge, ui: ReactNode) {
  return render(<BridgeContext.Provider value={bridge}>{ui}</BridgeContext.Provider>);
}

describe("ErrorPanel", () => {
  it("offers the Connect page when the error carries connect_url, without a retry", () => {
    const bridge = createMockBridge();
    const error = new ToolCallError({ code: "QASIR_AUTH_EXPIRED", message: "expired", connect_url: CONNECT_URL });
    renderWithBridge(bridge, <ErrorPanel error={error} onRetry={vi.fn()} />);

    expect(screen.getByRole("alert").textContent).toContain("Sesi Qasir sudah berakhir. Pemilik perlu menghubungkan ulang.");
    fireEvent.click(screen.getByRole("button", { name: "Buka halaman Connect" }));
    expect(bridge.openedLinks).toEqual([CONNECT_URL]);
    expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
  });

  it("hides the Connect button when connect_url is absent", () => {
    renderWithBridge(createMockBridge(), <ErrorPanel error={new ToolCallError({ code: "QASIR_AUTH_EXPIRED", message: "expired" })} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Buka halaman Connect" })).toBeNull();
  });

  it("shows the URL as text when the host refuses to open it", async () => {
    const bridge: Bridge = { ...createMockBridge(), openLink: () => Promise.reject(new Error("Host menolak membuka tautan")) };
    const error = new ToolCallError({ code: "QASIR_AUTH_EXPIRED", message: "expired", connect_url: CONNECT_URL });
    renderWithBridge(bridge, <ErrorPanel error={error} />);
    fireEvent.click(screen.getByRole("button", { name: "Buka halaman Connect" }));
    await waitFor(() => expect(screen.getByText(`Buka alamat ini di browser: ${CONNECT_URL}`)).toBeTruthy());
  });

  it("offers a retry for retryable errors", () => {
    const onRetry = vi.fn();
    renderWithBridge(createMockBridge(), <ErrorPanel error={new ToolCallError({ code: "UPSTREAM_TIMEOUT", message: "slow" })} onRetry={onRetry} />);
    expect(screen.getByRole("alert").textContent).toContain("Persempit rentang tanggal");
    expect(screen.queryByRole("button", { name: "Buka halaman Connect" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 12: Run the tests to verify they fail**

Run: `bun run widgets:test test/components/Sheet.test.tsx test/components/ErrorPanel.test.tsx`
Expected: FAIL with `Failed to resolve import "../../src/components/Sheet" from "widgets/test/components/Sheet.test.tsx"` and `Failed to resolve import "../../src/components/ErrorPanel" from "widgets/test/components/ErrorPanel.test.tsx"`.

- [ ] **Step 13: Implement Sheet and ErrorPanel**

`Sheet` renders in place (a portal would escape nothing inside the iframe). It focuses the panel on open, restores focus on close, closes on Escape through a document listener (so Escape works wherever focus is), and wraps Tab between the first and last focusable elements.

`widgets/src/components/Sheet.tsx`:

```tsx
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { buttonClass } from "./ui";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Side panel rendered in place (no portal). Escape and the backdrop close it; Tab stays inside. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    function onDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
    }
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("keydown", onDocumentKeyDown);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  if (!open) return null;

  function trapTab(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !panel.current) return;
    const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (element) => !element.hasAttribute("disabled"),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panel.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div aria-hidden="true" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={trapTab}
        className="relative flex h-full w-full max-w-lg flex-col bg-surface text-fg shadow-xl focus:outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 id={titleId} className="min-w-0 truncate text-base font-semibold">
            {title}
          </h2>
          <button type="button" className={buttonClass} onClick={onClose}>
            Tutup
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
```

`ErrorPanel` shows the Connect button only when `errorCopy` returns a `connectUrl` (auth expiry with an http(s) `connect_url`). If the host refuses `openLink`, it prints the address instead of failing silently.

`widgets/src/components/ErrorPanel.tsx`:

```tsx
import { useState } from "react";
import { useBridge, type ToolCallError } from "../bridge/bridge";
import { errorCopy } from "../lib/errors";
import { buttonClass } from "./ui";

export function ErrorPanel({ error, onRetry }: { error: ToolCallError; onRetry?: () => void }) {
  const bridge = useBridge();
  const copy = errorCopy(error);
  const [linkFailed, setLinkFailed] = useState(false);
  const connectUrl = copy.connectUrl;

  return (
    <div role="alert" className="rounded-lg border border-line bg-danger-soft p-4">
      <p className="font-medium text-danger">{copy.title}</p>
      <p className="mt-1 text-sm text-fg">{copy.body}</p>
      {connectUrl && linkFailed ? (
        <p className="mt-2 break-all text-sm text-fg-muted">Buka alamat ini di browser: {connectUrl}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {connectUrl ? (
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              bridge.openLink(connectUrl).catch(() => setLinkFailed(true));
            }}
          >
            Buka halaman Connect
          </button>
        ) : null}
        {copy.retryable && onRetry ? (
          <button type="button" className={buttonClass} onClick={onRetry}>
            Coba lagi
          </button>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 14: Run the tests to verify they pass**

Run: `bun run widgets:test test/components/Sheet.test.tsx test/components/ErrorPanel.test.tsx && bun run widgets:check-types`
Expected: 2 test files PASS (7 tests); `tsc` exits 0.

- [ ] **Step 15: Commit**

```bash
git add widgets/src/components/Sheet.tsx widgets/src/components/ErrorPanel.tsx widgets/test/components/Sheet.test.tsx widgets/test/components/ErrorPanel.test.tsx
git commit -m "feat(widgets): in-frame sheet and error panel with reconnect link

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 16: Write the failing PresetRangePicker test**

`widgets/test/components/PresetRangePicker.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PresetRangePicker, type PresetRangeValue } from "../../src/components/PresetRangePicker";

const TODAY = "2026-09-15";
const week: PresetRangeValue = { preset: "7_hari", start_date: "2026-09-09", end_date: "2026-09-15" };

function openCustom() {
  fireEvent.click(screen.getByRole("button", { name: "Pilih tanggal" }));
  return { start: screen.getByLabelText("Dari"), end: screen.getByLabelText("Sampai") };
}

describe("PresetRangePicker", () => {
  it("emits the preset range for a preset chip", () => {
    const onChange = vi.fn();
    render(<PresetRangePicker value={week} onChange={onChange} today={TODAY} />);
    expect(screen.getByRole("button", { name: "7 hari terakhir" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Kemarin" }));
    expect(onChange).toHaveBeenCalledWith({ preset: "kemarin", start_date: "2026-09-14", end_date: "2026-09-14" });
  });

  it("applies a custom range with the Terapkan button without rendering a <form>", async () => {
    const onChange = vi.fn();
    const { container } = render(<PresetRangePicker value={week} onChange={onChange} today={TODAY} />);
    const { start, end } = openCustom();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(start, { target: { value: "2026-08-01" } });
    fireEvent.change(end, { target: { value: "2026-08-31" } });
    const apply = screen.getByRole("button", { name: "Terapkan" });
    expect(apply.getAttribute("type")).toBe("button");
    fireEvent.click(apply);

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ preset: "custom", start_date: "2026-08-01", end_date: "2026-08-31" }),
    );
    expect(container.querySelector("form")).toBeNull();
  });

  it("applies a custom range when Enter is pressed in a date input", async () => {
    const onChange = vi.fn();
    render(<PresetRangePicker value={week} onChange={onChange} today={TODAY} />);
    const { start } = openCustom();
    fireEvent.change(start, { target: { value: "2026-09-01" } });
    fireEvent.keyDown(start, { key: "Enter" });
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ preset: "custom", start_date: "2026-09-01", end_date: "2026-09-15" }),
    );
  });

  it("shows an Indonesian error and does not apply a reversed range", async () => {
    const onChange = vi.fn();
    render(<PresetRangePicker value={week} onChange={onChange} today={TODAY} />);
    const { start, end } = openCustom();
    fireEvent.change(start, { target: { value: "2026-09-20" } });
    fireEvent.change(end, { target: { value: "2026-09-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Terapkan" }));
    expect(await screen.findByText("Tanggal akhir harus sama dengan atau setelah tanggal awal")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("rejects ranges longer than 366 days", async () => {
    const onChange = vi.fn();
    render(<PresetRangePicker value={week} onChange={onChange} today={TODAY} />);
    const { start } = openCustom();
    fireEvent.change(start, { target: { value: "2025-09-14" } });
    fireEvent.click(screen.getByRole("button", { name: "Terapkan" }));
    expect(await screen.findByText("Rentang tanggal paling panjang 366 hari")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 17: Run the test to verify it fails**

Run: `bun run widgets:test test/components/PresetRangePicker.test.tsx`
Expected: FAIL with `Failed to resolve import "../../src/components/PresetRangePicker" from "widgets/test/components/PresetRangePicker.test.tsx"`.

- [ ] **Step 18: Implement PresetRangePicker**

Preset chips emit immediately. "Pilih tanggal" only opens the custom fields; TanStack Form validates them with a zod 4 schema (same bounds as the server: real dates, start ≤ end, ≤ 366 inclusive days) and submits from the "Terapkan" button or Enter, without a `<form>` element (the sandbox blocks form submission). The fields remount with the applied range, so reopening shows the current dates.

`widgets/src/components/PresetRangePicker.tsx`:

```tsx
import { useForm } from "@tanstack/react-form";
import { useState, type KeyboardEvent } from "react";
import { z } from "zod";
import { MAX_RANGE_DAYS } from "../../../src/widgets/contract";
import { PRESET_KEYS, PRESET_LABEL, isoDaysBetween, jakartaTodayBrowser, presetRange, type PresetKey } from "../lib/dates";
import { ChipGroup, type ChipOption } from "./ChipGroup";
import { buttonClass } from "./ui";

export interface PresetRangeValue {
  preset: PresetKey;
  start_date: string;
  end_date: string;
}

const PRESET_OPTIONS: ReadonlyArray<ChipOption<PresetKey>> = PRESET_KEYS.map((key) => ({ value: key, label: PRESET_LABEL[key] }));

/** Custom range rules: real dates, start ≤ end, at most MAX_RANGE_DAYS inclusive days (same bounds as the server). */
export const customRangeSchema = z
  .object({
    start_date: z.iso.date("Tanggal awal tidak valid"),
    end_date: z.iso.date("Tanggal akhir tidak valid"),
  })
  .refine((range) => range.start_date <= range.end_date, {
    message: "Tanggal akhir harus sama dengan atau setelah tanggal awal",
    path: ["end_date"],
  })
  .refine((range) => isoDaysBetween(range.start_date, range.end_date) + 1 <= MAX_RANGE_DAYS, {
    message: `Rentang tanggal paling panjang ${MAX_RANGE_DAYS} hari`,
    path: ["end_date"],
  });

export interface PresetRangePickerProps {
  value: PresetRangeValue;
  onChange: (value: PresetRangeValue) => void;
  /** Jakarta calendar date for the presets; defaults to jakartaTodayBrowser(). */
  today?: string;
}

export function PresetRangePicker({ value, onChange, today }: PresetRangePickerProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const showCustom = customOpen || value.preset === "custom";

  return (
    <div className="space-y-2">
      <ChipGroup
        label="Periode"
        options={PRESET_OPTIONS}
        value={showCustom ? "custom" : value.preset}
        onChange={(key) => {
          if (key === "custom") {
            setCustomOpen(true);
            return;
          }
          setCustomOpen(false);
          onChange({ preset: key, ...presetRange(key, today ?? jakartaTodayBrowser()) });
        }}
      />
      {showCustom ? (
        <CustomRangeFields
          key={`${value.start_date}_${value.end_date}`}
          start={value.start_date}
          end={value.end_date}
          onApply={(range) => onChange({ preset: "custom", ...range })}
        />
      ) : null}
    </div>
  );
}

function CustomRangeFields(props: { start: string; end: string; onApply: (range: { start_date: string; end_date: string }) => void }) {
  const form = useForm({
    defaultValues: { start_date: props.start, end_date: props.end },
    validators: { onChange: customRangeSchema },
    onSubmit: ({ value }) => props.onApply(value),
  });

  // No <form>: the sandbox blocks submission, so the button and Enter submit explicitly.
  function submitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void form.handleSubmit();
    }
  }

  const inputClass = "h-9 rounded-md border border-line bg-surface px-2 text-sm text-fg";

  return (
    <div role="group" aria-label="Pilih rentang tanggal" className="flex flex-wrap items-end gap-2">
      <form.Field name="start_date">
        {(field) => (
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-fg-muted">Dari</span>
            <input
              type="date"
              className={inputClass}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              onKeyDown={submitOnEnter}
            />
            <FieldError errors={field.state.meta.errors} />
          </label>
        )}
      </form.Field>
      <form.Field name="end_date">
        {(field) => (
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-fg-muted">Sampai</span>
            <input
              type="date"
              className={inputClass}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              onKeyDown={submitOnEnter}
            />
            <FieldError errors={field.state.meta.errors} />
          </label>
        )}
      </form.Field>
      <button
        type="button"
        className={buttonClass}
        onClick={() => {
          void form.handleSubmit();
        }}
      >
        Terapkan
      </button>
    </div>
  );
}

function FieldError({ errors }: { errors: ReadonlyArray<unknown> }) {
  const message = errors
    .map((error) =>
      typeof error === "string" ? error : error && typeof error === "object" && "message" in error ? String(error.message) : "",
    )
    .find((text) => text !== "");
  if (!message) return null;
  return (
    <span role="alert" className="max-w-56 text-danger">
      {message}
    </span>
  );
}
```

- [ ] **Step 19: Run the test to verify it passes**

Run: `bun run widgets:test test/components/PresetRangePicker.test.tsx && bun run widgets:check-types`
Expected: 1 test file PASS (5 tests); `tsc` exits 0.

- [ ] **Step 20: Commit**

```bash
git add widgets/src/components/PresetRangePicker.tsx widgets/test/components/PresetRangePicker.test.tsx
git commit -m "feat(widgets): period presets with a form-less custom date range

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 21: Write the failing TrendChart test**

`widgets/test/components/TrendChart.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrendChart, type TrendPoint } from "../../src/components/TrendChart";

const points: TrendPoint[] = [
  { date: "2026-09-13", amount: 1_250_000, comparisonAmount: 900_000 },
  { date: "2026-09-14", amount: 0, comparisonAmount: null },
  { date: "2026-09-15", amount: 2_000_000, comparisonAmount: 1_500_000 },
];

describe("TrendChart", () => {
  it("renders one focusable point per item with a roving tab stop", () => {
    const { container } = render(<TrendChart points={points} />);
    const rendered = container.querySelectorAll("[data-point-index]");
    expect(rendered).toHaveLength(3);
    expect([...rendered].filter((el) => el.getAttribute("tabindex") === "0")).toHaveLength(1);
    expect(screen.getByLabelText(/13 Sep 2026: Rp\s1\.250\.000, periode sebelumnya Rp\s900\.000/)).toBeTruthy();
  });

  it("calls onSelectDate on click and on Enter", () => {
    const onSelectDate = vi.fn();
    render(<TrendChart points={points} onSelectDate={onSelectDate} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);

    fireEvent.click(buttons[2]!);
    expect(onSelectDate).toHaveBeenLastCalledWith("2026-09-15");

    fireEvent.keyDown(buttons[0]!, { key: "Enter" });
    expect(onSelectDate).toHaveBeenLastCalledWith("2026-09-13");
    expect(onSelectDate).toHaveBeenCalledTimes(2);
  });

  it("shows a tooltip for the focused point and moves with arrow keys", () => {
    render(<TrendChart points={points} />);
    const first = screen.getAllByRole("img")[0]!;
    fireEvent.focus(first);
    expect(screen.getByRole("tooltip").textContent).toContain("13 Sep 2026");
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("tooltip").textContent).toContain("14 Sep 2026");
  });

  it("renders an empty state without points", () => {
    render(<TrendChart points={[]} />);
    expect(screen.getByText("Belum ada data untuk grafik")).toBeTruthy();
  });
});
```

- [ ] **Step 22: Run the test to verify it fails**

Run: `bun run widgets:test test/components/TrendChart.test.tsx`
Expected: FAIL with `Failed to resolve import "../../src/components/TrendChart" from "widgets/test/components/TrendChart.test.tsx"`.

- [ ] **Step 23: Implement TrendChart**

Hand-rolled SVG (no chart library). The SVG stretches over the plot box with `preserveAspectRatio="none"` and non-scaling strokes, and each point is an HTML element positioned in percent, so hit areas stay 24 px at any width. Points use a roving tab stop (one Tab stop; ←/→/Home/End move). Enter on a point, or a click, calls `onSelectDate`. Enter is handled in `onKeyDown` with `preventDefault`, so the browser's synthetic click does not fire a second time. The pointer shows the tooltip for the nearest day anywhere over the chart.

`widgets/src/components/TrendChart.tsx`:

```tsx
import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatDate, formatRupiah } from "../lib/format";
import { EmptyState } from "./EmptyState";
import { cx } from "./ui";

export interface TrendPoint {
  date: string;
  amount: number;
  comparisonAmount: number | null;
}

export interface TrendChartProps {
  points: TrendPoint[];
  onSelectDate?: (date: string) => void;
}

const compact = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });

function pointLabel(point: TrendPoint): string {
  const comparison = point.comparisonAmount === null ? "" : `, periode sebelumnya ${formatRupiah(point.comparisonAmount)}`;
  return `${formatDate(point.date)}: ${formatRupiah(point.amount)}${comparison}`;
}

/** Line chart of daily sales against the comparison period. Coordinates are percentages of the plot box. */
export function TrendChart({ points, onSelectDate }: TrendChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const tooltipId = useId();

  if (points.length === 0) return <EmptyState title="Belum ada data untuk grafik" />;

  const max = Math.max(1, ...points.map((p) => Math.max(p.amount, p.comparisonAmount ?? 0)));
  const x = (index: number) => (points.length === 1 ? 50 : (index / (points.length - 1)) * 100);
  const y = (amount: number) => 100 - (Math.max(0, amount) / max) * 100;
  const path = (values: Array<number | null>) => {
    let d = "";
    let drawing = false;
    values.forEach((v, index) => {
      if (v === null) {
        drawing = false;
        return;
      }
      d += `${drawing ? "L" : "M"}${x(index).toFixed(2)},${y(v).toFixed(2)}`;
      drawing = true;
    });
    return d;
  };
  const current = path(points.map((p) => p.amount));
  const comparison = path(points.map((p) => p.comparisonAmount));
  const hasComparison = comparison !== "";
  const tabStop = Math.min(focusIndex, points.length - 1);
  const activePoint = active === null ? undefined : points[active];

  function nearestIndex(event: PointerEvent<HTMLDivElement>): number {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || points.length === 1) return 0;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    return Math.round(ratio * (points.length - 1));
  }

  function onPointKeyDown(event: KeyboardEvent<HTMLElement>, index: number) {
    const point = points[index];
    if (!point) return;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = Math.min(points.length - 1, index + 1);
    else if (event.key === "ArrowLeft") next = Math.max(0, index - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = points.length - 1;
    else if (event.key === "Enter" && onSelectDate) {
      event.preventDefault();
      onSelectDate(point.date);
      return;
    }
    if (next === null) return;
    event.preventDefault();
    setFocusIndex(next);
    setActive(next);
    const group = event.currentTarget.parentElement;
    group?.querySelector<HTMLElement>(`[data-point-index="${next}"]`)?.focus();
  }

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-4 rounded bg-info" />
          Periode ini
        </span>
        {hasComparison ? (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-0 w-4 border-t-2 border-dashed border-current opacity-60" />
            Periode sebelumnya
          </span>
        ) : null}
        <span className="ml-auto tabular-nums">Maks Rp {compact.format(max)}</span>
      </figcaption>
      <div
        className="relative h-44 px-3 py-3"
        onPointerMove={(event) => setActive(nearestIndex(event))}
        onPointerLeave={() => setActive(null)}
      >
        <div role="group" aria-label="Grafik penjualan harian" className="relative h-full w-full">
          <svg
            aria-hidden="true"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible text-info"
          >
            {[0, 50, 100].map((gridY) => (
              <line
                key={gridY}
                x1={0}
                x2={100}
                y1={gridY}
                y2={gridY}
                stroke="currentColor"
                strokeOpacity={0.15}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {hasComparison ? (
              <path
                d={comparison}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.45}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            <path d={current} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </svg>
          {points.map((point, index) => {
            const common = {
              "data-point-index": index,
              tabIndex: index === tabStop ? 0 : -1,
              "aria-label": pointLabel(point),
              "aria-describedby": active === index ? tooltipId : undefined,
              onFocus: () => {
                setFocusIndex(index);
                setActive(index);
              },
              onBlur: () => setActive(null),
              onKeyDown: (event: KeyboardEvent<HTMLElement>) => onPointKeyDown(event, index),
              style: { left: `${x(index)}%`, top: `${y(point.amount)}%` },
              className: "absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full",
            };
            const dot = (
              <span
                aria-hidden="true"
                className={cx("block rounded-full bg-info", active === index ? "size-3" : points.length > 62 ? "size-0" : "size-2")}
              />
            );
            return onSelectDate ? (
              <button key={point.date} type="button" {...common} onClick={() => onSelectDate(point.date)}>
                {dot}
              </button>
            ) : (
              <span key={point.date} role="img" {...common}>
                {dot}
              </span>
            );
          })}
          {activePoint && active !== null ? (
            <div
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-xs text-fg shadow"
              style={{
                left: `${x(active)}%`,
                top: `${y(activePoint.amount)}%`,
                transform: `translate(${x(active) < 15 ? "0" : x(active) > 85 ? "-100%" : "-50%"}, calc(-100% - 12px))`,
              }}
            >
              <p className="font-medium">{formatDate(activePoint.date)}</p>
              <p className="tabular-nums">Periode ini: {formatRupiah(activePoint.amount)}</p>
              {activePoint.comparisonAmount !== null ? (
                <p className="tabular-nums text-fg-muted">Sebelumnya: {formatRupiah(activePoint.comparisonAmount)}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {first && last ? (
        <div className="flex justify-between px-3 text-xs tabular-nums text-fg-muted">
          <span>{formatDate(first.date)}</span>
          {points.length > 1 ? <span>{formatDate(last.date)}</span> : null}
        </div>
      ) : null}
    </figure>
  );
}
```

- [ ] **Step 24: Run the test to verify it passes**

Run: `bun run widgets:test test/components/TrendChart.test.tsx && bun run widgets:check-types`
Expected: 1 test file PASS (4 tests); `tsc` exits 0.

- [ ] **Step 25: Commit**

```bash
git add widgets/src/components/TrendChart.tsx widgets/test/components/TrendChart.test.tsx
git commit -m "feat(widgets): accessible SVG trend chart with day selection

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 26: Write the failing DataTable test**

`widgets/test/components/DataTable.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataTable, dataColumnHelper } from "../../src/components/DataTable";

type Item = { id: number; name: string; quantity: number };

const col = dataColumnHelper<Item>();
const columns = col.columns([
  col.accessor("name", { header: "Produk" }),
  col.accessor("quantity", { header: "Terjual", meta: { align: "right" } }),
]);

function dataRows(): HTMLElement[] {
  return screen.getAllByRole("row").filter((row) => row.getAttribute("aria-rowindex") !== "1");
}

describe("DataTable", () => {
  const manyRows: Item[] = Array.from({ length: 500 }, (_, i) => ({ id: i + 1, name: `Produk ${i + 1}`, quantity: i }));

  it("virtualizes rows inside the measured scroll box", () => {
    // happy-dom has no layout: give the scroll box 440 px and each row 44 px.
    const offsetHeight = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.getAttribute("role") === "rowgroup" ? 440 : 44;
    });
    try {
      render(<DataTable rows={manyRows} columns={columns} getRowId={(r) => String(r.id)} emptyText="Tidak ada data" />);
      expect(screen.getByRole("table").getAttribute("aria-rowcount")).toBe("501");
      expect(dataRows().length).toBeLessThan(40);
      expect(screen.getByText("Produk 1")).toBeTruthy();
      expect(screen.queryByText("Produk 300")).toBeNull();

      const scroller = screen.getAllByRole("rowgroup")[1]!;
      scroller.scrollTop = 44 * 299;
      fireEvent.scroll(scroller);
      expect(screen.getByText("Produk 300")).toBeTruthy();
      expect(screen.queryByText("Produk 1")).toBeNull();
    } finally {
      offsetHeight.mockRestore();
    }
  });

  it("shows the rows that fit in maxHeight before the scroll box is measured", () => {
    render(<DataTable rows={manyRows} columns={columns} getRowId={(r) => String(r.id)} maxHeight={440} emptyText="Tidak ada data" />);
    const rendered = dataRows();
    expect(rendered).toHaveLength(10);
    expect(within(rendered[0]!).getByText("Produk 1")).toBeTruthy();
  });

  it("sorts loaded rows when a header is clicked", () => {
    const rows: Item[] = [
      { id: 1, name: "Beta", quantity: 5 },
      { id: 2, name: "Alpha", quantity: 20 },
      { id: 3, name: "Gamma", quantity: 1 },
    ];
    render(<DataTable rows={rows} columns={columns} getRowId={(r) => String(r.id)} emptyText="Tidak ada data" />);
    const firstName = () => within(dataRows()[0]!).getAllByRole("cell")[0]!.textContent;

    expect(firstName()).toBe("Beta");
    fireEvent.click(screen.getByRole("button", { name: /Terjual/ }));
    expect(firstName()).toBe("Alpha"); // numbers sort descending first
    expect(screen.getAllByRole("columnheader")[1]!.getAttribute("aria-sort")).toBe("descending");
    fireEvent.click(screen.getByRole("button", { name: /Terjual/ }));
    expect(firstName()).toBe("Gamma");
    fireEvent.click(screen.getByRole("button", { name: /Produk/ }));
    expect(firstName()).toBe("Alpha"); // text sorts ascending first
  });

  it("calls onRowClick and toggles expanded content", () => {
    const onRowClick = vi.fn();
    const rows: Item[] = [{ id: 7, name: "Kampas rem", quantity: 3 }];
    render(
      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => String(r.id)}
        onRowClick={onRowClick}
        renderExpanded={(r) => <p>Detail {r.name}</p>}
        emptyText="Tidak ada data"
      />,
    );
    const row = dataRows()[0]!;
    fireEvent.click(row);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
    expect(screen.getByText("Detail Kampas rem")).toBeTruthy();
    fireEvent.keyDown(row, { key: "Enter" });
    expect(screen.queryByText("Detail Kampas rem")).toBeNull();
  });

  it("follows expandedRowId when expansion is controlled", () => {
    const onRowClick = vi.fn();
    const rows: Item[] = [
      { id: 1, name: "Pelanggan A", quantity: 2 },
      { id: 2, name: "Pelanggan B", quantity: 4 },
    ];
    const props = {
      rows,
      columns,
      getRowId: (r: Item) => String(r.id),
      onRowClick,
      renderExpanded: (r: Item) => <p>Detail {r.name}</p>,
      emptyText: "Tidak ada data",
    };
    const { rerender } = render(<DataTable {...props} expandedRowId={null} />);

    // A click reports the row but does not expand it: the parent owns the open id.
    fireEvent.click(dataRows()[1]!);
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
    expect(screen.queryByText(/^Detail /)).toBeNull();

    rerender(<DataTable {...props} expandedRowId="2" />);
    expect(screen.getByText("Detail Pelanggan B")).toBeTruthy();
    expect(dataRows()[1]!.getAttribute("aria-expanded")).toBe("true");
    expect(dataRows()[0]!.getAttribute("aria-expanded")).toBe("false");

    rerender(<DataTable {...props} expandedRowId="1" />);
    expect(screen.getByText("Detail Pelanggan A")).toBeTruthy();
    expect(screen.queryByText("Detail Pelanggan B")).toBeNull();
  });

  it("shows the empty text and the footer when there are no rows", () => {
    render(
      <DataTable rows={[]} columns={columns} getRowId={(r) => String(r.id)} emptyText="Belum ada produk" footer={<p>Kaki tabel</p>} />,
    );
    expect(screen.getByText("Belum ada produk")).toBeTruthy();
    expect(screen.getByText("Kaki tabel")).toBeTruthy();
  });
});
```

- [ ] **Step 27: Run the test to verify it fails**

Run: `bun run widgets:test test/components/DataTable.test.tsx`
Expected: FAIL with `Failed to resolve import "../../src/components/DataTable" from "widgets/test/components/DataTable.test.tsx"`.

- [ ] **Step 28: Implement DataTable**

TanStack Table v9 API: `tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns })` plus `useTable({ features, columns, data })` and `table.FlexRender`. Do not use the v8 `useReactTable` or `getCoreRowModel`. The `text`/`alphanumeric` sort functions are registered because v9 auto-sorting only uses registered functions for string columns. Rows are a CSS grid inside an ARIA table; the body scrolls vertically inside `maxHeight`, and the header and body share one horizontal scroller. `useVirtualizer` measures each row (`measureElement`), so expanded content can have any height. Until the scroll box has a height, the component renders the rows that fit. Expansion keeps its own set of open row ids unless the caller passes `expandedRowId` (controlled: only that row is open, and clicks only report through `onRowClick`).

`widgets/src/components/DataTable.tsx`:

```tsx
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef as TableColumnDef,
  type RowData,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useState, type ReactNode } from "react";
import { EmptyState } from "./EmptyState";
import { cx } from "./ui";

/** Per-column layout hints, read from `columnDef.meta`. */
export interface DataColumnMeta {
  align?: "left" | "right";
  /** Minimum column width in px (default 96). */
  minWidth?: number;
  /** Share of the remaining width (default 1). */
  grow?: number;
}

export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic, text: sortFn_text },
  columnMeta: {} as DataColumnMeta,
});
export type DataTableFeatures = typeof dataTableFeatures;

/** TanStack Table v9 column definition bound to the DataTable feature set. */
export type ColumnDef<Row extends RowData> = TableColumnDef<DataTableFeatures, Row, any>;

/** Column helper for DataTable columns: `const col = dataColumnHelper<StockRow>()`. */
export function dataColumnHelper<Row extends RowData>() {
  return createColumnHelper<DataTableFeatures, Row>();
}

export interface DataTableProps<Row extends RowData> {
  rows: Row[];
  columns: ColumnDef<Row>[];
  getRowId: (row: Row) => string;
  onRowClick?: (row: Row) => void;
  /** When set, clicking a row toggles this content below it. */
  renderExpanded?: (row: Row) => ReactNode;
  /**
   * Controlled expansion: when not undefined, only the row whose id (from getRowId) equals this
   * value shows renderExpanded (null: none), and a click only calls onRowClick.
   */
  expandedRowId?: string | null;
  estimateRowHeight?: number;
  maxHeight?: number;
  emptyText: string;
  footer?: ReactNode;
  /** Accessible table name. */
  label?: string;
}

const DEFAULT_MIN_WIDTH = 96;

/** Sortable (loaded rows only), virtualized table. Rows scroll inside a box of at most `maxHeight` px. */
export function DataTable<Row extends RowData>({
  rows,
  columns,
  getRowId,
  onRowClick,
  renderExpanded,
  expandedRowId,
  estimateRowHeight = 44,
  maxHeight = 560,
  emptyText,
  footer,
  label,
}: DataTableProps<Row>) {
  const table = useTable({ features: dataTableFeatures, columns, data: rows, getRowId: (row) => getRowId(row) });
  const modelRows = table.getRowModel().rows;
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const controlled = expandedRowId !== undefined;
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);

  const virtualizer = useVirtualizer({
    count: modelRows.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => estimateRowHeight,
    getItemKey: (index) => modelRows[index]?.id ?? index,
    overscan: 8,
  });

  // Before the scroll box has a measured height (first paint, or DOM shims without layout) the
  // virtualizer yields no items; show the rows that fit in maxHeight until it measures.
  const measured = virtualizer.getVirtualItems();
  const items =
    measured.length > 0
      ? measured
      : modelRows
          .slice(0, Math.ceil(maxHeight / estimateRowHeight))
          .map((row, index) => ({ key: row.id, index, start: index * estimateRowHeight }));

  const leafColumns = table.getAllLeafColumns();
  const template = leafColumns
    .map((column) => `minmax(${column.columnDef.meta?.minWidth ?? DEFAULT_MIN_WIDTH}px, ${column.columnDef.meta?.grow ?? 1}fr)`)
    .join(" ");
  const minWidth = leafColumns.reduce((sum, column) => sum + (column.columnDef.meta?.minWidth ?? DEFAULT_MIN_WIDTH), 0);
  const headers = table.getHeaderGroups().at(-1)?.headers ?? [];
  const interactive = Boolean(onRowClick || renderExpanded);

  function toggle(id: string) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-1">
      <div className="overflow-x-auto rounded-lg border border-line">
        <div role="table" aria-label={label} aria-rowcount={modelRows.length + 1} style={{ minWidth }}>
          <div role="rowgroup" className="border-b border-line bg-surface-muted">
            <div role="row" aria-rowindex={1} className="grid" style={{ gridTemplateColumns: template }}>
              {headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const canSort = header.column.getCanSort();
                const align = header.column.columnDef.meta?.align === "right" ? "justify-end text-right" : "justify-start text-left";
                return (
                  <div
                    key={header.id}
                    role="columnheader"
                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : canSort ? "none" : undefined}
                    className={cx("flex min-h-9 items-center px-3 text-xs font-medium text-fg-muted", align)}
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cx("inline-flex items-center gap-1 rounded", align)}
                      >
                        <table.FlexRender header={header} />
                        <span aria-hidden="true" className="w-3">
                          {sorted === "asc" ? "▲" : sorted === "desc" ? "▼" : ""}
                        </span>
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {modelRows.length === 0 ? (
            <div className="p-3">
              <EmptyState title={emptyText} />
            </div>
          ) : (
            <div ref={setScrollElement} role="rowgroup" className="overflow-y-auto" style={{ maxHeight }}>
              <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
                {items.map((item) => {
                  const row = modelRows[item.index];
                  if (!row) return null;
                  const isExpanded = renderExpanded ? (controlled ? row.id === expandedRowId : expanded.has(row.id)) : false;
                  const activate = () => {
                    if (renderExpanded && !controlled) toggle(row.id);
                    onRowClick?.(row.original);
                  };
                  return (
                    <div
                      key={item.key}
                      data-index={item.index}
                      ref={virtualizer.measureElement}
                      className="absolute left-0 top-0 w-full border-b border-line-muted"
                      style={{ transform: `translateY(${item.start}px)` }}
                    >
                      <div
                        role="row"
                        aria-rowindex={item.index + 2}
                        aria-expanded={renderExpanded ? isExpanded : undefined}
                        tabIndex={interactive ? 0 : undefined}
                        onClick={interactive ? activate : undefined}
                        onKeyDown={
                          interactive
                            ? (event) => {
                                if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                                  event.preventDefault();
                                  activate();
                                }
                              }
                            : undefined
                        }
                        className={cx("grid items-center", interactive && "cursor-pointer hover:bg-surface-muted")}
                        style={{ gridTemplateColumns: template, minHeight: estimateRowHeight }}
                      >
                        {row.getAllCells().map((cell) => (
                          <div
                            key={cell.id}
                            role="cell"
                            className={cx(
                              "min-w-0 px-3 py-2 text-sm text-fg",
                              cell.column.columnDef.meta?.align === "right" && "text-right tabular-nums",
                            )}
                          >
                            <table.FlexRender cell={cell} />
                          </div>
                        ))}
                      </div>
                      {isExpanded && renderExpanded ? (
                        <div role="row">
                          <div role="cell" aria-colspan={leafColumns.length} className="px-3 pb-3">
                            {renderExpanded(row.original)}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      {footer}
    </div>
  );
}
```

- [ ] **Step 29: Run the test to verify it passes**

Run: `bun run widgets:test test/components/DataTable.test.tsx && bun run widgets:check-types`
Expected: 1 test file PASS (6 tests); `tsc` exits 0.

- [ ] **Step 30: Commit**

```bash
git add widgets/src/components/DataTable.tsx widgets/test/components/DataTable.test.tsx
git commit -m "feat(widgets): sortable virtualized data table (TanStack Table v9 + Virtual)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 31: Write the failing ViewFrame test**

`widgets/test/components/ViewFrame.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VIEWS } from "../../../src/widgets/contract";
import { VIEW_PATH } from "../../src/app/viewPaths";
import { BridgeContext, type Bridge } from "../../src/bridge/bridge";
import { createMockBridge } from "../../src/bridge/mockBridge";
import { ViewFrame } from "../../src/components/ViewFrame";

/** Six stub routes rendering ViewFrame, so the switcher can navigate between real paths. */
function renderFrame(bridge: Bridge, queryClient = new QueryClient()) {
  const rootRoute = createRootRoute();
  const routes = VIEWS.map((view) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: VIEW_PATH[view],
      component: () => (
        <ViewFrame title={`Judul ${view}`} subtitle="Outlet 100001 · Diperbarui 10.00">
          <p>Isi {view}</p>
        </ViewFrame>
      ),
    }),
  );
  const router = createRouter({ routeTree: rootRoute.addChildren(routes), history: createMemoryHistory({ initialEntries: ["/stok"] }) });
  render(
    <BridgeContext.Provider value={bridge}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </BridgeContext.Provider>,
  );
}

describe("ViewFrame", () => {
  it("renders the header and main landmark, marks the current view and navigates", async () => {
    renderFrame(createMockBridge({ host: { canFullscreen: false } }));
    expect(await screen.findByRole("heading", { name: "Judul stok" })).toBeTruthy();
    expect(screen.getByText("Outlet 100001 · Diperbarui 10.00")).toBeTruthy();
    expect(screen.getByRole("main").textContent).toBe("Isi stok");
    expect(screen.getByRole("link", { name: "Stok" }).getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("button", { name: "Layar penuh" })).toBeNull();

    fireEvent.click(screen.getByRole("link", { name: "Piutang" }));
    expect(await screen.findByRole("heading", { name: "Judul piutang" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Piutang" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Stok" }).getAttribute("aria-current")).toBeNull();
  });

  it("refetches active queries and toggles fullscreen when the host allows it", async () => {
    const bridge = createMockBridge({ host: { canFullscreen: true } });
    const queryClient = new QueryClient();
    const refetch = vi.spyOn(queryClient, "refetchQueries");
    renderFrame(bridge, queryClient);

    fireEvent.click(await screen.findByRole("button", { name: "Muat ulang" }));
    expect(refetch).toHaveBeenCalledWith({ type: "active" });
    fireEvent.click(screen.getByRole("button", { name: "Layar penuh" }));
    expect(bridge.host.displayMode).toBe("fullscreen");
  });
});
```

- [ ] **Step 32: Run the test to verify it fails**

Run: `bun run widgets:test test/components/ViewFrame.test.tsx`
Expected: FAIL with `Failed to resolve import "../../src/components/ViewFrame" from "widgets/test/components/ViewFrame.test.tsx"`.

- [ ] **Step 33: Implement ViewSwitcher and ViewFrame**

`ViewFrame` derives the current view from the router location, so routes only pass their title. "Muat ulang" refetches the active queries (the view tool, then pages already loaded) and is disabled while anything is fetching. The fullscreen button appears only when the host lists fullscreen.

`widgets/src/components/ViewSwitcher.tsx`:

```tsx
import { Link } from "@tanstack/react-router";
import { VIEWS, type ViewName } from "../../../src/widgets/contract";
import { VIEW_LABEL, VIEW_PATH } from "../app/viewPaths";
import { cx } from "./ui";

export function ViewSwitcher({ current }: { current: ViewName }) {
  return (
    <nav aria-label="Pilih tampilan" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {VIEWS.map((view) => {
        const active = view === current;
        return (
          <Link
            key={view}
            to={VIEW_PATH[view]}
            aria-current={active ? "page" : undefined}
            className={cx(
              "inline-flex min-h-8 shrink-0 items-center rounded-md px-3 text-sm",
              active ? "bg-info-soft font-medium text-info" : "text-fg-muted hover:bg-surface-muted",
            )}
          >
            {VIEW_LABEL[view]}
          </Link>
        );
      })}
    </nav>
  );
}
```

`widgets/src/components/ViewFrame.tsx`:

```tsx
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { VIEWS } from "../../../src/widgets/contract";
import { VIEW_PATH } from "../app/viewPaths";
import { useBridge } from "../bridge/bridge";
import { ViewSwitcher } from "./ViewSwitcher";
import { buttonClass } from "./ui";

export interface ViewFrameProps {
  title: string;
  /** e.g. "Outlet 100001 · Diperbarui 14.32" */
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function ViewFrame({ title, subtitle, actions, children }: ViewFrameProps) {
  const bridge = useBridge();
  const queryClient = useQueryClient();
  const fetching = useIsFetching() > 0;
  const pathname = useLocation({ select: (location) => location.pathname });
  const current = VIEWS.find((view) => VIEW_PATH[view] === pathname) ?? "penjualan";
  const fullscreen = bridge.host.displayMode === "fullscreen";

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-fg">{title}</h1>
          {subtitle ? <p className="text-xs text-fg-muted">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <button
            type="button"
            className={buttonClass}
            disabled={fetching}
            onClick={() => {
              void queryClient.refetchQueries({ type: "active" });
            }}
          >
            {fetching ? "Memuat…" : "Muat ulang"}
          </button>
          {bridge.host.canFullscreen ? (
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                void bridge.toggleFullscreen();
              }}
            >
              {fullscreen ? "Keluar layar penuh" : "Layar penuh"}
            </button>
          ) : null}
        </div>
      </header>
      <ViewSwitcher current={current} />
      <main className="space-y-4">{children}</main>
    </div>
  );
}
```

- [ ] **Step 34: Run every widget test and all type checks**

Run: `bun run widgets:test && bun run check-types`
Expected: 17 test files PASS (119 tests: T8's 86 in 8 files plus 33 component tests in 9 files); all three `tsc` runs exit 0.

- [ ] **Step 35: Commit**

```bash
git add widgets/src/components/ViewSwitcher.tsx widgets/src/components/ViewFrame.tsx widgets/test/components/ViewFrame.test.tsx
git commit -m "feat(widgets): view frame with refresh, fullscreen and view switcher

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

---

### Task 10: Widget bundle pipeline

**Files:**
- Create: `scripts/lib/widget-source-hash.ts`
- Create: `scripts/bundle-widgets.ts`
- Create (generated by `bun run widgets:bundle`, committed): `src/widgets/bundled.ts`
- Modify: `package.json` (`widgets:bundle` script)
- Test: `tests/unit/widgets-bundle.test.ts`

**Interfaces:**
- Consumes:
  - T1: `VIEW_MARKER` from `src/widgets/contract.ts`.
  - T8: the `widgets:build` script, which writes the single file `widgets/dist/index.html` containing `<head>` and exactly one `__MJ_VIEW__` (in `data-view`); widget code never spells the marker.
  - T9: nothing directly. Its components are hashed inputs under `widgets/src/**`.
- Produces:
  - `scripts/lib/widget-source-hash.ts`:
    - `WIDGET_SOURCE_FILES: readonly string[]`
    - `WIDGET_SOURCE_DIRS: readonly string[]`
    - `widgetSourceFiles(root: string): string[]`
    - `computeWidgetSourceHash(root: string): string` (sha256 hex)
  - `src/widgets/bundled.ts`:
    - `WIDGET_SOURCE_HASH: string` (64 hex chars)
    - `WIDGET_HTML: string` (the SPA with `<meta name="mj-build" content="<hash first 12>" />` right after `<head>`)
    - T11 imports both.
  - `package.json` script `widgets:bundle`.

Hash inputs (sorted repo-relative paths; each file contributes `path\0content\0`):
- The files `widgets/index.html`, `widgets/vite.config.ts`, `widgets/tsconfig.json`, `src/widgets/contract.ts`, `bun.lock` and `package.json`.
- Everything under `widgets/src/` and `widgets/dev/`, skipping dotfiles such as `.DS_Store`.
- CRLF is normalized to LF, so a Windows checkout hashes the same.
- Missing entries are skipped; the path list is part of the hash, so adding or removing a file still changes it.
- Tests (`widgets/test/`) and `widgets/vitest.config.ts` are not inputs.

**Rule for later tasks:** whoever changes a hashed input runs `bun run widgets:bundle` and commits `src/widgets/bundled.ts` in the same commit. So `src/widgets/bundled.ts` is generated here and regenerated and committed by T12, T13 and T14 (widget sources), T15 (`playwright-core` and `widgets:smoke` in `package.json`/`bun.lock`) and T16 (version bump in `package.json`). Otherwise `tests/unit/widgets-bundle.test.ts` fails with "widget sources changed: run bun run widgets:bundle".

**Working tree:** the drift test hashes the working tree, not the last commit, so any uncommitted edit under `widgets/src`, `widgets/dev` or another hashed input makes the full `bun run test` fail. Run this task in the Lane W worktree (separate from Lane S, per the plan's execution lanes), and start Step 6 with no uncommitted edits to hashed inputs other than this task's `package.json` change from Step 5 (check with `git status --short widgets src/widgets/contract.ts bun.lock`, which must print nothing).

`tsconfig.scripts.json` already includes `scripts/**/*.ts`, so it type-checks `scripts/lib/`. The root `tsconfig.json` excludes `scripts/**` from its globs, but still type-checks `scripts/lib/widget-source-hash.ts` because the root test imports it (verified: a type error planted in that file fails both `tsc` runs). No tsconfig change is needed.

- [ ] **Step 1: Write the failing bundle test**

`tests/unit/widgets-bundle.test.ts`:

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { computeWidgetSourceHash, widgetSourceFiles } from "../../scripts/lib/widget-source-hash";
import { WIDGET_HTML, WIDGET_SOURCE_HASH } from "../../src/widgets/bundled";
import { VIEW_MARKER } from "../../src/widgets/contract";

const root = path.resolve(__dirname, "../..");

describe("widget source hash", () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  function fixture(): string {
    dir = mkdtempSync(path.join(tmpdir(), "widget-hash-"));
    const files: Record<string, string> = {
      "package.json": "{}\n",
      "bun.lock": "lock\n",
      "src/widgets/contract.ts": "export const A = 1;\n",
      "widgets/index.html": "<div id=\"root\"></div>\n",
      "widgets/vite.config.ts": "export default {};\n",
      "widgets/tsconfig.json": "{}\n",
      "widgets/src/main.tsx": "export {};\n",
      "widgets/src/components/Chip.tsx": "export {};\n",
      "widgets/dev/fixtures.ts": "export {};\n",
      "widgets/test/components/Chip.test.tsx": "export {};\n",
    };
    for (const [rel, content] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      writeFileSync(path.join(dir, rel), content);
    }
    return dir;
  }

  it("lists bundle inputs in sorted order, without tests or dotfiles", () => {
    const base = fixture();
    writeFileSync(path.join(base, "widgets/src/.DS_Store"), "x");
    expect(widgetSourceFiles(base)).toEqual([
      "bun.lock",
      "package.json",
      "src/widgets/contract.ts",
      "widgets/dev/fixtures.ts",
      "widgets/index.html",
      "widgets/src/components/Chip.tsx",
      "widgets/src/main.tsx",
      "widgets/tsconfig.json",
      "widgets/vite.config.ts",
    ]);
  });

  it("changes when a widget source changes and ignores tests and line endings", () => {
    const base = fixture();
    const before = computeWidgetSourceHash(base);
    expect(before).toMatch(/^[0-9a-f]{64}$/);

    writeFileSync(path.join(base, "widgets/test/components/Chip.test.tsx"), "export const changed = true;\n");
    writeFileSync(path.join(base, "widgets/src/main.tsx"), "export {};\r\n");
    expect(computeWidgetSourceHash(base)).toBe(before);

    writeFileSync(path.join(base, "widgets/src/components/Chip.tsx"), "export const Chip = 1;\n");
    expect(computeWidgetSourceHash(base)).not.toBe(before);
  });
});

describe("bundled widget HTML (src/widgets/bundled.ts)", () => {
  it("was generated from the current widget sources", () => {
    expect(computeWidgetSourceHash(root), "widget sources changed: run bun run widgets:bundle").toBe(WIDGET_SOURCE_HASH);
  });

  it("carries the view marker exactly once and the build stamp", () => {
    expect(WIDGET_HTML.split(VIEW_MARKER)).toHaveLength(2);
    expect(WIDGET_HTML).toContain(`<meta name="mj-build" content="${WIDGET_SOURCE_HASH.slice(0, 12)}" />`);
  });

  it("loads nothing from the network", () => {
    expect(WIDGET_HTML).not.toMatch(/<script[^>]*\ssrc\s*=/i);
    expect(WIDGET_HTML).not.toMatch(/<link[^>]*rel\s*=\s*["']?stylesheet/i);
    expect(WIDGET_HTML).not.toMatch(/url\(\s*["']?https?:/i);
    expect(WIDGET_HTML).not.toMatch(/import\(\s*["'`]https?:/i);
  });

  it("stays under 1 MB and renders no <form>", () => {
    expect(WIDGET_HTML.length).toBeLessThan(1_000_000);
    expect(WIDGET_HTML).not.toMatch(/<form[\s>/]/i);
  });

  it("contains no credential-like strings", () => {
    const patterns: RegExp[] = [
      /Bearer\s+[A-Za-z0-9._~+/=-]{12,}/,
      /qasir_sess=|XSRF-TOKEN=|tokenWeb=/,
      /API_TOKEN/,
      /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
      /["'`][A-Za-z0-9]{32}["'`]/,
    ];
    for (const pattern of patterns) expect(WIDGET_HTML, String(pattern)).not.toMatch(pattern);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test tests/unit/widgets-bundle.test.ts`
Expected: FAIL with `Error: Cannot find module '../../scripts/lib/widget-source-hash' imported from …/tests/unit/widgets-bundle.test.ts`.

- [ ] **Step 3: Implement the source hash**

`scripts/lib/widget-source-hash.ts`:

```ts
/**
 * Fingerprint of every input that shapes the widget bundle in src/widgets/bundled.ts.
 * scripts/bundle-widgets.ts stores it as WIDGET_SOURCE_HASH and
 * tests/unit/widgets-bundle.test.ts recomputes it to catch a stale bundle.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** Single files, relative to the repo root. */
export const WIDGET_SOURCE_FILES: readonly string[] = [
  "widgets/index.html",
  "widgets/vite.config.ts",
  "widgets/tsconfig.json",
  "src/widgets/contract.ts",
  "bun.lock",
  "package.json",
];

/** Directories hashed recursively (dotfiles such as .DS_Store are skipped). */
export const WIDGET_SOURCE_DIRS: readonly string[] = ["widgets/src", "widgets/dev"];

function listFiles(root: string, dir: string): string[] {
  const absolute = path.join(root, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".")) return [];
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return listFiles(root, relative);
    return entry.isFile() ? [relative] : [];
  });
}

/** Repo-relative POSIX paths of the hashed files, sorted by code unit. */
export function widgetSourceFiles(root: string): string[] {
  const files = WIDGET_SOURCE_FILES.filter((file) => existsSync(path.join(root, file)));
  return [...files, ...WIDGET_SOURCE_DIRS.flatMap((dir) => listFiles(root, dir))].sort();
}

/** sha256 hex over each file's path and content (CRLF normalized to LF). */
export function computeWidgetSourceHash(root: string): string {
  const hash = createHash("sha256");
  for (const file of widgetSourceFiles(root)) {
    const content = readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
    hash.update(`${file}\0`);
    hash.update(content);
    hash.update("\0");
  }
  return hash.digest("hex");
}
```

- [ ] **Step 4: Implement the bundle script**

The script hashes the sources, runs the Vite single-file build, stamps the build, refuses HTML that does not contain the view marker exactly once, and writes the generated module. It imports the contract only for `VIEW_MARKER` (bun runs TypeScript directly, like `scripts/bundle-docs.ts`).

`scripts/bundle-widgets.ts`:

```ts
/**
 * Builds the widget SPA (widgets/) into one HTML file and regenerates src/widgets/bundled.ts:
 *   bun run widgets:bundle
 * Run it after changing anything under widgets/src, widgets/dev, widgets/index.html,
 * widgets/vite.config.ts, widgets/tsconfig.json, src/widgets/contract.ts, package.json or bun.lock.
 * tests/unit/widgets-bundle.test.ts fails while the committed bundle is stale.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { VIEW_MARKER } from "../src/widgets/contract";
import { computeWidgetSourceHash } from "./lib/widget-source-hash";

const root = path.resolve(import.meta.dirname, "..");
const hash = computeWidgetSourceHash(root);

execFileSync("bun", ["run", "widgets:build"], { cwd: root, stdio: "inherit" });

const built = readFileSync(path.join(root, "widgets", "dist", "index.html"), "utf8");
const head = /<head(\s[^>]*)?>/i.exec(built);
if (!head) throw new Error("widgets/dist/index.html has no <head> element");
const insertAt = head.index + head[0].length;
const html = `${built.slice(0, insertAt)}\n    <meta name="mj-build" content="${hash.slice(0, 12)}" />${built.slice(insertAt)}`;

const markers = html.split(VIEW_MARKER).length - 1;
if (markers !== 1) {
  throw new Error(`Expected ${VIEW_MARKER} exactly once in the widget HTML, found ${markers}`);
}

const out = [
  "/** Widget SPA for ui://manujujaya/* resources. Generated by scripts/bundle-widgets.ts; do not edit. */",
  `export const WIDGET_SOURCE_HASH = ${JSON.stringify(hash)};`,
  `export const WIDGET_HTML: string = ${JSON.stringify(html)};`,
  "",
].join("\n");
writeFileSync(path.join(root, "src", "widgets", "bundled.ts"), out);
console.log(`Wrote src/widgets/bundled.ts (${html.length} chars, source hash ${hash.slice(0, 12)})`);
```

- [ ] **Step 5: Add the `widgets:bundle` script**

In `package.json`, replace:

```json
    "widgets:check-types": "tsc --noEmit -p widgets/tsconfig.json"
  },
```

with:

```json
    "widgets:check-types": "tsc --noEmit -p widgets/tsconfig.json",
    "widgets:bundle": "bun run scripts/bundle-widgets.ts"
  },
```

`package.json` is a hashed input, so this edit comes before generating the bundle.

- [ ] **Step 6: Generate `src/widgets/bundled.ts`**

Run: `bun run widgets:bundle`
Expected: the Vite output (`[plugin vite:singlefile] Inlining: index-….js`, `Inlining: style-….css`, `widgets/dist/index.html  ~588 kB │ gzip: ~172 kB`, `✓ built in …`), then `Wrote src/widgets/bundled.ts (≈588000 chars, source hash <12 hex>)`.

Run: `head -c 300 src/widgets/bundled.ts`
Expected:

```
/** Widget SPA for ui://manujujaya/* resources. Generated by scripts/bundle-widgets.ts; do not edit. */
export const WIDGET_SOURCE_HASH = "<64 hex>";
export const WIDGET_HTML: string = "<!doctype html>\n<html lang=\"id\">\n  <head>\n    <meta name=\"mj-build\" content=\"<12 hex>\" />\n    <meta charset=\"UTF-8\" />…
```

- [ ] **Step 7: Run the tests and all type checks**

Run: `bun run test tests/unit/widgets-bundle.test.ts && bun run check-types && bun run test`
Expected: `tests/unit/widgets-bundle.test.ts` PASS (7 tests); all three `tsc` runs exit 0; the whole root suite PASS.

- [ ] **Step 8: Prove the drift check is not vacuous**

Run: `echo "// drift" >> widgets/src/components/ui.ts; bun run test tests/unit/widgets-bundle.test.ts; git checkout -- widgets/src/components/ui.ts`
Expected: 1 failed | 6 passed, with `AssertionError: widget sources changed: run bun run widgets:bundle: expected '…' to be '…'`; after the checkout the file is back to its committed content.

- [ ] **Step 9: Commit**

```bash
git add package.json scripts/lib/widget-source-hash.ts scripts/bundle-widgets.ts src/widgets/bundled.ts tests/unit/widgets-bundle.test.ts
git commit -m "build(widgets): single-file widget bundle with source-hash drift test

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 10: Confirm the bundle is reproducible**

Run: `bun run widgets:bundle && git status --short src/widgets/bundled.ts`
Expected: the same `Wrote src/widgets/bundled.ts (…)` line, and no `git status` output: the build is deterministic, so regenerating from unchanged sources leaves the committed file identical.

---

---

### Task 11: Registration, protocol and security tests

**Files:**
- Create: `src/widgets/tools/index.ts`
- Create: `src/widgets/resources.ts`
- Modify: `src/mcp/server.ts`
- Modify: `src/mcp/resources.ts`
- Modify: `worker-configuration.d.ts`
- Modify: `wrangler.jsonc`
- Test: `tests/security/widget-tools.test.ts` (new)
- Test: `tests/protocol/mcp-wire.test.ts` (modify)
- Test: `tests/protocol/capabilities.test.ts` (modify)

**Interfaces:**
- Consumes:
  - `SALES_TOOLS` (T3), `STOCK_TOOLS` (T4), `PURCHASE_TOOLS` (T5), `TRANSACTION_TOOLS` (T6), `DEBT_TOOLS` (T7), each `readonly AnyWidgetToolDef[]`.
  - `registerWidgetTool`, `AnyWidgetToolDef`, `WidgetToolDeps` from `src/widgets/tools/define.ts` (T2).
  - `envelope`, `fakeSessions` from `tests/stubs/widget-harness.ts` (T2).
  - `WIDGET_HTML` from `src/widgets/bundled.ts` (T10).
  - From `src/widgets/contract.ts` (T1): `VIEWS`, `VIEW_TOOL`, `APP_TOOL`, `WIDGET_TOOL_NAMES`, `VIEW_MARKER`, `MCP_APP_MIME_TYPE`, `viewResourceUri`, `type ViewName`, `type ToolName`.
- Produces:
  - `src/widgets/tools/index.ts`:
    - `export const ALL_WIDGET_TOOLS: readonly AnyWidgetToolDef[]`: the 6 view tools in `VIEWS` order, then the 9 app-only tools in `APP_TOOL` order.
    - `export function registerWidgetTools(server: McpServer, deps: WidgetToolDeps): string[]`
  - `src/widgets/resources.ts`:
    - `export const WIDGET_RESOURCE_TTL_MS = 600_000`
    - `export function renderViewHtml(html: string, view: ViewName): string`
    - `export function registerWidgetResources(server: McpServer, html: string): void`
  - `ServerDeps` gains `widgetHtml?: string` (default `WIDGET_HTML`) and `now?: () => Date`.
  - `CapabilitiesInfo` gains `widgetsEnabled: boolean`. The `qasir://capabilities` payload gains `widgets: { enabled, views, resourceUris }`; `views` and `resourceUris` are empty when disabled.
  - `Env.ENABLE_WIDGETS: string`. Widgets are registered unless the value is `"false"`.

**Wiring rules:**
- **Tools.** Widget tools are registered for every caller when `ENABLE_WIDGETS !== "false"`, because client UI capabilities only arrive per request, after the factory runs. They go after `search`, `execute` and `execute_mutation`, and before `registerResources`, so `capabilities.tools` lists them too. They reuse the per-request `dispatcher`, so `deps.dispatcher` stays injectable.
- **Resources.** The six `ui://` resources render the HTML inside the read callback, never at registration. The factory runs on every MCP request and must not copy a ~700 KB string six times.
- **Discovery.** `server/discover` capabilities stay unchanged: no `extensions`.
- **Test HTML.** Protocol and security tests inject a tiny `widgetHtml` containing `VIEW_MARKER`. Exactly one test reads the committed `WIDGET_HTML` to prove it is the default.

- [ ] **Step 1: Write the failing widget security test**

`ALLOWED_OPS` is the per-tool operation allowlist from spec §4.2. If a T3–T7 tool legitimately needs another read operation, change the spec and this table together.

`tests/security/widget-tools.test.ts`:

```ts
import { createMcpHandler } from "agents/mcp/server";
import { describe, expect, it } from "vitest";
import type { AuthPrincipal } from "../../src/auth/verify";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import { createManujujayaServer } from "../../src/mcp/server";
import { getOperation, listReadOperations } from "../../src/registry/operations";
import type { QasirSessionProvider } from "../../src/session/types";
import { VIEW_MARKER, WIDGET_TOOL_NAMES, type ToolName } from "../../src/widgets/contract";
import { ALL_WIDGET_TOOLS } from "../../src/widgets/tools";
import { createFakeDispatcher, MERCHANT_SLUG, readPrincipal, testEnv, type FakeDispatcher, type FixtureHandler } from "../stubs/codemode-harness";
import { createFakeWorkerLoader } from "../stubs/fake-worker-loader";
import { readWire, rpcRequest } from "../stubs/mcp-wire";
import { envelope, fakeSessions } from "../stubs/widget-harness";

const NOW = new Date("2026-09-15T03:00:00Z");
const TEST_WIDGET_HTML = `<!doctype html><html><body><div id="root" data-view="${VIEW_MARKER}"></div></body></html>`;
const NO_SCOPES: AuthPrincipal = { subject: "owner", scopes: [], via: "oauth" };

/** Arguments that pass every input schema and date-range rule (today is 2026-09-15 in Jakarta). */
const VALID_ARGS: Record<ToolName, Record<string, unknown>> = {
  show_sales_dashboard: { start_date: "2026-09-08", end_date: "2026-09-14" },
  show_product_ranking: { start_date: "2026-09-08", end_date: "2026-09-14", order: "terlaris" },
  product_ranking_page: { start_date: "2026-09-08", end_date: "2026-09-14", order: "kurang_laris", page: 2 },
  show_stock_browser: { search: "Filter" },
  stock_page: { search: "Filter", page: 2 },
  stock_history: { inventory_id: 25950360, page: 1 },
  stock_velocity: { inventory_id: 25950360 },
  show_purchase_orders: { status: "order_processed" },
  purchase_orders_page: { page: 2 },
  purchase_order_items: { purchase_id: "123456" },
  show_transactions: { start_date: "2026-09-08", end_date: "2026-09-14", customer_id: 11 },
  transactions_page: { start_date: "2026-09-08", end_date: "2026-09-14", customer_id: 11, page: 2 },
  order_detail: { sales_id: 1001 },
  show_customer_debts: { customer_id: 11 },
  customer_debt_detail: { customer_id: 11 },
};

/** The only upstream operations each tool may dispatch (spec §4.2). */
const ALLOWED_OPS: Record<ToolName, readonly string[]> = {
  show_sales_dashboard: [
    "reports.summaries.transaction",
    "reports.sales.trend",
    "reports.summaries.paymentMethods",
    "reports.categories",
    "reports.products",
    "reports.summaries.installment",
  ],
  show_product_ranking: ["reports.products", "reports.categories"],
  product_ranking_page: ["reports.products"],
  show_stock_browser: ["inventories.stockTurnover"],
  stock_page: ["inventories.stockTurnover"],
  stock_history: ["inventories.stockHistories"],
  stock_velocity: ["inventories.stockHistories"],
  show_purchase_orders: ["purchases.list"],
  purchase_orders_page: ["purchases.list"],
  purchase_order_items: ["purchases.items"],
  show_transactions: ["order.histories.web", "customers.get"],
  transactions_page: ["order.histories.web"],
  order_detail: ["order.histories.legacy"],
  show_customer_debts: ["order.histories.installment", "reports.summaries.installment"],
  customer_debt_detail: ["order.histories.installment", "order.histories.legacy", "customers.get"],
};

/** Every exposed read operation answers with an empty but well-formed envelope. */
function emptyReadHandlers(): Record<string, FixtureHandler> {
  return Object.fromEntries(listReadOperations().map((op) => [op.operationId, () => envelope({})]));
}

interface WireSetup {
  principal?: AuthPrincipal;
  sessions?: QasirSessionProvider;
  handlers?: Record<string, FixtureHandler>;
}

interface ToolWireResult {
  isError?: boolean;
  content: Array<{ type: string; text: string }>;
  structuredContent?: Record<string, unknown>;
}

/** tools/call through the production server factory behind the Agents SDK handler. */
async function callTool(name: string, args: Record<string, unknown>, setup: WireSetup = {}) {
  // mutationsEnabled: the fake would even serve writes, so only the tools themselves keep dispatch read-only.
  const dispatcher: FakeDispatcher = createFakeDispatcher(setup.handlers ?? emptyReadHandlers(), { mutationsEnabled: true });
  const handler = createMcpHandler(
    () =>
      createManujujayaServer({
        env: testEnv({ LOADER: createFakeWorkerLoader() }),
        sessions: setup.sessions ?? fakeSessions(),
        principal: setup.principal ?? readPrincipal,
        readDoc: async () => null,
        dispatcher,
        widgetHtml: TEST_WIDGET_HTML,
        now: () => NOW,
      }),
    { route: "/mcp", legacy: "reject" },
  );
  const wire = await readWire(await handler.fetch(rpcRequest("tools/call", { name, arguments: args })));
  expect(wire.body.error, name).toBeUndefined();
  const result = wire.body.result as unknown as ToolWireResult;
  const text = result.content[0]?.text ?? "";
  return { wire, result, text, dispatcher };
}

function errorBody(text: string): Record<string, unknown> {
  return JSON.parse(text) as Record<string, unknown>;
}

const TOOL_NAMES = ALL_WIDGET_TOOLS.map((def) => def.name);

describe("widget tool inventory", () => {
  it("covers every contract tool once, each with a bounded request budget", () => {
    expect([...TOOL_NAMES].sort()).toEqual([...WIDGET_TOOL_NAMES].sort());
    expect(Object.keys(VALID_ARGS).sort()).toEqual([...TOOL_NAMES].sort());
    for (const def of ALL_WIDGET_TOOLS) {
      expect(def.maxRequests, def.name).toBeGreaterThan(0);
      expect(def.maxRequests, def.name).toBeLessThanOrEqual(45);
    }
  });

  it("every allowed operation is a registered, exposed read operation", () => {
    for (const [tool, ops] of Object.entries(ALLOWED_OPS)) {
      for (const id of ops) {
        const op = getOperation(id);
        expect(op, `${tool} → ${id}`).toBeDefined();
        expect(op!.exposed).toBe(true);
        expect(op!.safety).toBe("read");
      }
    }
  });
});

describe("scope enforcement", () => {
  it.each(TOOL_NAMES)("%s without qasir:read returns FORBIDDEN JSON and dispatches nothing", async (name) => {
    const { result, text, dispatcher } = await callTool(name, VALID_ARGS[name], { principal: NO_SCOPES });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(errorBody(text)).toEqual({ code: "FORBIDDEN", message: "Missing scope qasir:read" });
    expect(dispatcher.calls).toHaveLength(0);
  });
});

describe("read-only dispatch", () => {
  it.each(TOOL_NAMES)("%s dispatches only its own read operations, never with allowMutation", async (name) => {
    const { dispatcher } = await callTool(name, VALID_ARGS[name]);
    expect(dispatcher.calls.length, name).toBeGreaterThan(0);
    for (const { req, opts } of dispatcher.calls) {
      expect(ALLOWED_OPS[name], `${name} dispatched ${req.operationId}`).toContain(req.operationId);
      expect(getOperation(req.operationId)?.safety).toBe("read");
      expect(opts?.allowMutation).toBeUndefined();
    }
  });
});

describe("input bounds through the wire", () => {
  const schemaViolations: Array<[ToolName, Record<string, unknown>]> = [
    ["show_sales_dashboard", { start_date: "01-09-2026", end_date: "2026-09-07" }],
    ["show_transactions", { start_date: "2026-09-01", end_date: "2026-13-01" }],
    ["product_ranking_page", { start_date: "2026-09-01", end_date: "2026-09-07", order: "terlaris", page: 501 }],
    ["product_ranking_page", { start_date: "2026-09-01", end_date: "2026-09-07", order: "terlaris", page: 0 }],
    ["transactions_page", { start_date: "2026-09-01", end_date: "2026-09-07", page: 1.5 }],
    ["show_product_ranking", { start_date: "2026-09-01", end_date: "2026-09-07", order: "terbaik" }],
    ["stock_page", { search: "   ", page: 1 }],
    ["stock_page", { search: "x".repeat(101), page: 1 }],
    ["stock_history", { inventory_id: -1, page: 1 }],
    ["stock_velocity", { inventory_id: 2 ** 53 }],
    ["order_detail", { sales_id: "1001" }],
    ["show_purchase_orders", { status: "draft" }],
    ["purchase_order_items", { purchase_id: "../1" }],
    ["show_customer_debts", { outlet_id: "0645203" }],
    ["show_customer_debts", { outlet_id: "1234567890123" }],
    ["customer_debt_detail", {}],
  ];

  it.each(schemaViolations)("%s rejects %j as an input validation error without dispatching", async (name, args) => {
    const { result, text, dispatcher } = await callTool(name, args);
    expect(result.isError).toBe(true);
    expect(text).toMatch(/^Input validation error/);
    expect(dispatcher.calls).toHaveLength(0);
  });

  const rangeViolations: Array<[ToolName, Record<string, unknown>]> = [
    ["show_sales_dashboard", { start_date: "2025-09-14", end_date: "2026-09-15" }],
    ["show_product_ranking", { start_date: "2026-09-08", end_date: "2026-09-07" }],
    ["product_ranking_page", { start_date: "2025-01-01", end_date: "2026-09-15", order: "terlaris", page: 1 }],
    ["show_transactions", { start_date: "2026-09-15", end_date: "2026-09-01" }],
    ["transactions_page", { start_date: "2025-09-14", end_date: "2026-09-15", page: 1 }],
  ];

  it.each(rangeViolations)("%s rejects the reversed or over-366-day range %j with INVALID_INPUT", async (name, args) => {
    const { result, text, dispatcher } = await callTool(name, args);
    expect(result.isError).toBe(true);
    const code = text.startsWith("Input validation error") ? ErrorCodes.INVALID_INPUT : errorBody(text).code;
    expect(code).toBe(ErrorCodes.INVALID_INPUT);
    expect(dispatcher.calls).toHaveLength(0);
  });
});

describe("error surface", () => {
  const failing = (err: unknown): Record<string, FixtureHandler> => ({
    ...emptyReadHandlers(),
    "order.histories.legacy": () => {
      throw err;
    },
  });

  it("an upstream AppError reaches the client as code and message only", async () => {
    const err = new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream 500", { details: { body: "secret-upstream-detail" } });
    const { result, text } = await callTool("order_detail", { sales_id: 1001 }, { handlers: failing(err) });
    expect(result.isError).toBe(true);
    expect(errorBody(text)).toEqual({ code: "UPSTREAM_ERROR", message: "Upstream 500" });
    expect(text).not.toContain("secret-upstream-detail");
  });

  it("an unexpected exception is replaced by a generic message", async () => {
    const { text } = await callTool("order_detail", { sales_id: 1001 }, { handlers: failing(new Error("boom at /internal/secret-path")) });
    expect(errorBody(text)).toEqual({ code: "UPSTREAM_ERROR", message: "Internal error while running the tool" });
  });

  it("QASIR_AUTH_EXPIRED adds only the Connect URL", async () => {
    const err = new AppError(ErrorCodes.QASIR_AUTH_EXPIRED, "Qasir session expired");
    const { text } = await callTool("order_detail", { sales_id: 1001 }, { handlers: failing(err) });
    expect(errorBody(text)).toEqual({
      code: "QASIR_AUTH_EXPIRED",
      message: "Qasir session expired",
      connect_url: "https://mcp.example.test/connect",
    });
  });
});

describe("credentials never leave the host", () => {
  const API_TOKEN = "TOKEN-must-never-reach-widget-output-0000";
  const CSRF = "CSRF-must-never-reach-widget-output";
  const COOKIE = "qasir_sess=COOKIE-must-never-reach-widget-output";
  const secretSessions: QasirSessionProvider = {
    getSession: async () => ({
      merchantSlug: MERCHANT_SLUG,
      merchantOrigin: `https://${MERCHANT_SLUG}.qasir.id`,
      defaultOutletId: "645203",
      secrets: { apiToken: API_TOKEN, csrfToken: CSRF, cookie: COOKIE },
    }),
    markExpired: () => undefined,
  };

  it.each(TOOL_NAMES)("%s output contains no session secrets", async (name) => {
    const { wire } = await callTool(name, VALID_ARGS[name], { sessions: secretSessions });
    const body = JSON.stringify(wire.body);
    for (const secret of [API_TOKEN, CSRF, "COOKIE-must-never"]) expect(body).not.toContain(secret);
  });
});
```

- [ ] **Step 2: Update the wire protocol test**

These assertions change:
- the tool list becomes search, execute plus 15 widget tools
- description rules are split by tool family
- the resource count arithmetic now includes 6 `ui://` views
- "reads every listed resource" checks the MCP App mime type
- new cases cover `ENABLE_WIDGETS=false`, `resources/read` of each view, the default bundle, and an unknown `ui://` URI

Replace the entire contents of `tests/protocol/mcp-wire.test.ts` with:

```ts
import { createMcpHandler } from "agents/mcp/server";
import { describe, expect, it } from "vitest";
import type { AuthPrincipal } from "../../src/auth/verify";
import { createManujujayaServer } from "../../src/mcp/server";
import { DOC_NAMES } from "../../src/mcp/resources";
import { WIDGET_HTML } from "../../src/widgets/bundled";
import { APP_TOOL, MCP_APP_MIME_TYPE, VIEW_MARKER, VIEW_TOOL, VIEWS, viewResourceUri } from "../../src/widgets/contract";
import { renderViewHtml } from "../../src/widgets/resources";
import {
  createApprovalsHarness,
  createFakeDispatcher,
  readPrincipal,
  testEnv,
  unusedSessions,
  writePrincipal,
} from "../stubs/codemode-harness";
import { createFakeWorkerLoader } from "../stubs/fake-worker-loader";
import { MODERN_VERSION, readWire, rpcMessage, rpcRequest, type WireOptions } from "../stubs/mcp-wire";

interface Setup {
  mutations?: boolean;
  principal?: AuthPrincipal;
  /** ENABLE_WIDGETS; omitted means the env var is unset (widgets on). */
  widgets?: boolean;
  /** Serve the committed WIDGET_HTML instead of the tiny test page. */
  bundledHtml?: boolean;
}

/** Stand-in for the SPA bundle: the ui:// views only need the data-view marker. */
const TEST_WIDGET_HTML = `<!doctype html><html><head><title>widget</title></head><body><div id="root" data-view="${VIEW_MARKER}"></div></body></html>`;
const WIDGET_TOOL_ORDER = [...VIEWS.map((view) => VIEW_TOOL[view]), ...Object.values(APP_TOOL)];

/** The production server factory behind the Agents SDK stateless handler, legacy rejected. */
function handlerFor(setup: Setup = {}) {
  const approvals = createApprovalsHarness();
  return createMcpHandler(
    () =>
      createManujujayaServer({
        env: testEnv({
          LOADER: createFakeWorkerLoader(),
          ENABLE_MUTATIONS: setup.mutations ? "true" : "false",
          ...(setup.widgets === undefined ? {} : { ENABLE_WIDGETS: setup.widgets ? "true" : "false" }),
        }),
        sessions: unusedSessions,
        principal: setup.principal ?? readPrincipal,
        readDoc: async (name) => `# ${name}\n\nSample phone 081234567890.`,
        dispatcher: createFakeDispatcher({}),
        approvals: approvals.stub,
        ...(setup.bundledHtml ? {} : { widgetHtml: TEST_WIDGET_HTML }),
      }),
    { route: "/mcp", legacy: "reject" },
  );
}

async function call(method: string, params: Record<string, unknown> = {}, options: WireOptions = {}, setup: Setup = {}) {
  return readWire(await handlerFor(setup).fetch(rpcRequest(method, params, options)));
}

type ToolInfo = {
  name: string;
  title?: string;
  description?: string;
  annotations?: Record<string, unknown>;
  inputSchema: { required?: string[] };
  outputSchema?: unknown;
  _meta?: Record<string, unknown>;
};

describe("2026-07-28 negotiation", () => {
  it("server/discover advertises only 2026-07-28 and no list-changed notifications", async () => {
    const res = await call("server/discover");
    expect(res.status).toBe(200);
    const result = res.body.result!;
    expect(result.supportedVersions).toEqual([MODERN_VERSION]);
    expect(result.capabilities).toEqual({
      tools: { listChanged: false },
      resources: { listChanged: false },
      prompts: { listChanged: false },
    });
    expect(result._meta).toMatchObject({
      "io.modelcontextprotocol/serverInfo": { name: "manujujaya-mcp-test", version: "0.0.0-test" },
    });
  });

  it("rejects an unsupported protocol version with -32022", async () => {
    const res = await call("tools/list", {}, { version: "2025-06-18" });
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe(-32022);
    expect(res.body.error?.data).toMatchObject({ supported: [MODERN_VERSION], requested: "2025-06-18" });
  });

  it("rejects a legacy initialize handshake", async () => {
    const res = await call(
      "initialize",
      { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "legacy", version: "1" } },
      { bare: true },
    );
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe(-32022);
  });

  it("serves stateless Streamable HTTP: POST only, no session id, independent requests", async () => {
    const handler = handlerFor();
    const get = await handler.fetch(new Request("http://localhost/mcp", { method: "GET", headers: { host: "localhost", accept: "text/event-stream" } }));
    expect(get.status).toBe(405);
    const first = await handler.fetch(rpcRequest("tools/list"));
    expect(first.status).toBe(200);
    expect(first.headers.get("mcp-session-id")).toBeNull();
    // A second request with no session state from the first is served normally.
    const second = await readWire(await handler.fetch(rpcRequest("prompts/list", {}, { id: 2 })));
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(2);
  });

  it("rejects JSON-RPC batches", async () => {
    const request = new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        host: "localhost",
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": MODERN_VERSION,
        "mcp-method": "tools/list",
      },
      body: JSON.stringify([rpcMessage("tools/list", {}, { id: 1 }), rpcMessage("prompts/list", {}, { id: 2 })]),
    });
    const res = await readWire(await handlerFor().fetch(request));
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe(-32600);
  });
});

describe("tools", () => {
  it("read-only callers see search and execute with read-only annotations, then the widget tools", async () => {
    const tools = (await call("tools/list")).body.result!.tools as ToolInfo[];
    expect(tools.map((t) => t.name)).toEqual(["search", "execute", ...WIDGET_TOOL_ORDER]);
    const [search, execute] = tools;
    expect(search!.title).toBeTruthy();
    expect(search!.annotations).toEqual({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
    expect(execute!.annotations).toEqual({ readOnlyHint: true, destructiveHint: false, openWorldHint: true });
    for (const tool of [search!, execute!]) {
      expect(tool.description!.length).toBeLessThanOrEqual(600);
      expect(tool.description).toContain("Qasir POS dashboard API");
      expect(tool.description).toContain("Example:");
      expect(tool.inputSchema.required).toEqual(["code"]);
    }
  });

  it("view tools link their ui:// view and app-only tools are hidden from the model", async () => {
    const tools = (await call("tools/list")).body.result!.tools as ToolInfo[];
    const byName = new Map(tools.map((t) => [t.name, t]));
    const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
    for (const view of VIEWS) {
      const tool = byName.get(VIEW_TOOL[view])!;
      expect(tool.title, tool.name).toBeTruthy();
      expect(tool.description!.startsWith("Open an interactive"), tool.name).toBe(true);
      expect(tool.description!.length, tool.name).toBeLessThanOrEqual(600);
      expect(tool._meta).toEqual({ ui: { resourceUri: viewResourceUri(view) }, "ui/resourceUri": viewResourceUri(view) });
      expect(tool.annotations).toEqual(readOnly);
      expect(tool.outputSchema).toBeUndefined();
    }
    for (const name of Object.values(APP_TOOL)) {
      const tool = byName.get(name)!;
      expect(tool.title, name).toBeTruthy();
      expect(tool.description!.startsWith("Widget helper:"), name).toBe(true);
      expect(tool.description!.length, name).toBeLessThanOrEqual(300);
      expect(tool._meta).toEqual({ ui: { visibility: ["app"] } });
      expect(tool.annotations).toEqual(readOnly);
      expect(tool.outputSchema).toBeUndefined();
    }
  });

  it("ENABLE_WIDGETS=false serves only search and execute", async () => {
    const tools = (await call("tools/list", {}, {}, { widgets: false })).body.result!.tools as ToolInfo[];
    expect(tools.map((t) => t.name)).toEqual(["search", "execute"]);
    const res = await call("tools/call", { name: "show_customer_debts", arguments: {} }, {}, { widgets: false });
    expect(res.body.error?.code).toBe(-32602);
  });

  it("execute_mutation is listed only with ENABLE_MUTATIONS=true and qasir:write", async () => {
    const names = async (setup: Setup) =>
      ((await call("tools/list", {}, {}, setup)).body.result!.tools as ToolInfo[]).map((t) => t.name);
    expect(await names({ mutations: false, principal: writePrincipal })).not.toContain("execute_mutation");
    expect(await names({ mutations: true, principal: readPrincipal })).not.toContain("execute_mutation");
    const tools = (await call("tools/list", {}, {}, { mutations: true, principal: writePrincipal })).body.result!.tools as ToolInfo[];
    const mutation = tools.find((t) => t.name === "execute_mutation");
    expect(mutation?.annotations).toEqual({ readOnlyHint: false, destructiveHint: true, openWorldHint: true });
    expect(mutation?.description!.length).toBeLessThanOrEqual(600);
    expect(mutation?.inputSchema.required).toEqual(["operationId"]);
  });

  it("calling an unregistered execute_mutation is a protocol error", async () => {
    const res = await call("tools/call", { name: "execute_mutation", arguments: { operationId: "purchases.cancel" } });
    expect(res.body.error?.code).toBe(-32602);
  });

  it("tools/call search runs the sandbox and returns one text block", async () => {
    const res = await call("tools/call", {
      name: "search",
      arguments: { code: "async () => (await codemode.spec()).catalog.find(o => o.operationId === 'products.list').safety" },
    });
    expect(res.body.result?.content).toEqual([{ type: "text", text: "read" }]);
    expect(res.body.result?.isError).toBeUndefined();
  });

  it("tool errors come back as isError results with a typed code", async () => {
    const res = await call("tools/call", {
      name: "execute",
      arguments: { code: "async () => codemode.request({ operationId: 'purchases.cancel', path: { id: 1 } })" },
    });
    expect(res.body.result?.isError).toBe(true);
    const content = res.body.result?.content as Array<{ text: string }>;
    expect(JSON.parse(content[0]!.text)).toMatchObject({ code: "MUTATION_DISABLED" });
  });
});

describe("resources", () => {
  it("lists the static resources, every document from the template and the six ui:// views", async () => {
    const resources = (await call("resources/list")).body.result!.resources as Array<{
      uri: string;
      name: string;
      mimeType?: string;
      _meta?: Record<string, unknown>;
    }>;
    const uris = resources.map((r) => r.uri);
    expect(uris).toEqual(
      expect.arrayContaining(["qasir://docs/index", "qasir://openapi", "qasir://capabilities", "qasir://coverage"]),
    );
    for (const name of DOC_NAMES) expect(uris).toContain(`qasir://docs/${name}`);
    for (const view of VIEWS) {
      const listed = resources.find((r) => r.uri === viewResourceUri(view));
      expect(listed, view).toMatchObject({ name: `view-${view}`, mimeType: MCP_APP_MIME_TYPE, _meta: { ui: { prefersBorder: true } } });
    }
    expect(uris).toHaveLength(4 + DOC_NAMES.length + VIEWS.length);
  });

  it("ENABLE_WIDGETS=false lists no ui:// resources", async () => {
    const resources = (await call("resources/list", {}, {}, { widgets: false })).body.result!.resources as Array<{ uri: string }>;
    expect(resources.filter((r) => r.uri.startsWith("ui://"))).toEqual([]);
    expect(resources).toHaveLength(4 + DOC_NAMES.length);
  });

  it("lists the qasir://docs/{document} template", async () => {
    const templates = (await call("resources/templates/list")).body.result!.resourceTemplates as Array<{ uriTemplate: string }>;
    expect(templates.map((t) => t.uriTemplate)).toEqual(["qasir://docs/{document}"]);
  });

  it("reads every listed resource", async () => {
    const resources = (await call("resources/list")).body.result!.resources as Array<{ uri: string }>;
    for (const { uri } of resources) {
      const res = await call("resources/read", { uri });
      expect(res.body.error, uri).toBeUndefined();
      const contents = res.body.result!.contents as Array<{ uri: string; text: string; mimeType?: string }>;
      expect(contents).toHaveLength(1);
      expect(contents[0]!.uri).toBe(uri);
      expect(contents[0]!.text.length).toBeGreaterThan(0);
      if (uri.startsWith("ui://")) expect(contents[0]!.mimeType, uri).toBe(MCP_APP_MIME_TYPE);
      if (uri.startsWith("qasir://docs/") && uri !== "qasir://docs/index") {
        expect(contents[0]!.text).not.toContain("081234567890");
      }
    }
  });

  it("reads each ui:// view as MCP App HTML carrying its own data-view", async () => {
    for (const view of VIEWS) {
      const uri = viewResourceUri(view);
      const res = await call("resources/read", { uri });
      expect(res.body.error, uri).toBeUndefined();
      const result = res.body.result!;
      const contents = result.contents as Array<{ uri: string; mimeType: string; text: string; _meta?: Record<string, unknown> }>;
      expect(contents).toEqual([
        {
          uri,
          mimeType: MCP_APP_MIME_TYPE,
          text: TEST_WIDGET_HTML.replace(VIEW_MARKER, view),
          _meta: { ui: { prefersBorder: true } },
        },
      ]);
      expect(contents[0]!.text).toContain(`data-view="${view}"`);
      expect(result.ttlMs).toBe(600_000);
    }
  });

  it("serves the committed widget bundle when no HTML is injected", async () => {
    const res = await call("resources/read", { uri: viewResourceUri("piutang") }, {}, { bundledHtml: true });
    const contents = res.body.result!.contents as Array<{ text: string }>;
    expect(contents[0]!.text).toBe(renderViewHtml(WIDGET_HTML, "piutang"));
    expect(contents[0]!.text).not.toContain(VIEW_MARKER);
  });

  it("returns resource-not-found for unknown documents", async () => {
    for (const uri of ["qasir://docs/nope", "qasir://docs/..%2Fsecrets", "qasir://unknown", "ui://manujujaya/unknown.html"]) {
      const res = await call("resources/read", { uri });
      expect(res.body.error?.code, uri).toBe(-32602);
      expect(res.body.error?.data).toEqual({ uri });
    }
  });
});

describe("prompts", () => {
  it("lists the three prompts with argument requirements", async () => {
    const prompts = (await call("prompts/list")).body.result!.prompts as Array<{
      name: string;
      arguments: Array<{ name: string; required: boolean }>;
    }>;
    expect(prompts.map((p) => p.name)).toEqual(["sales_overview", "trace_stock_movement", "review_purchase_orders"]);
    expect(prompts[2]!.arguments).toEqual([expect.objectContaining({ name: "page", required: false })]);
    expect(prompts[0]!.arguments.filter((a) => a.required).map((a) => a.name)).toEqual(["start_date", "end_date"]);
  });

  it("gets review_purchase_orders with no arguments object at all", async () => {
    const res = await call("prompts/get", { name: "review_purchase_orders" });
    expect(res.body.error).toBeUndefined();
    const messages = res.body.result!.messages as Array<{ content: { text: string } }>;
    expect(messages[0]!.content.text).toContain("page=1");
  });

  it("gets prompts with arguments and rejects missing required ones", async () => {
    const ok = await call("prompts/get", { name: "sales_overview", arguments: { start_date: "2026-09-01", end_date: "2026-09-07" } });
    expect((ok.body.result!.messages as Array<{ content: { text: string } }>)[0]!.content.text).toContain("2026-09-01");
    const trace = await call("prompts/get", { name: "trace_stock_movement", arguments: { inventory_id: "25950360" } });
    expect(trace.body.error).toBeUndefined();
    const missing = await call("prompts/get", { name: "sales_overview", arguments: {} });
    expect(missing.body.error?.code).toBe(-32602);
  });
});
```

- [ ] **Step 3: Update the capabilities test**

Replace the entire contents of `tests/protocol/capabilities.test.ts` with:

```ts
import { createMcpHandler } from "agents/mcp/server";
import { describe, expect, it } from "vitest";
import type { AuthPrincipal } from "../../src/auth/verify";
import { createManujujayaServer } from "../../src/mcp/server";
import { listExposedOperations } from "../../src/registry/operations";
import { APP_TOOL, VIEW_MARKER, VIEW_TOOL, VIEWS, viewResourceUri } from "../../src/widgets/contract";
import {
  createApprovalsHarness,
  createFakeDispatcher,
  readPrincipal,
  testEnv,
  unusedSessions,
  writePrincipal,
} from "../stubs/codemode-harness";
import { createFakeWorkerLoader } from "../stubs/fake-worker-loader";
import { readWire, rpcRequest } from "../stubs/mcp-wire";

const WIDGET_TOOLS = [...VIEWS.map((view) => VIEW_TOOL[view]), ...Object.values(APP_TOOL)];

/** qasir://capabilities must describe what this caller actually gets, not a hard-coded list. */
async function capabilities(opts: { mutations: boolean; principal: AuthPrincipal; approvals?: boolean; widgets?: boolean }) {
  const handler = createMcpHandler(
    () =>
      createManujujayaServer({
        env: testEnv({
          LOADER: createFakeWorkerLoader(),
          ENABLE_MUTATIONS: opts.mutations ? "true" : "false",
          ENABLE_WIDGETS: opts.widgets === false ? "false" : "true",
        }),
        sessions: unusedSessions,
        principal: opts.principal,
        readDoc: async () => null,
        dispatcher: createFakeDispatcher({}),
        approvals: opts.approvals === false ? undefined : createApprovalsHarness().stub,
        widgetHtml: `<div data-view="${VIEW_MARKER}"></div>`,
      }),
    { route: "/mcp", legacy: "reject" },
  );
  const res = await readWire(await handler.fetch(rpcRequest("resources/read", { uri: "qasir://capabilities" })));
  const contents = res.body.result!.contents as Array<{ text: string }>;
  return JSON.parse(contents[0]!.text) as {
    protocol: string;
    tools: string[];
    operations: { exposed: number };
    mutations: { enabled: boolean; toolAvailable: boolean };
    codeMode: { maxRequests: number; maxConcurrency: number; timeoutMs: number };
    widgets: { enabled: boolean; views: string[]; resourceUris: string[] };
  };
}

describe("qasir://capabilities", () => {
  it("read-only production default: no mutation tool, mutations disabled", async () => {
    const caps = await capabilities({ mutations: false, principal: writePrincipal });
    expect(caps.protocol).toBe("2026-07-28");
    expect(caps.tools).toEqual(["search", "execute", ...WIDGET_TOOLS]);
    expect(caps.mutations).toMatchObject({ enabled: false, toolAvailable: false });
    expect(caps.operations.exposed).toBe(listExposedOperations().length);
    expect(caps.codeMode).toMatchObject({ maxRequests: 50, maxConcurrency: 4, timeoutMs: 30_000 });
  });

  it("mutations enabled but caller lacks qasir:write: tool not offered", async () => {
    const caps = await capabilities({ mutations: true, principal: readPrincipal });
    expect(caps.tools).toEqual(["search", "execute", ...WIDGET_TOOLS]);
    expect(caps.mutations).toMatchObject({ enabled: true, toolAvailable: false });
  });

  it("mutations enabled without an approvals binding: tool not offered", async () => {
    const caps = await capabilities({ mutations: true, principal: writePrincipal, approvals: false });
    expect(caps.tools).toEqual(["search", "execute", ...WIDGET_TOOLS]);
  });

  it("mutations enabled for a writer: execute_mutation is listed", async () => {
    const caps = await capabilities({ mutations: true, principal: writePrincipal });
    expect(caps.tools).toEqual(["search", "execute", "execute_mutation", ...WIDGET_TOOLS]);
    expect(caps.mutations).toMatchObject({ enabled: true, toolAvailable: true });
  });

  it("lists the widget views and their ui:// resources", async () => {
    const caps = await capabilities({ mutations: false, principal: readPrincipal });
    expect(caps.widgets).toEqual({ enabled: true, views: [...VIEWS], resourceUris: VIEWS.map(viewResourceUri) });
  });

  it("ENABLE_WIDGETS=false: no widget tools or views", async () => {
    const caps = await capabilities({ mutations: false, principal: readPrincipal, widgets: false });
    expect(caps.tools).toEqual(["search", "execute"]);
    expect(caps.widgets).toEqual({ enabled: false, views: [], resourceUris: [] });
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `bun run test tests/security/widget-tools.test.ts tests/protocol/mcp-wire.test.ts tests/protocol/capabilities.test.ts`
Expected: FAIL.
- `tests/security/widget-tools.test.ts`: `Error: Cannot find module '../../src/widgets/tools' imported from …`
- `tests/protocol/mcp-wire.test.ts`: `Error: Cannot find module '../../src/widgets/resources' imported from …`
- `tests/protocol/capabilities.test.ts`: 6 failed, e.g. `AssertionError: expected [ 'search', 'execute' ] to deeply equal [ 'search', 'execute', …(15) ]`

- [ ] **Step 5: Create `src/widgets/tools/index.ts`**

```ts
import type { McpServer } from "@modelcontextprotocol/server";
import { APP_TOOL, VIEW_TOOL, VIEWS } from "../contract";
import { DEBT_TOOLS } from "./debts";
import { registerWidgetTool, type AnyWidgetToolDef, type WidgetToolDeps } from "./define";
import { PURCHASE_TOOLS } from "./purchases";
import { SALES_TOOLS } from "./sales";
import { STOCK_TOOLS } from "./stock";
import { TRANSACTION_TOOLS } from "./transactions";

const BY_NAME = new Map<string, AnyWidgetToolDef>(
  [...SALES_TOOLS, ...STOCK_TOOLS, ...PURCHASE_TOOLS, ...TRANSACTION_TOOLS, ...DEBT_TOOLS].map((def) => [def.name, def]),
);

/** Every widget tool: the six view tools in VIEWS order, then the app-only tools in APP_TOOL order. */
export const ALL_WIDGET_TOOLS: readonly AnyWidgetToolDef[] = [
  ...VIEWS.map((view) => VIEW_TOOL[view]),
  ...Object.values(APP_TOOL),
].map((name) => {
  const def = BY_NAME.get(name);
  if (!def) throw new Error(`Widget tool ${name} has no definition`);
  return def;
});

/** Register all widget tools on `server`; returns their names in registration order. */
export function registerWidgetTools(server: McpServer, deps: WidgetToolDeps): string[] {
  for (const def of ALL_WIDGET_TOOLS) registerWidgetTool(server, deps, def);
  return ALL_WIDGET_TOOLS.map((def) => def.name);
}
```

- [ ] **Step 6: Create `src/widgets/resources.ts`**

```ts
import type { McpServer } from "@modelcontextprotocol/server";
import { MCP_APP_MIME_TYPE, VIEW_MARKER, VIEWS, viewResourceUri, type ViewName } from "./contract";

/** Hosts may reuse a view's HTML for this long; the HTML holds no data, only the SPA. */
export const WIDGET_RESOURCE_TTL_MS = 600_000;

const VIEW_RESOURCE_LABEL: Record<ViewName, string> = {
  penjualan: "Penjualan",
  produk: "Produk",
  stok: "Stok",
  pembelian: "Pembelian",
  transaksi: "Transaksi",
  piutang: "Piutang",
};

/** The SPA HTML with its `data-view` marker set to `view`. */
export function renderViewHtml(html: string, view: ViewName): string {
  return html.replaceAll(VIEW_MARKER, view);
}

/**
 * Six static ui:// resources sharing one HTML string. Rendering happens at read
 * time so the per-request server factory never copies the bundle six times.
 */
export function registerWidgetResources(server: McpServer, html: string): void {
  for (const view of VIEWS) {
    const uri = viewResourceUri(view);
    server.registerResource(
      `view-${view}`,
      uri,
      {
        title: `Tampilan ${VIEW_RESOURCE_LABEL[view]}`,
        description: `Interactive ${VIEW_RESOURCE_LABEL[view]} view (MCP App) for the manujujaya widget tools`,
        mimeType: MCP_APP_MIME_TYPE,
        _meta: { ui: { prefersBorder: true } },
      },
      async () => ({
        contents: [{ uri, mimeType: MCP_APP_MIME_TYPE, text: renderViewHtml(html, view), _meta: { ui: { prefersBorder: true } } }],
        ttlMs: WIDGET_RESOURCE_TTL_MS,
      }),
    );
  }
}
```

- [ ] **Step 7: Wire widgets into `src/mcp/server.ts`**

Replace:

```ts
import type { QasirSessionProvider } from "../session/types";
import { EXECUTE_MUTATION_TOOL, executeMutationInput, runExecuteMutation } from "./mutation-tool";
```

with:

```ts
import type { QasirSessionProvider } from "../session/types";
import { WIDGET_HTML } from "../widgets/bundled";
import { registerWidgetResources } from "../widgets/resources";
import { registerWidgetTools } from "../widgets/tools";
import { EXECUTE_MUTATION_TOOL, executeMutationInput, runExecuteMutation } from "./mutation-tool";
```

Replace:

```ts
  /** Overrides for Code Mode limits (tests). */
  limits?: Partial<CodemodeLimits>;
}
```

with:

```ts
  /** Overrides for Code Mode limits (tests). */
  limits?: Partial<CodemodeLimits>;
  /** MCP App SPA served by the ui:// views; defaults to the committed bundle (tests pass a tiny page). */
  widgetHtml?: string;
  /** Clock for widget tools (tests). */
  now?: () => Date;
}
```

Replace:

```ts
  registerResources(server, {
    merchantSlug,
    readDoc: deps.readDoc,
    capabilities: { tools, mutationsEnabled, limits },
  });
```

with:

```ts
  // MCP App views: registered for every caller (client UI support is only known per request, after
  // this factory runs); ENABLE_WIDGETS=false switches them off. Every tool also returns useful text.
  const widgetsEnabled = deps.env.ENABLE_WIDGETS !== "false";
  if (widgetsEnabled) {
    tools.push(
      ...registerWidgetTools(server, {
        env: deps.env,
        principal: deps.principal,
        sessions: deps.sessions,
        dispatcher,
        ...(deps.now ? { now: deps.now } : {}),
      }),
    );
    registerWidgetResources(server, deps.widgetHtml ?? WIDGET_HTML);
  }

  registerResources(server, {
    merchantSlug,
    readDoc: deps.readDoc,
    capabilities: { tools, mutationsEnabled, limits, widgetsEnabled },
  });
```

- [ ] **Step 8: List widgets in `qasir://capabilities` (`src/mcp/resources.ts`)**

Replace:

```ts
import { sanitizeDocMarkdown } from "../observability/redact";
```

with:

```ts
import { sanitizeDocMarkdown } from "../observability/redact";
import { VIEWS, viewResourceUri } from "../widgets/contract";
```

Replace:

```ts
  mutationsEnabled: boolean;
  limits: CodemodeLimits;
}
```

with:

```ts
  mutationsEnabled: boolean;
  limits: CodemodeLimits;
  /** Whether the MCP App widget tools and ui:// views are registered (ENABLE_WIDGETS). */
  widgetsEnabled: boolean;
}
```

Replace:

```ts
      network: "none except codemode.request() by operationId",
    },
  };
```

with:

```ts
      network: "none except codemode.request() by operationId",
    },
    widgets: {
      enabled: info.widgetsEnabled,
      views: info.widgetsEnabled ? [...VIEWS] : [],
      resourceUris: info.widgetsEnabled ? VIEWS.map(viewResourceUri) : [],
    },
  };
```

- [ ] **Step 9: Add the `ENABLE_WIDGETS` var and bump the server version**

In `worker-configuration.d.ts`, replace:

```ts
  ENABLE_MUTATIONS: string;
```

with:

```ts
  ENABLE_MUTATIONS: string;
  /** "false" removes the MCP App widget tools and ui:// views; any other value (default "true") serves them. */
  ENABLE_WIDGETS: string;
```

In `wrangler.jsonc`, replace:

```jsonc
    "ENABLE_MUTATIONS": "false",
```

with:

```jsonc
    "ENABLE_MUTATIONS": "false",
    "ENABLE_WIDGETS": "true",
```

and replace:

```jsonc
    "MCP_SERVER_VERSION": "0.2.0"
```

with:

```jsonc
    "MCP_SERVER_VERSION": "0.3.0"
```

- [ ] **Step 10: Run the targeted tests, the full suite, types and a Worker dry-run build**

Run: `bun run test tests/security/widget-tools.test.ts tests/protocol/mcp-wire.test.ts tests/protocol/capabilities.test.ts`
Expected: `Tests  99 passed (99)`. That is 71 security tests, 22 wire tests and 6 capabilities tests.

Run: `bun run test && bun run check-types && bun run build`
Expected:
- every test file passes
- `tsc` exits 0
- the wrangler dry-run lists `env.ENABLE_WIDGETS ("true")` and `env.MCP_SERVER_VERSION ("0.3.0")`, then ends with `--dry-run: exiting now.`

`scripts/e2e-mcp.ts` still expects only `["execute","search"]` from a live server. T15 updates it; do not run `bun run e2e` against a deployed widget build before then.

- [ ] **Step 11: Commit**

```bash
git add src/widgets/tools/index.ts src/widgets/resources.ts src/mcp/server.ts src/mcp/resources.ts worker-configuration.d.ts wrangler.jsonc tests/security/widget-tools.test.ts tests/protocol/mcp-wire.test.ts tests/protocol/capabilities.test.ts
git commit -m "feat(widgets): register widget tools and ui:// views behind ENABLE_WIDGETS (v0.3.0)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Views Penjualan and Produk

**Files:**
- Create: `widgets/src/routes/viewHelpers.ts`
- Create: `widgets/src/routes/penjualan.tsx`
- Create: `widgets/src/routes/produk.tsx`
- Modify: `widgets/src/routes/index.ts` (register both route factories)
- Modify: `widgets/test/AppShell.test.tsx` (T8's "no routes registered" test no longer holds once a view exists)
- Modify: `src/widgets/bundled.ts` (regenerated with `bun run widgets:bundle`; T10's hash test fails on any `widgets/src` change otherwise)
- Test: `widgets/test/routes/penjualan.test.tsx`
- Test: `widgets/test/routes/produk.test.tsx`

**Interfaces:**
- Consumes:
  - T1 (`src/widgets/contract.ts`): `VIEW_TOOL`, `PRODUCT_ORDERS`, `PRODUCT_ORDER_LABEL`, `type ProductOrder`, `type ToolInput`, `type ToolOutput`, `type ToolName`, `type ViewName`.
  - T8 (`widgets/src/app/router.tsx`): `rootRoute` (type only), `createWidgetRouter(opts: { initialPath: string })`.
  - T8 (`widgets/src/app/search.ts`): `penjualanSearch`, `produkSearch`, `searchFromToolArgs(view, args, today?)`, `toolArgsFromSearch(view, search, today)`.
  - T8 (`widgets/src/app/viewPaths.ts`): `VIEW_PATH`, `VIEW_LABEL`. T8 (`widgets/src/app/queryClient.ts`): `createWidgetQueryClient()`. T8 (`widgets/src/app/AppShell.tsx`): `AppShell`.
  - T8 (`widgets/src/bridge/bridge.ts`): `BridgeContext`, `useBridge()`, `ToolCallError`, `type Bridge`, `type HostInfo`. T8 (`widgets/src/bridge/mockBridge.ts`): `createMockBridge()`. T8 (`widgets/dev/fixtures.ts`): `FIXTURES`.
  - T8 (`widgets/src/bridge/useToolQuery.ts`): `useToolQuery(name, args, options?)`, `useMorePages({ tool, args, startPage, rowsOf, enabled? })` (manual: nothing loads until `loadMore()`).
  - T8 (`widgets/src/lib/dates.ts`): `PRESET_LABEL`, `presetRange`, `jakartaTodayBrowser`, `type PresetKey`. T8 (`widgets/src/lib/format.ts`): `formatRupiah`, `formatNumber`, `formatPercent`, `formatDate`, `formatTime`.
  - T9 (`widgets/src/components/*`): `ViewFrame({ title, subtitle?, actions?, children })`, `PresetRangePicker({ value: { preset, start_date, end_date }, onChange })`, `KpiTile({ label, value, change?, hint? })`, `TrendChart({ points: { date, amount, comparisonAmount }[], onSelectDate? })`, `BarList({ items: { key, label, value, valueLabel, onSelect? }[], emptyText })`, `ChipGroup({ options, value, onChange, multiple? })`, `DataTable({ rows, columns: ColumnDef<Row>[], getRowId, onRowClick?, emptyText, footer? })` with `type ColumnDef` exported from `DataTable.tsx`, `LoadMoreFooter({ hasMore, isFetching, onLoadMore, loadedLabel })`, `ErrorPanel({ error, onRetry? })`, `EmptyState({ title, body? })`, `Skeleton({ rows?, note? })`.
  - T10: `bun run widgets:bundle` (writes `src/widgets/bundled.ts`), `tests/unit/widgets-bundle.test.ts`.
- Produces:
  - `widgets/src/routes/viewHelpers.ts` (T13 imports these):
    - `function viewSubtitle(meta: { outlet_id: string; generated_at: string }): string` ("Outlet 645203 · Diperbarui 10.32")
    - `function rangeLabel(range: { start_date: string; end_date: string }): string`
    - `function presetFor(range: { start_date: string; end_date: string }, today: string): PresetKey`
    - `function modelContextText(view: ViewName, args: Record<string, unknown>): string`
    - `function useModelContext(view: ViewName, args: Record<string, unknown>): void` (calls `bridge.updateContext` only when `bridge.host.canUpdateContext`)
  - `widgets/src/routes/penjualan.tsx`: `function penjualanRoute(root: typeof rootRoute): AnyRoute`; `function salesQuestion(data: ToolOutput<"show_sales_dashboard">): string`
  - `widgets/src/routes/produk.tsx`: `function produkRoute(root: typeof rootRoute): AnyRoute`
  - `VIEW_ROUTES` after this task: `[penjualanRoute, produkRoute]`

Rules these views follow (T13 and T14 follow the same ones):
- **Route factories.** Each factory calls `createRoute({ getParentRoute: () => root, path: VIEW_PATH[view], validateSearch: <view>Search, component })`. The page component reads `useSearch({ strict: false })`.
- **Tool arguments.** They are always `toolArgsFromSearch(view, search, jakartaTodayBrowser())`, used unchanged as the `useToolQuery` arguments. That is the same key `AppShell` primes with the host's tool result, so the opening call is never repeated.
- **Navigation.** Every navigation, within a view or across views, goes through `navigate({ to: VIEW_PATH[target], search: searchFromToolArgs(target, toolArgs, today) })`. No route hard-codes another view's search field names. `outlet_id` is carried along when present.
- **Cross-links (spec §3.3 and §5).** In Penjualan, a chart day opens Transaksi for that day, the receivable tile opens Piutang, the "Lihat peringkat produk" link beside "Produk terlaris" opens Produk for the same range, and a top product opens Stok searching its name. In Produk, a ranking row opens Stok searching its name. Search text is cut to 100 characters, the contract's `searchInput` bound.
- **Paging.** Page tools take the view's `start_date`/`end_date`/`order`/`outlet_id` from the tool arguments and `startPage = data.next_page`.
- **Styling.** Class names use T8's tokens only (`text-fg-muted`, `border-line`, `bg-surface`, `text-info`, `text-danger`).
- **Host features.** `sendMessage` only when `bridge.host.canSendMessage`, and `updateContext` only when `bridge.host.canUpdateContext`. The message and context text carry the range, filters and KPIs, never customer data.
- **Tests.** They drive a real router (`createWidgetRouter`) with a spy bridge that delegates to `createMockBridge()`, and derive expected values from `FIXTURES`. They assert cross-view navigation through `router.state.location` plus `toolArgsFromSearch`, so they keep passing once T13/T14 register the target views. DataTable renders the rows that fit in `maxHeight` before measuring (T9), so stubbing `offsetHeight`/`offsetWidth` is optional; the stubs in these tests only make the virtualizer measure. Every route test file has a `QASIR_AUTH_EXPIRED` reconnect-panel test (spec §7). Produk, Stok and Pembelian also check one other error code each (`INVALID_INPUT`, `QASIR_RATE_LIMITED`, `FORBIDDEN`).

- [ ] **Step 1: Write the failing Penjualan test**

`widgets/test/routes/penjualan.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolInput, ToolName } from "../../../src/widgets/contract";
import { createWidgetQueryClient } from "../../src/app/queryClient";
import { createWidgetRouter } from "../../src/app/router";
import { searchFromToolArgs, toolArgsFromSearch } from "../../src/app/search";
import { VIEW_PATH } from "../../src/app/viewPaths";
import { BridgeContext, ToolCallError, type Bridge, type HostInfo } from "../../src/bridge/bridge";
import { createMockBridge } from "../../src/bridge/mockBridge";
import { formatDate, formatRupiah } from "../../src/lib/format";
import { FIXTURES } from "../../dev/fixtures";

// The real chart is covered by component tests; here each point is a plain button.
vi.mock("../../src/components/TrendChart", async () => {
  const { createElement } = await import("react");
  return {
    TrendChart: (props: { points: Array<{ date: string }>; onSelectDate?: (date: string) => void }) =>
      createElement(
        "div",
        null,
        props.points.map((point) =>
          createElement("button", { key: point.date, type: "button", onClick: () => props.onSelectDate?.(point.date) }, `Titik ${point.date}`),
        ),
      ),
  };
});

const TODAY = "2026-09-15";
const ARGS = { start_date: "2026-09-01", end_date: "2026-09-10" };

/** Testing Library collapses whitespace (including the NBSP Intl puts after "Rp"). */
function norm(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function pathFor(view: "penjualan", args: Record<string, unknown>): string {
  const search = searchFromToolArgs(view, args, TODAY);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) params.set(key, typeof value === "string" ? value : JSON.stringify(value));
  const query = params.toString();
  return query === "" ? VIEW_PATH[view] : `${VIEW_PATH[view]}?${query}`;
}

function makeBridge(options: { host?: Partial<HostInfo>; fail?: ToolCallError } = {}) {
  const mock = createMockBridge();
  const callTool = vi.fn((name: ToolName, args: unknown, signal?: AbortSignal): Promise<unknown> =>
    options.fail ? Promise.reject(options.fail) : mock.callTool(name, args as ToolInput<ToolName>, signal),
  );
  const spies = {
    callTool,
    openLink: vi.fn(async (_url: string) => {}),
    sendMessage: vi.fn(async (_text: string) => {}),
    updateContext: vi.fn(async (_text: string) => {}),
    toggleFullscreen: vi.fn(async () => {}),
  };
  const bridge: Bridge = {
    ...spies,
    host: { ...mock.host, canFullscreen: false, canSendMessage: false, canUpdateContext: false, ...options.host },
    callTool: callTool as unknown as Bridge["callTool"],
  };
  return { bridge, ...spies };
}

function renderView(path: string, bridge: Bridge) {
  const router = createWidgetRouter({ initialPath: path });
  const utils = render(
    <BridgeContext.Provider value={bridge}>
      <QueryClientProvider client={createWidgetQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </BridgeContext.Provider>,
  );
  return { ...utils, router };
}

describe("Penjualan view", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-15T03:00:00Z")); // 10:00 in Jakarta
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("loads the dashboard for the requested range and renders KPIs and lists without a <form>", async () => {
    const { bridge, callTool } = makeBridge();
    const fixture = FIXTURES.show_sales_dashboard(ARGS);
    const { container } = renderView(pathFor("penjualan", ARGS), bridge);

    expect(await screen.findByText("Penjualan kotor")).toBeTruthy();
    expect(callTool).toHaveBeenCalledWith("show_sales_dashboard", ARGS, expect.anything());
    expect(screen.getAllByText(norm(formatRupiah(fixture.kpis.gross_sales))).length).toBeGreaterThan(0);
    expect(screen.getByText("Laba kotor")).toBeTruthy();
    expect(screen.getByText("Rata-rata per transaksi")).toBeTruthy();
    expect(screen.getByText("Sisa piutang (laporan Qasir)")).toBeTruthy();
    expect(screen.getByText("Metode pembayaran")).toBeTruthy();
    expect(screen.getByText(fixture.top_products[0]!.name)).toBeTruthy();
    expect(screen.getByText(fixture.categories[0]!.name)).toBeTruthy();
    expect(container.querySelector("form")).toBeNull();
  });

  it("re-queries the dashboard when a preset is chosen", async () => {
    const { bridge, callTool } = makeBridge();
    renderView(pathFor("penjualan", ARGS), bridge);
    await screen.findByText("Penjualan kotor");

    fireEvent.click(screen.getByRole("button", { name: "Kemarin" }));

    await waitFor(() =>
      expect(callTool).toHaveBeenCalledWith("show_sales_dashboard", { start_date: "2026-09-14", end_date: "2026-09-14" }, expect.anything()),
    );
  });

  it("opens Transaksi for the chart day that was clicked", async () => {
    const { bridge } = makeBridge();
    const { router } = renderView(pathFor("penjualan", ARGS), bridge);

    fireEvent.click(await screen.findByRole("button", { name: "Titik 2026-09-03" }));

    await waitFor(() => expect(router.state.location.pathname).toBe(VIEW_PATH.transaksi));
    const args = toolArgsFromSearch("transaksi", router.state.location.search as Record<string, unknown>, TODAY);
    expect(args.start_date).toBe("2026-09-03");
    expect(args.end_date).toBe("2026-09-03");
  });

  it("links the receivable tile to Piutang, the ranking link to Produk and a top product to Stok", async () => {
    const { bridge } = makeBridge();
    const fixture = FIXTURES.show_sales_dashboard(ARGS);
    const first = renderView(pathFor("penjualan", ARGS), bridge);

    fireEvent.click(await screen.findByRole("button", { name: /buka tampilan Piutang/ }));
    await waitFor(() => expect(first.router.state.location.pathname).toBe(VIEW_PATH.piutang));
    cleanup();

    const second = renderView(pathFor("penjualan", ARGS), bridge);
    fireEvent.click(await screen.findByRole("button", { name: "Lihat peringkat produk" }));
    await waitFor(() => expect(second.router.state.location.pathname).toBe(VIEW_PATH.produk));
    const produkArgs = toolArgsFromSearch("produk", second.router.state.location.search as Record<string, unknown>, TODAY);
    expect(produkArgs).toMatchObject({ ...ARGS, order: "terlaris" });
    cleanup();

    const third = renderView(pathFor("penjualan", ARGS), bridge);
    fireEvent.click(await screen.findByText(fixture.top_products[0]!.name));
    await waitFor(() => expect(third.router.state.location.pathname).toBe(VIEW_PATH.stok));
    const stokArgs = toolArgsFromSearch("stok", third.router.state.location.search as Record<string, unknown>, TODAY);
    expect(stokArgs.search).toBe(fixture.top_products[0]!.name);
  });

  it("offers 'Tanya Claude tentang periode ini' only when the host accepts messages", async () => {
    const hidden = makeBridge({ host: { canSendMessage: false } });
    renderView(pathFor("penjualan", ARGS), hidden.bridge);
    await screen.findByText("Penjualan kotor");
    expect(screen.queryByRole("button", { name: "Tanya Claude tentang periode ini" })).toBeNull();
    cleanup();

    const shown = makeBridge({ host: { canSendMessage: true } });
    const fixture = FIXTURES.show_sales_dashboard(ARGS);
    renderView(pathFor("penjualan", ARGS), shown.bridge);
    fireEvent.click(await screen.findByRole("button", { name: "Tanya Claude tentang periode ini" }));

    await waitFor(() => expect(shown.sendMessage).toHaveBeenCalledTimes(1));
    const message = norm(shown.sendMessage.mock.calls[0]![0]);
    expect(message).toContain(norm(formatDate("2026-09-01")));
    expect(message).toContain(norm(formatDate("2026-09-10")));
    expect(message).toContain(norm(formatRupiah(fixture.kpis.gross_sales)));
    expect(await screen.findByText("Pertanyaan dikirim ke Claude.")).toBeTruthy();
  });

  it("updates the model context with the view and filters when the host supports it", async () => {
    const off = makeBridge({ host: { canUpdateContext: false } });
    renderView(pathFor("penjualan", ARGS), off.bridge);
    await screen.findByText("Penjualan kotor");
    expect(off.updateContext).not.toHaveBeenCalled();
    cleanup();

    const on = makeBridge({ host: { canUpdateContext: true } });
    renderView(pathFor("penjualan", ARGS), on.bridge);
    await waitFor(() => expect(on.updateContext).toHaveBeenCalled());
    const text = on.updateContext.mock.calls.at(-1)![0];
    expect(text).toContain("penjualan");
    expect(text).toContain("start_date=2026-09-01");
    expect(text).toContain("end_date=2026-09-10");
  });

  it("shows the reconnect panel when the Qasir session expired", async () => {
    const connectUrl = "https://mcp.example.test/connect";
    const { bridge, openLink } = makeBridge({
      fail: new ToolCallError({ code: "QASIR_AUTH_EXPIRED", message: "expired", connect_url: connectUrl }),
    });
    renderView(pathFor("penjualan", ARGS), bridge);

    expect(await screen.findByText("Sesi Qasir sudah berakhir. Pemilik perlu menghubungkan ulang.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Buka halaman Connect" }));
    expect(openLink).toHaveBeenCalledWith(connectUrl);
    expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run widgets:test widgets/test/routes/penjualan.test.tsx`
Expected: FAIL, 7 failed. No route is registered yet, so the router renders "Tampilan belum tersedia" and the tests stop at `TestingLibraryElementError: Unable to find an element with the text: Penjualan kotor` (or `Unable to find role="button" and name "Titik 2026-09-03"`).

- [ ] **Step 3: Implement the shared view helpers**

`widgets/src/routes/viewHelpers.ts`:

```ts
/** Small helpers shared by the view routes (Tasks 12–13). DOM-free except for the React hook. */
import { useEffect } from "react";
import type { ViewName } from "../../../src/widgets/contract";
import { VIEW_LABEL } from "../app/viewPaths";
import { useBridge } from "../bridge/bridge";
import { PRESET_LABEL, presetRange, type PresetKey } from "../lib/dates";
import { formatDate, formatTime } from "../lib/format";

/** "Outlet 645203 · Diperbarui 10.32" (Asia/Jakarta clock). */
export function viewSubtitle(meta: { outlet_id: string; generated_at: string }): string {
  const time = formatTime(meta.generated_at);
  return time === "—" ? `Outlet ${meta.outlet_id}` : `Outlet ${meta.outlet_id} · Diperbarui ${time}`;
}

/** "9 Sep 2026 – 15 Sep 2026", or one date when start = end. */
export function rangeLabel(range: { start_date: string; end_date: string }): string {
  return range.start_date === range.end_date
    ? formatDate(range.start_date)
    : `${formatDate(range.start_date)} – ${formatDate(range.end_date)}`;
}

const RANGE_PRESETS = (Object.keys(PRESET_LABEL) as PresetKey[]).filter(
  (key): key is Exclude<PresetKey, "custom"> => key !== "custom",
);

/** The preset chip matching start..end as of today, else "custom". */
export function presetFor(range: { start_date: string; end_date: string }, today: string): PresetKey {
  for (const key of RANGE_PRESETS) {
    const candidate = presetRange(key, today);
    if (candidate.start_date === range.start_date && candidate.end_date === range.end_date) return key;
  }
  return "custom";
}

/** One line for updateModelContext: view name plus filter values (never names, phones or amounts). */
export function modelContextText(view: ViewName, args: Record<string, unknown>): string {
  const filters = Object.entries(args)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(", ");
  return `Pengguna membuka tampilan ${VIEW_LABEL[view]} (${view}) di widget Manujujaya. Filter: ${filters === "" ? "bawaan" : filters}.`;
}

/** Tells the host which view and filters are on screen, when the host supports it. */
export function useModelContext(view: ViewName, args: Record<string, unknown>): void {
  const bridge = useBridge();
  const text = modelContextText(view, args);
  useEffect(() => {
    if (!bridge.host.canUpdateContext) return;
    bridge.updateContext(text).catch(() => undefined);
  }, [bridge, text]);
}
```

- [ ] **Step 4: Implement the Penjualan route**

`widgets/src/routes/penjualan.tsx`:

```tsx
import { createRoute, useNavigate, useSearch, type AnyRoute } from "@tanstack/react-router";
import { useState } from "react";
import { VIEW_TOOL, type ToolInput, type ToolOutput } from "../../../src/widgets/contract";
import type { rootRoute } from "../app/router";
import { penjualanSearch, searchFromToolArgs, toolArgsFromSearch } from "../app/search";
import { VIEW_PATH } from "../app/viewPaths";
import { useBridge } from "../bridge/bridge";
import { useToolQuery } from "../bridge/useToolQuery";
import { BarList } from "../components/BarList";
import { EmptyState } from "../components/EmptyState";
import { ErrorPanel } from "../components/ErrorPanel";
import { KpiTile } from "../components/KpiTile";
import { PresetRangePicker } from "../components/PresetRangePicker";
import { Skeleton } from "../components/Skeleton";
import { TrendChart } from "../components/TrendChart";
import { ViewFrame } from "../components/ViewFrame";
import { jakartaTodayBrowser } from "../lib/dates";
import { formatNumber, formatPercent, formatRupiah } from "../lib/format";
import { presetFor, rangeLabel, useModelContext, viewSubtitle } from "./viewHelpers";

type SalesArgs = ToolInput<"show_sales_dashboard">;
type SalesData = ToolOutput<"show_sales_dashboard">;
type Change = SalesData["changes"]["gross"];

function changeText(label: string, change: Change): string {
  if (change.percent === null || change.direction === null) return `${label} tanpa pembanding`;
  return `${label} ${change.direction === "up" ? "naik" : "turun"} ${formatPercent(change.percent)}`;
}

/** Prompt for "Tanya Claude tentang periode ini": range and KPIs only, no customer data. */
export function salesQuestion(data: SalesData): string {
  const { kpis, changes } = data;
  return [
    `Tolong analisis penjualan outlet ${data.outlet_id} untuk periode ${rangeLabel(data.range)}`,
    `(dibandingkan dengan ${rangeLabel(data.comparison)}).`,
    `Penjualan kotor ${formatRupiah(kpis.gross_sales)} (${changeText("penjualan", changes.gross)}),`,
    `laba kotor ${formatRupiah(kpis.profit)} (${changeText("laba", changes.profit)}),`,
    `${formatNumber(kpis.transactions, 0)} transaksi (${changeText("transaksi", changes.transactions)}),`,
    `rata-rata ${formatRupiah(kpis.average_ticket)} per transaksi,`,
    `diskon ${formatRupiah(kpis.discount)}.`,
    "Apa yang menonjol dan apa yang sebaiknya saya perhatikan?",
  ].join(" ");
}

function PenjualanPage() {
  const bridge = useBridge();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const today = jakartaTodayBrowser();
  const args = toolArgsFromSearch("penjualan", search, today) as SalesArgs;
  const query = useToolQuery(VIEW_TOOL.penjualan, args);
  const [askState, setAskState] = useState<"idle" | "sent" | "failed">("idle");
  useModelContext("penjualan", args);

  const data = query.data;
  const range = { start_date: args.start_date, end_date: args.end_date };

  function goTo(view: "penjualan" | "produk" | "stok" | "transaksi" | "piutang", toolArgs: Record<string, unknown>) {
    void navigate({ to: VIEW_PATH[view], search: searchFromToolArgs(view, toolArgs, today) });
  }
  const outlet = args.outlet_id === undefined ? {} : { outlet_id: args.outlet_id };

  function ask(current: SalesData) {
    setAskState("idle");
    bridge.sendMessage(salesQuestion(current)).then(
      () => setAskState("sent"),
      () => setAskState("failed"),
    );
  }

  return (
    <ViewFrame
      title="Penjualan"
      subtitle={data ? `${viewSubtitle(data)} · ${rangeLabel(data.range)}` : rangeLabel(range)}
      actions={
        data && bridge.host.canSendMessage ? (
          <button
            type="button"
            className="inline-flex min-h-9 items-center rounded-md border border-line bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-muted"
            onClick={() => ask(data)}
          >
            Tanya Claude tentang periode ini
          </button>
        ) : null
      }
    >
      <PresetRangePicker
        value={{ preset: presetFor(range, today), ...range }}
        onChange={(next) => goTo("penjualan", { ...outlet, start_date: next.start_date, end_date: next.end_date })}
      />
      {askState === "sent" ? <p role="status" className="text-xs text-fg-muted">Pertanyaan dikirim ke Claude.</p> : null}
      {askState === "failed" ? <p role="alert" className="text-xs text-danger">Pesan gagal dikirim. Coba lagi.</p> : null}

      {query.isPending ? (
        <Skeleton rows={6} />
      ) : query.isError ? (
        <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />
      ) : data ? (
        <>
          <section aria-label="Ringkasan" className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <KpiTile label="Penjualan kotor" value={formatRupiah(data.kpis.gross_sales)} change={data.changes.gross} />
            <KpiTile label="Laba kotor" value={formatRupiah(data.kpis.profit)} change={data.changes.profit} />
            <KpiTile label="Transaksi" value={formatNumber(data.kpis.transactions, 0)} change={data.changes.transactions} />
            <KpiTile
              label="Rata-rata per transaksi"
              value={formatRupiah(data.kpis.average_ticket)}
              hint={`${formatNumber(data.kpis.quantity)} item terjual`}
            />
            <button
              type="button"
              className="rounded-lg text-left"
              aria-label={`Sisa piutang ${formatRupiah(data.receivable.total)}, buka tampilan Piutang`}
              onClick={() => goTo("piutang", outlet)}
            >
              <KpiTile
                label="Sisa piutang (laporan Qasir)"
                value={formatRupiah(data.receivable.total)}
                hint={`${formatNumber(data.receivable.customers, 0)} pelanggan · Lihat piutang`}
              />
            </button>
          </section>

          <section aria-labelledby="penjualan-tren" className="space-y-1">
            <h2 id="penjualan-tren" className="text-sm font-semibold">
              Tren penjualan
            </h2>
            <p className="text-xs text-fg-muted">
              Dibandingkan dengan {rangeLabel(data.comparison)}. Pilih satu hari untuk melihat transaksinya.
            </p>
            {data.trend.length === 0 ? (
              <EmptyState title="Belum ada penjualan pada periode ini" />
            ) : (
              <TrendChart
                points={data.trend.map((point) => ({
                  date: point.date,
                  amount: point.amount,
                  comparisonAmount: point.comparison_amount,
                }))}
                onSelectDate={(date) => goTo("transaksi", { ...outlet, start_date: date, end_date: date })}
              />
            )}
          </section>

          <div className="grid gap-4 md:grid-cols-3">
            <section aria-labelledby="penjualan-metode" className="space-y-1">
              <h2 id="penjualan-metode" className="text-sm font-semibold">
                Metode pembayaran
              </h2>
              <BarList
                emptyText="Belum ada pembayaran"
                items={data.payment_methods.map((method) => ({
                  key: method.name,
                  label: `${method.name} (${formatNumber(method.quantity, 0)})`,
                  value: method.amount,
                  valueLabel: formatRupiah(method.amount),
                }))}
              />
            </section>
            <section aria-labelledby="penjualan-kategori" className="space-y-1">
              <h2 id="penjualan-kategori" className="text-sm font-semibold">
                Kategori teratas
              </h2>
              <BarList
                emptyText="Belum ada kategori terjual"
                items={data.categories.map((category) => ({
                  key: String(category.id),
                  label: category.name,
                  value: category.gross,
                  valueLabel: formatRupiah(category.gross),
                }))}
              />
            </section>
            <section aria-labelledby="penjualan-produk" className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <h2 id="penjualan-produk" className="text-sm font-semibold">
                  Produk terlaris
                </h2>
                <button
                  type="button"
                  className="text-xs text-info underline"
                  onClick={() => goTo("produk", { ...outlet, ...range, order: "terlaris" })}
                >
                  Lihat peringkat produk
                </button>
              </div>
              <p className="text-xs text-fg-muted">Pilih produk untuk melihat stoknya.</p>
              <BarList
                emptyText="Belum ada produk terjual"
                items={data.top_products.map((product) => ({
                  key: String(product.id),
                  label: product.name,
                  value: product.quantity,
                  valueLabel: `${formatNumber(product.quantity)} ${product.unit}`.trim(),
                  onSelect: () => goTo("stok", { ...outlet, search: product.name.slice(0, 100) }),
                }))}
              />
            </section>
          </div>
        </>
      ) : null}
    </ViewFrame>
  );
}

export function penjualanRoute(root: typeof rootRoute): AnyRoute {
  return createRoute({
    getParentRoute: () => root,
    path: VIEW_PATH.penjualan,
    validateSearch: penjualanSearch,
    component: PenjualanPage,
  });
}
```

- [ ] **Step 5: Register the route and update the shell test**

`widgets/src/routes/index.ts` (replace the whole file):

```ts
import type { AnyRoute } from "@tanstack/react-router";
import type { rootRoute } from "../app/router";
import { penjualanRoute } from "./penjualan";

/**
 * Route factories, one per view. Each receives the root route and returns
 * createRoute({ getParentRoute: () => root, path: VIEW_PATH[view], validateSearch, component }).
 * Tasks 12–14 append their factories here.
 */
export const VIEW_ROUTES: Array<(root: typeof rootRoute) => AnyRoute> = [penjualanRoute];
```

T8's first AppShell test asserts `VIEW_ROUTES` is empty, which is no longer true. In `widgets/test/AppShell.test.tsx`, replace:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "../src/app/AppShell";
import { createWidgetRouter } from "../src/app/router";
import { createMockBridge } from "../src/bridge/mockBridge";
import { VIEW_ROUTES } from "../src/routes";
```

with:

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "../src/app/AppShell";
import { createWidgetQueryClient } from "../src/app/queryClient";
import { createWidgetRouter } from "../src/app/router";
import { toolArgsFromSearch } from "../src/app/search";
import { BridgeContext } from "../src/bridge/bridge";
import { createMockBridge } from "../src/bridge/mockBridge";
import { jakartaTodayBrowser } from "../src/lib/dates";
```

and replace:

```tsx
  it("renders the not-found panel while no view routes are registered", async () => {
    expect(VIEW_ROUTES).toHaveLength(0);
    const bridge = createMockBridge();
    const { container } = render(<AppShell view="stok" bridge={bridge} />);
    expect(await screen.findByText("Tampilan belum tersedia")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(container.querySelector("form")).toBeNull();
    expect(bridge.calls).toEqual([]);
  });
```

with:

```tsx
  it("opens a registered view with its default filters", async () => {
    const bridge = createMockBridge();
    const { container } = render(<AppShell view="penjualan" bridge={bridge} />);
    expect(await screen.findByText("Penjualan kotor")).toBeTruthy();
    await waitFor(() => expect(bridge.calls.length).toBeGreaterThan(0));
    expect(bridge.calls[0]).toEqual({
      name: "show_sales_dashboard",
      args: toolArgsFromSearch("penjualan", {}, jakartaTodayBrowser()),
    });
    expect(container.querySelector("form")).toBeNull();
  });

  it("renders the not-found panel for an unknown path", async () => {
    const bridge = createMockBridge();
    const router = createWidgetRouter({ initialPath: "/tidak-ada" });
    const { container } = render(
      <BridgeContext.Provider value={bridge}>
        <QueryClientProvider client={createWidgetQueryClient()}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </BridgeContext.Provider>,
    );
    expect(await screen.findByText("Tampilan belum tersedia")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(container.querySelector("form")).toBeNull();
    expect(bridge.calls).toEqual([]);
  });
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun run widgets:test widgets/test/routes/penjualan.test.tsx widgets/test/AppShell.test.tsx`
Expected: PASS (2 files, 10 tests).

- [ ] **Step 7: Write the failing Produk test**

`widgets/test/routes/produk.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolInput, ToolName, ViewName } from "../../../src/widgets/contract";
import { createWidgetQueryClient } from "../../src/app/queryClient";
import { createWidgetRouter } from "../../src/app/router";
import { searchFromToolArgs, toolArgsFromSearch } from "../../src/app/search";
import { VIEW_PATH } from "../../src/app/viewPaths";
import { BridgeContext, ToolCallError, type Bridge, type HostInfo } from "../../src/bridge/bridge";
import { createMockBridge } from "../../src/bridge/mockBridge";
import { FIXTURES } from "../../dev/fixtures";

const TODAY = "2026-09-15";
const ARGS = { start_date: "2026-09-01", end_date: "2026-09-10", order: "terlaris" } as const;

/**
 * Optional: DataTable already renders the rows that fit in maxHeight before measuring (T9).
 * happy-dom has no layout, so this stub only gives the virtualizer a size to measure.
 */
const LAYOUT_PROPS = ["offsetHeight", "offsetWidth"] as const;
const originalLayout = LAYOUT_PROPS.map((prop) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop));
beforeAll(() => {
  for (const prop of LAYOUT_PROPS) {
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => (prop === "offsetHeight" ? 600 : 800) });
  }
});
afterAll(() => {
  LAYOUT_PROPS.forEach((prop, i) => {
    const descriptor = originalLayout[i];
    if (descriptor) Object.defineProperty(HTMLElement.prototype, prop, descriptor);
    else Reflect.deleteProperty(HTMLElement.prototype, prop);
  });
});

function pathFor(view: ViewName, args: Record<string, unknown>): string {
  const search = searchFromToolArgs(view, args, TODAY);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) params.set(key, typeof value === "string" ? value : JSON.stringify(value));
  const query = params.toString();
  return query === "" ? VIEW_PATH[view] : `${VIEW_PATH[view]}?${query}`;
}

function makeBridge(options: { host?: Partial<HostInfo>; fail?: ToolCallError } = {}) {
  const mock = createMockBridge();
  const callTool = vi.fn((name: ToolName, args: unknown, signal?: AbortSignal): Promise<unknown> =>
    options.fail ? Promise.reject(options.fail) : mock.callTool(name, args as ToolInput<ToolName>, signal),
  );
  const spies = {
    callTool,
    openLink: vi.fn(async (_url: string) => {}),
    sendMessage: vi.fn(async (_text: string) => {}),
    updateContext: vi.fn(async (_text: string) => {}),
    toggleFullscreen: vi.fn(async () => {}),
  };
  const bridge: Bridge = {
    ...spies,
    host: { ...mock.host, canFullscreen: false, canSendMessage: false, canUpdateContext: false, ...options.host },
    callTool: callTool as unknown as Bridge["callTool"],
  };
  return { bridge, ...spies };
}

function renderView(path: string, bridge: Bridge) {
  const router = createWidgetRouter({ initialPath: path });
  const utils = render(
    <BridgeContext.Provider value={bridge}>
      <QueryClientProvider client={createWidgetQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </BridgeContext.Provider>,
  );
  return { ...utils, router };
}

describe("Produk view", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-15T03:00:00Z"));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders the ranking, categories and manual-transaction line without a <form>", async () => {
    const { bridge, callTool } = makeBridge();
    const fixture = FIXTURES.show_product_ranking(ARGS);
    const { container } = renderView(pathFor("produk", ARGS), bridge);

    expect(await screen.findByText(fixture.rows[0]!.name)).toBeTruthy();
    expect(callTool).toHaveBeenCalledWith("show_product_ranking", ARGS, expect.anything());
    for (const header of ["Peringkat", "Produk", "Kategori", "Terjual", "Omzet"]) {
      expect(screen.getAllByText(header).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("Omzet per kategori")).toBeTruthy();
    expect(screen.getAllByText(fixture.categories[0]!.name).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Transaksi manual \(tanpa produk\)/) !== null).toBe(fixture.manual_transactions !== null);
    expect(screen.getByText(`${fixture.rows.length} produk dimuat`)).toBeTruthy();
    expect(container.querySelector("form")).toBeNull();
  });

  it("re-queries with the chosen order", async () => {
    const { bridge, callTool } = makeBridge();
    renderView(pathFor("produk", ARGS), bridge);
    await screen.findByText(FIXTURES.show_product_ranking(ARGS).rows[0]!.name);

    fireEvent.click(screen.getByRole("button", { name: /^Kurang laris/ }));

    await waitFor(() =>
      expect(callTool).toHaveBeenCalledWith("show_product_ranking", { ...ARGS, order: "kurang_laris" }, expect.anything()),
    );
  });

  it("loads the next ranking page through product_ranking_page", async () => {
    const { bridge, callTool } = makeBridge();
    const fixture = FIXTURES.show_product_ranking(ARGS);
    expect(fixture.next_page).not.toBeNull();
    const nextPage = FIXTURES.product_ranking_page({ ...ARGS, page: fixture.next_page! });
    renderView(pathFor("produk", ARGS), bridge);

    fireEvent.click(await screen.findByRole("button", { name: "Muat lebih banyak" }));

    await waitFor(() =>
      expect(callTool).toHaveBeenCalledWith("product_ranking_page", { ...ARGS, page: fixture.next_page }, expect.anything()),
    );
    expect(await screen.findByText(`${fixture.rows.length + nextPage.rows.length} produk dimuat`)).toBeTruthy();
  });

  it("opens Stok searching for the clicked product", async () => {
    const { bridge } = makeBridge();
    const fixture = FIXTURES.show_product_ranking(ARGS);
    const { router } = renderView(pathFor("produk", ARGS), bridge);

    fireEvent.click(await screen.findByText(fixture.rows[0]!.name));

    await waitFor(() => expect(router.state.location.pathname).toBe(VIEW_PATH.stok));
    const args = toolArgsFromSearch("stok", router.state.location.search as Record<string, unknown>, TODAY);
    expect(args.search).toBe(fixture.rows[0]!.name);
  });

  it("updates the model context with the view, range and order", async () => {
    const { bridge, updateContext } = makeBridge({ host: { canUpdateContext: true } });
    renderView(pathFor("produk", ARGS), bridge);

    await waitFor(() => expect(updateContext).toHaveBeenCalled());
    const text = updateContext.mock.calls.at(-1)![0];
    expect(text).toContain("produk");
    expect(text).toContain("order=terlaris");
    expect(text).toContain("start_date=2026-09-01");
  });

  it("shows the error panel with a retry for invalid filters", async () => {
    const { bridge, callTool } = makeBridge({ fail: new ToolCallError({ code: "INVALID_INPUT", message: "bad" }) });
    renderView(pathFor("produk", ARGS), bridge);

    expect(await screen.findByText("Filter tidak valid.")).toBeTruthy();
    const calls = callTool.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
    await waitFor(() => expect(callTool.mock.calls.length).toBeGreaterThan(calls));
  });

  it("shows the reconnect panel without retrying when the Qasir session expired", async () => {
    const connectUrl = "https://mcp.example.test/connect";
    const { bridge, callTool, openLink } = makeBridge({
      fail: new ToolCallError({ code: "QASIR_AUTH_EXPIRED", message: "expired", connect_url: connectUrl }),
    });
    renderView(pathFor("produk", ARGS), bridge);

    expect(await screen.findByText("Sesi Qasir sudah berakhir. Pemilik perlu menghubungkan ulang.")).toBeTruthy();
    expect(callTool).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Buka halaman Connect" }));
    expect(openLink).toHaveBeenCalledWith(connectUrl);
    expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `bun run widgets:test widgets/test/routes/produk.test.tsx`
Expected: FAIL, 7 failed. `/produk` is not registered: `TestingLibraryElementError: Unable to find an element with the text: Produk 1` (the first `FIXTURES.show_product_ranking` row), `Unable to find role="button" and name "Muat lebih banyak"`, `Unable to find an element with the text: Sesi Qasir sudah berakhir. Pemilik perlu menghubungkan ulang.`, and `expected "vi.fn()" to be called at least once` for the model-context test.

- [ ] **Step 9: Implement the Produk route**

`widgets/src/routes/produk.tsx`:

```tsx
import { createRoute, useNavigate, useSearch, type AnyRoute } from "@tanstack/react-router";
import {
  PRODUCT_ORDERS,
  PRODUCT_ORDER_LABEL,
  VIEW_TOOL,
  type ProductOrder,
  type ToolInput,
  type ToolOutput,
} from "../../../src/widgets/contract";
import type { rootRoute } from "../app/router";
import { produkSearch, searchFromToolArgs, toolArgsFromSearch } from "../app/search";
import { VIEW_PATH } from "../app/viewPaths";
import { useMorePages, useToolQuery } from "../bridge/useToolQuery";
import { BarList } from "../components/BarList";
import { ChipGroup } from "../components/ChipGroup";
import { DataTable, type ColumnDef } from "../components/DataTable";
import { ErrorPanel } from "../components/ErrorPanel";
import { LoadMoreFooter } from "../components/LoadMoreFooter";
import { PresetRangePicker } from "../components/PresetRangePicker";
import { Skeleton } from "../components/Skeleton";
import { ViewFrame } from "../components/ViewFrame";
import { jakartaTodayBrowser } from "../lib/dates";
import { formatNumber, formatRupiah } from "../lib/format";
import { presetFor, rangeLabel, useModelContext, viewSubtitle } from "./viewHelpers";

type RankingArgs = ToolInput<"show_product_ranking">;
type RankRow = ToolOutput<"show_product_ranking">["rows"][number];

const ORDER_OPTIONS = PRODUCT_ORDERS.map((order) => ({ value: order, label: PRODUCT_ORDER_LABEL[order] }));

const COLUMNS: ColumnDef<RankRow>[] = [
  { id: "rank", header: "Peringkat", accessorFn: (row) => row.rank, cell: ({ row }) => `#${row.original.rank}` },
  {
    id: "name",
    header: "Produk",
    accessorFn: (row) => row.name,
    cell: ({ row }) => (
      <span className="block min-w-0">
        <span className="block truncate font-medium">{row.original.name}</span>
        {row.original.sku ? <span className="block truncate text-xs text-fg-muted">{row.original.sku}</span> : null}
      </span>
    ),
  },
  { id: "category", header: "Kategori", accessorFn: (row) => row.category, cell: ({ row }) => row.original.category || "—" },
  {
    id: "quantity",
    header: "Terjual",
    accessorFn: (row) => row.quantity,
    cell: ({ row }) => (
      <span className="tabular-nums">{`${formatNumber(row.original.quantity)} ${row.original.unit}`.trim()}</span>
    ),
  },
  {
    id: "gross",
    header: "Omzet",
    accessorFn: (row) => row.gross,
    cell: ({ row }) => <span className="tabular-nums">{formatRupiah(row.original.gross)}</span>,
  },
];

function ProdukPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const today = jakartaTodayBrowser();
  const args = toolArgsFromSearch("produk", search, today) as RankingArgs;
  const order: ProductOrder = args.order ?? "terlaris";
  const query = useToolQuery(VIEW_TOOL.produk, args);
  useModelContext("produk", args);

  const data = query.data;
  const range = { start_date: args.start_date, end_date: args.end_date };
  const outlet = args.outlet_id === undefined ? {} : { outlet_id: args.outlet_id };
  const more = useMorePages({
    tool: "product_ranking_page",
    args: { ...outlet, ...range, order: data?.order ?? order },
    startPage: data?.next_page ?? null,
    rowsOf: (page) => page.rows,
    enabled: query.isSuccess,
  });

  function setFilters(next: { start_date: string; end_date: string; order: ProductOrder }) {
    void navigate({ to: VIEW_PATH.produk, search: searchFromToolArgs("produk", { ...outlet, ...next }, today) });
  }

  const rows = data ? [...data.rows, ...more.rows] : [];

  return (
    <ViewFrame title="Produk" subtitle={data ? `${viewSubtitle(data)} · ${rangeLabel(data.range)}` : rangeLabel(range)}>
      <PresetRangePicker
        value={{ preset: presetFor(range, today), ...range }}
        onChange={(next) => setFilters({ start_date: next.start_date, end_date: next.end_date, order })}
      />
      <ChipGroup
        options={ORDER_OPTIONS}
        value={order}
        onChange={(next: ProductOrder) => setFilters({ ...range, order: next })}
      />

      {query.isPending ? (
        <Skeleton rows={8} />
      ) : query.isError ? (
        <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />
      ) : data ? (
        <div className="grid gap-4 md:grid-cols-3">
          <section aria-labelledby="produk-peringkat" className="space-y-2 md:col-span-2">
            <h2 id="produk-peringkat" className="text-sm font-semibold">
              Peringkat {PRODUCT_ORDER_LABEL[data.order].toLowerCase()}
            </h2>
            <p className="text-xs text-fg-muted">Pilih produk untuk melihat stoknya.</p>
            <DataTable
              rows={rows}
              columns={COLUMNS}
              getRowId={(row) => String(row.rank)}
              onRowClick={(row) =>
                void navigate({
                  to: VIEW_PATH.stok,
                  search: searchFromToolArgs("stok", { ...outlet, search: row.name.slice(0, 100) }, today),
                })
              }
              emptyText="Belum ada produk terjual pada periode ini"
              footer={
                <>
                  {more.error ? <ErrorPanel error={more.error} onRetry={more.loadMore} /> : null}
                  <LoadMoreFooter
                    hasMore={more.hasMore}
                    isFetching={more.isFetching}
                    onLoadMore={more.loadMore}
                    loadedLabel={`${formatNumber(rows.length, 0)} produk dimuat`}
                  />
                </>
              }
            />
            {data.manual_transactions ? (
              <p className="text-sm">
                Transaksi manual (tanpa produk): {formatNumber(data.manual_transactions.quantity)} item ·{" "}
                {formatRupiah(data.manual_transactions.gross)}
              </p>
            ) : null}
          </section>
          <section aria-labelledby="produk-kategori" className="space-y-2">
            <h2 id="produk-kategori" className="text-sm font-semibold">
              Omzet per kategori
            </h2>
            <BarList
              emptyText="Belum ada kategori terjual"
              items={data.categories.map((category) => ({
                key: String(category.id),
                label: category.name,
                value: category.gross,
                valueLabel: formatRupiah(category.gross),
              }))}
            />
          </section>
        </div>
      ) : null}
    </ViewFrame>
  );
}

export function produkRoute(root: typeof rootRoute): AnyRoute {
  return createRoute({
    getParentRoute: () => root,
    path: VIEW_PATH.produk,
    validateSearch: produkSearch,
    component: ProdukPage,
  });
}
```

- [ ] **Step 10: Register the Produk route**

In `widgets/src/routes/index.ts`, replace:

```ts
import { penjualanRoute } from "./penjualan";
```

with:

```ts
import { penjualanRoute } from "./penjualan";
import { produkRoute } from "./produk";
```

and replace:

```ts
export const VIEW_ROUTES: Array<(root: typeof rootRoute) => AnyRoute> = [penjualanRoute];
```

with:

```ts
export const VIEW_ROUTES: Array<(root: typeof rootRoute) => AnyRoute> = [penjualanRoute, produkRoute];
```

- [ ] **Step 11: Run every widget test and the widget types**

Run: `bun run widgets:test && bun run widgets:check-types`
Expected: every widget test file PASSES, including `routes/penjualan.test.tsx` (7) and `routes/produk.test.tsx` (7); `tsc` exits 0.

- [ ] **Step 12: Regenerate the bundle and run the Worker-side checks**

Run: `bun run widgets:bundle && bun run test tests/unit/widgets-bundle.test.ts && bun run check-types`
Expected: `Wrote src/widgets/bundled.ts (… chars, source hash …)`; the bundle test PASSES (7 tests, including "was generated from the current widget sources" and "stays under 1 MB and renders no <form>"); all three `tsc` projects exit 0.

- [ ] **Step 13: Commit**

```bash
git add widgets/src/routes/viewHelpers.ts widgets/src/routes/penjualan.tsx widgets/src/routes/produk.tsx widgets/src/routes/index.ts widgets/test/routes/penjualan.test.tsx widgets/test/routes/produk.test.tsx widgets/test/AppShell.test.tsx src/widgets/bundled.ts
git commit -m "feat(widgets): Penjualan dashboard and Produk ranking views

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

---

### Task 13: Views Stok and Pembelian

**Files:**
- Create: `widgets/src/routes/stok.tsx`
- Create: `widgets/src/routes/pembelian.tsx`
- Modify: `widgets/src/routes/index.ts` (register both route factories)
- Modify: `src/widgets/bundled.ts` (regenerated with `bun run widgets:bundle`)
- Test: `widgets/test/routes/stok.test.tsx`
- Test: `widgets/test/routes/pembelian.test.tsx`

**Interfaces:**
- Consumes:
  - T1 (`src/widgets/contract.ts`): `VIEW_TOOL`, `PO_STATUS_FILTERS`, `poStatusLabel`, `type PoStatusFilter`, `type ToolInput`, `type ToolOutput`, `type ToolName`, `type ViewName`.
  - T8: `rootRoute` (type), `createWidgetRouter`, `stokSearch`, `pembelianSearch`, `searchFromToolArgs`, `toolArgsFromSearch`, `VIEW_PATH`, `createWidgetQueryClient`, `BridgeContext`, `ToolCallError`, `type Bridge`, `type HostInfo`, `createMockBridge`, `FIXTURES`, `useToolQuery`, `useMorePages`, `daysAgoLabel`, `jakartaTodayBrowser`, `formatDateTime`, `formatNumber`, `formatRupiah`.
  - T9 (`widgets/src/components/*`): `ViewFrame`, `SearchInput({ value, onChange, placeholder, debounceMs? })` (emits the debounced text), `ChipGroup({ options, value, onChange, multiple? })`, `DataTable({ rows, columns: ColumnDef<Row>[], getRowId, onRowClick?, renderExpanded?, maxHeight?, emptyText, footer? })` + `type ColumnDef`, `LoadMoreFooter`, `Sheet({ open, title, onClose, children })`, `KpiTile`, `StatusBadge({ tone, children })`, `ErrorPanel`, `EmptyState`, `Skeleton({ rows?, note? })`.
  - T12 (`widgets/src/routes/viewHelpers.ts`): `viewSubtitle`, `useModelContext`. T12's `VIEW_ROUTES` = `[penjualanRoute, produkRoute]`.
  - T10: `bun run widgets:bundle`, `tests/unit/widgets-bundle.test.ts`.
- Produces:
  - `widgets/src/routes/stok.tsx`:
    - `function stokRoute(root: typeof rootRoute): AnyRoute`
    - `const STALE_SALE_DAYS = 90`
    - `const COLD_LOAD_NOTE = "Memuat stok, bisa sampai 15 detik"`
    - `function isOutOfStock(row): boolean`
    - `function isStale(row): boolean`
  - `widgets/src/routes/pembelian.tsx`:
    - `function pembelianRoute(root: typeof rootRoute): AnyRoute`
    - `function statusFilterLabel(status: PoStatusFilter): string`
    - `function combinedStatusCounts(serverCounts: Record<string, number>, extraRows: PurchaseRow[]): Record<string, number>`
    - `function newPagedRows(firstRows: PurchaseRow[], pagedRows: PurchaseRow[]): PurchaseRow[]` (paged rows whose `id` is not already loaded, de-duplicated among themselves), where `PurchaseRow = ToolOutput<"show_purchase_orders">["rows"][number]`
  - `VIEW_ROUTES` after this task: `[penjualanRoute, produkRoute, stokRoute, pembelianRoute]` (T14 appends `transaksiRoute`, `piutangRoute`).

Behaviour this task pins down (spec §5 Stok and Pembelian, §8 cold load):
- **Stok search.** `SearchInput` (400 ms debounce) navigates to `/stok` with `searchFromToolArgs("stok", { search })`. The route then re-queries `show_stock_browser` with `toolArgsFromSearch("stok", …)`, and an empty search drops the argument.
- **Cold load.** While loading, the skeleton note is "Memuat stok, bisa sampai 15 detik" when there is no search (upstream takes about 15 s), otherwise "Mencari stok…".
- **Stok paging.** `useMorePages({ tool: "stock_page", args: { search?, outlet_id? }, startPage: data.next_page })`. Loaded rows are de-duplicated by `inventory_id`.
- **Stok chips.** "Stok habis" (`stock <= 0`) and "Belum terjual ≥ 90 hari" (`days_since_sale === null || >= 90`; no recorded sale counts) are AND-combined filters over loaded rows only. Each chip shows its count, and the footer reads "X dari N baris dimuat" while a chip is active.
- **Stok sheet.** A row click opens a `Sheet` keyed by `inventory_id`:
  - a velocity card from `useToolQuery("stock_velocity", { inventory_id })`: "Terjual 30 hari" (net), "Stok" and "Perkiraan habis" ("Dalam N hari" / "Kurang dari 1 hari" / "Stok sudah habis" / "Belum bisa diperkirakan")
  - the movement history from `useMorePages({ tool: "stock_history", args: { inventory_id }, startPage: 1 })`, whose first `loadMore()` fires once on mount; columns Waktu, Jenis, ±Qty, Saldo, Catatan
- **Pembelian status.** Status chips (Semua · Diproses · Selesai · Dibatalkan) navigate with `searchFromToolArgs("pembelian", { status })`, which re-calls `show_purchase_orders(status)`. Chip counts are `status_counts` plus the statuses of the new paged rows (below).
- **Pembelian paging.** `useMorePages({ tool: "purchase_orders_page", args: { outlet_id? }, startPage: data.next_page })`. A PO created while paging shifts `purchases.list` (newest first), so a later page can repeat a row. `newPagedRows(data.rows, more.rows)` keeps only paged rows whose `id` is not loaded yet, and both the chip counts and M use those rows. The table shows the first rows plus the new paged rows, de-duplicated by `id` and filtered client-side by the selected status. The footer reads "N PO Selesai dari M baris dimuat", where M = `scanned_rows` + new paged rows. With a status filter, `data.rows` holds only matching rows, so a repeated row of another status still counts once more; this approximation is accepted.
- **Pembelian items.** Expanding a row renders `purchase_order_items` (Produk, Varian, Dipesan, Diterima, Harga, Subtotal, Total). It is only called for ids matching `^[1-9]\d{0,19}$` (the contract's input bound).

- [ ] **Step 1: Write the failing Stok test**

`widgets/test/routes/stok.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ToolInput, ToolName, ViewName } from "../../../src/widgets/contract";
import { createWidgetQueryClient } from "../../src/app/queryClient";
import { createWidgetRouter } from "../../src/app/router";
import { searchFromToolArgs } from "../../src/app/search";
import { VIEW_PATH } from "../../src/app/viewPaths";
import { BridgeContext, ToolCallError, type Bridge, type HostInfo } from "../../src/bridge/bridge";
import { createMockBridge } from "../../src/bridge/mockBridge";
import { formatNumber } from "../../src/lib/format";
import { FIXTURES } from "../../dev/fixtures";

/**
 * Optional: DataTable already renders the rows that fit in maxHeight before measuring (T9).
 * happy-dom has no layout, so this stub only gives the virtualizer a size to measure.
 */
const LAYOUT_PROPS = ["offsetHeight", "offsetWidth"] as const;
const originalLayout = LAYOUT_PROPS.map((prop) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop));
beforeAll(() => {
  for (const prop of LAYOUT_PROPS) {
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => (prop === "offsetHeight" ? 600 : 800) });
  }
});
afterAll(() => {
  LAYOUT_PROPS.forEach((prop, i) => {
    const descriptor = originalLayout[i];
    if (descriptor) Object.defineProperty(HTMLElement.prototype, prop, descriptor);
    else Reflect.deleteProperty(HTMLElement.prototype, prop);
  });
});

function pathFor(view: ViewName, args: Record<string, unknown>): string {
  const search = searchFromToolArgs(view, args, "2026-09-15");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) params.set(key, typeof value === "string" ? value : JSON.stringify(value));
  const query = params.toString();
  return query === "" ? VIEW_PATH[view] : `${VIEW_PATH[view]}?${query}`;
}

function makeBridge(options: { host?: Partial<HostInfo>; fail?: ToolCallError; pending?: boolean } = {}) {
  const mock = createMockBridge();
  const callTool = vi.fn((name: ToolName, args: unknown, signal?: AbortSignal): Promise<unknown> => {
    if (options.pending) return new Promise(() => {});
    if (options.fail) return Promise.reject(options.fail);
    return mock.callTool(name, args as ToolInput<ToolName>, signal);
  });
  const spies = {
    callTool,
    openLink: vi.fn(async (_url: string) => {}),
    sendMessage: vi.fn(async (_text: string) => {}),
    updateContext: vi.fn(async (_text: string) => {}),
    toggleFullscreen: vi.fn(async () => {}),
  };
  const bridge: Bridge = {
    ...spies,
    host: { ...mock.host, canFullscreen: false, canSendMessage: false, canUpdateContext: false, ...options.host },
    callTool: callTool as unknown as Bridge["callTool"],
  };
  return { bridge, ...spies };
}

function renderView(path: string, bridge: Bridge) {
  const router = createWidgetRouter({ initialPath: path });
  const utils = render(
    <BridgeContext.Provider value={bridge}>
      <QueryClientProvider client={createWidgetQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </BridgeContext.Provider>,
  );
  return { ...utils, router };
}

describe("Stok view", () => {
  afterEach(cleanup);

  it("searches by the search param and renders stock rows without a <form>", async () => {
    const { bridge, callTool } = makeBridge();
    const fixture = FIXTURES.show_stock_browser({ search: "Kopi" });
    expect(fixture.rows.length).toBeGreaterThan(0);
    const { container } = renderView(pathFor("stok", { search: "Kopi" }), bridge);

    expect(await screen.findByText(fixture.rows[0]!.name)).toBeTruthy();
    expect(callTool).toHaveBeenCalledWith("show_stock_browser", { search: "Kopi" }, expect.anything());
    for (const header of ["Produk", "Stok", "Harga jual", "Terakhir terjual", "Terakhir penyesuaian"]) {
      expect(screen.getAllByText(header).length).toBeGreaterThan(0);
    }
    expect(container.querySelector("form")).toBeNull();
  });

  it("shows the cold-load note only while loading without a search", async () => {
    const cold = makeBridge({ pending: true });
    renderView(pathFor("stok", {}), cold.bridge);
    expect(await screen.findByText("Memuat stok, bisa sampai 15 detik")).toBeTruthy();
    cleanup();

    const searching = makeBridge({ pending: true });
    renderView(pathFor("stok", { search: "Kopi" }), searching.bridge);
    await waitFor(() => expect(searching.callTool).toHaveBeenCalled());
    expect(screen.queryByText("Memuat stok, bisa sampai 15 detik")).toBeNull();
  });

  it("re-queries show_stock_browser with the debounced search text", async () => {
    const { bridge, callTool } = makeBridge();
    renderView(pathFor("stok", {}), bridge);
    await screen.findByText(FIXTURES.show_stock_browser({}).rows[0]!.name);

    fireEvent.change(screen.getByPlaceholderText("Cari nama produk"), { target: { value: "Kopi" } });

    await waitFor(() => expect(callTool).toHaveBeenCalledWith("show_stock_browser", { search: "Kopi" }, expect.anything()), {
      timeout: 3_000,
    });
  });

  it("filters loaded rows with the chips and reports 'dari N baris dimuat'", async () => {
    const { bridge } = makeBridge();
    const rows = FIXTURES.show_stock_browser({}).rows;
    const out = rows.filter((row) => row.stock <= 0);
    const outAndStale = out.filter((row) => row.days_since_sale === null || row.days_since_sale >= 90);
    renderView(pathFor("stok", {}), bridge);
    await screen.findByText(rows[0]!.name);

    fireEvent.click(screen.getByRole("button", { name: /^Stok habis/ }));
    expect(await screen.findByText(`${formatNumber(out.length, 0)} dari ${formatNumber(rows.length, 0)} baris dimuat`)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Belum terjual ≥ 90 hari/ }));
    expect(
      await screen.findByText(`${formatNumber(outAndStale.length, 0)} dari ${formatNumber(rows.length, 0)} baris dimuat`),
    ).toBeTruthy();
  });

  it("loads more rows through stock_page", async () => {
    const { bridge, callTool } = makeBridge();
    const fixture = FIXTURES.show_stock_browser({});
    expect(fixture.next_page).not.toBeNull();
    renderView(pathFor("stok", {}), bridge);

    fireEvent.click(await screen.findByRole("button", { name: "Muat lebih banyak" }));

    await waitFor(() => expect(callTool).toHaveBeenCalledWith("stock_page", { page: fixture.next_page }, expect.anything()));
  });

  it("opens a sheet with the velocity card and the paged movement history", async () => {
    const { bridge, callTool } = makeBridge();
    const row = FIXTURES.show_stock_browser({}).rows[0]!;
    const velocity = FIXTURES.stock_velocity({ inventory_id: row.inventory_id });
    const history = FIXTURES.stock_history({ inventory_id: row.inventory_id, page: 1 });
    renderView(pathFor("stok", {}), bridge);

    fireEvent.click(await screen.findByText(row.name));

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(await screen.findByText("Perkiraan habis")).toBeTruthy();
    expect(screen.getByText(`Terjual ${velocity.window_days} hari`)).toBeTruthy();
    expect(callTool).toHaveBeenCalledWith("stock_velocity", { inventory_id: row.inventory_id }, expect.anything());
    await waitFor(() =>
      expect(callTool).toHaveBeenCalledWith("stock_history", { inventory_id: row.inventory_id, page: 1 }, expect.anything()),
    );
    expect(await screen.findByText(`${formatNumber(history.movements.length, 0)} pergerakan dimuat`)).toBeTruthy();
    expect(screen.getAllByText(history.movements[0]!.type_label).length).toBeGreaterThan(0);
  });

  it("updates the model context with the search filter", async () => {
    const { bridge, updateContext } = makeBridge({ host: { canUpdateContext: true } });
    renderView(pathFor("stok", { search: "Kopi" }), bridge);

    await waitFor(() => expect(updateContext).toHaveBeenCalled());
    const text = updateContext.mock.calls.at(-1)![0];
    expect(text).toContain("stok");
    expect(text).toContain("search=Kopi");
  });

  it("shows the rate-limit message from the error panel", async () => {
    const { bridge } = makeBridge({ fail: new ToolCallError({ code: "QASIR_RATE_LIMITED", message: "slow down" }) });
    renderView(pathFor("stok", { search: "Kopi" }), bridge);

    expect(await screen.findByText("Qasir sedang membatasi permintaan. Coba lagi sebentar lagi.")).toBeTruthy();
  });

  it("shows the reconnect panel without retrying when the Qasir session expired", async () => {
    const connectUrl = "https://mcp.example.test/connect";
    const { bridge, callTool, openLink } = makeBridge({
      fail: new ToolCallError({ code: "QASIR_AUTH_EXPIRED", message: "expired", connect_url: connectUrl }),
    });
    renderView(pathFor("stok", { search: "Kopi" }), bridge);

    expect(await screen.findByText("Sesi Qasir sudah berakhir. Pemilik perlu menghubungkan ulang.")).toBeTruthy();
    expect(callTool).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Buka halaman Connect" }));
    expect(openLink).toHaveBeenCalledWith(connectUrl);
    expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run widgets:test widgets/test/routes/stok.test.tsx`
Expected: FAIL, 9 failed. `/stok` is not registered yet, so the router shows "Tampilan belum tersedia": `TestingLibraryElementError: Unable to find an element with the text: Kopi 3 - Reguler` (the first `FIXTURES.show_stock_browser({ search: "Kopi" })` row), `Unable to find an element with the text: Memuat stok, bisa sampai 15 detik`, `Unable to find role="button" and name "Muat lebih banyak"`, `Unable to find an element with the text: Sesi Qasir sudah berakhir. Pemilik perlu menghubungkan ulang.`.

- [ ] **Step 3: Implement the Stok route**

`widgets/src/routes/stok.tsx`:

```tsx
import { createRoute, useNavigate, useSearch, type AnyRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { VIEW_TOOL, type ToolInput, type ToolOutput } from "../../../src/widgets/contract";
import type { rootRoute } from "../app/router";
import { searchFromToolArgs, stokSearch, toolArgsFromSearch } from "../app/search";
import { VIEW_PATH } from "../app/viewPaths";
import { useMorePages, useToolQuery } from "../bridge/useToolQuery";
import { ChipGroup } from "../components/ChipGroup";
import { DataTable, type ColumnDef } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorPanel } from "../components/ErrorPanel";
import { KpiTile } from "../components/KpiTile";
import { LoadMoreFooter } from "../components/LoadMoreFooter";
import { SearchInput } from "../components/SearchInput";
import { Sheet } from "../components/Sheet";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import { ViewFrame } from "../components/ViewFrame";
import { daysAgoLabel, jakartaTodayBrowser } from "../lib/dates";
import { formatDateTime, formatNumber, formatRupiah } from "../lib/format";
import { useModelContext, viewSubtitle } from "./viewHelpers";

type StockArgs = ToolInput<"show_stock_browser">;
type StockRow = ToolOutput<"show_stock_browser">["rows"][number];
type Movement = ToolOutput<"stock_history">["movements"][number];
type Velocity = ToolOutput<"stock_velocity">;
type StockFilter = "habis" | "lama";

export const STALE_SALE_DAYS = 90;
export const COLD_LOAD_NOTE = "Memuat stok, bisa sampai 15 detik";

export function isOutOfStock(row: StockRow): boolean {
  return row.stock <= 0;
}

/** No sale for at least 90 days; a variant without any recorded sale counts too. */
export function isStale(row: StockRow): boolean {
  return row.days_since_sale === null || row.days_since_sale >= STALE_SALE_DAYS;
}

function uniqueBy<T>(rows: T[], key: (row: T) => string | number): T[] {
  const seen = new Set<string | number>();
  return rows.filter((row) => {
    const id = key(row);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

const STOCK_COLUMNS: ColumnDef<StockRow>[] = [
  {
    id: "name",
    header: "Produk",
    accessorFn: (row) => row.name,
    cell: ({ row }) => <span className="block truncate font-medium">{row.original.name}</span>,
  },
  {
    id: "stock",
    header: "Stok",
    accessorFn: (row) => row.stock,
    cell: ({ row }) =>
      isOutOfStock(row.original) ? (
        <StatusBadge tone="danger">Habis ({formatNumber(row.original.stock)})</StatusBadge>
      ) : (
        <span className="tabular-nums">{formatNumber(row.original.stock)}</span>
      ),
  },
  {
    id: "price_sell",
    header: "Harga jual",
    accessorFn: (row) => row.price_sell,
    cell: ({ row }) => <span className="tabular-nums">{formatRupiah(row.original.price_sell)}</span>,
  },
  {
    id: "last_sale",
    header: "Terakhir terjual",
    accessorFn: (row) => row.days_since_sale ?? Number.MAX_SAFE_INTEGER,
    cell: ({ row }) => daysAgoLabel(row.original.days_since_sale),
  },
  {
    id: "last_adjustment",
    header: "Terakhir penyesuaian",
    accessorFn: (row) => row.days_since_adjustment ?? Number.MAX_SAFE_INTEGER,
    cell: ({ row }) => daysAgoLabel(row.original.days_since_adjustment),
  },
];

const MOVEMENT_COLUMNS: ColumnDef<Movement>[] = [
  {
    id: "at",
    header: "Waktu",
    accessorFn: (row) => row.at ?? "",
    cell: ({ row }) => (row.original.at ? formatDateTime(row.original.at) : "—"),
  },
  { id: "type", header: "Jenis", accessorFn: (row) => row.type_label, cell: ({ row }) => row.original.type_label },
  {
    id: "quantity",
    header: "±Qty",
    accessorFn: (row) => row.quantity,
    cell: ({ row }) => (
      <span className="tabular-nums">{`${row.original.quantity > 0 ? "+" : ""}${formatNumber(row.original.quantity)}`}</span>
    ),
  },
  {
    id: "balance",
    header: "Saldo",
    accessorFn: (row) => row.balance,
    cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.balance)}</span>,
  },
  {
    id: "note",
    header: "Catatan",
    accessorFn: (row) => row.note,
    cell: ({ row }) => {
      const parts = [row.original.note, row.original.by ? `oleh ${row.original.by}` : ""].filter((part) => part !== "");
      return parts.length === 0 ? "—" : parts.join(" · ");
    },
  },
];

function coverLabel(velocity: Velocity): string {
  if (velocity.stock <= 0) return "Stok sudah habis";
  if (velocity.days_of_cover === null) return "Belum bisa diperkirakan";
  if (velocity.days_of_cover < 1) return "Kurang dari 1 hari";
  return `Dalam ${formatNumber(Math.floor(velocity.days_of_cover), 0)} hari`;
}

function VelocityCard({ inventoryId, outletId }: { inventoryId: number; outletId: string | undefined }) {
  const query = useToolQuery("stock_velocity", {
    inventory_id: inventoryId,
    ...(outletId === undefined ? {} : { outlet_id: outletId }),
  });
  if (query.isPending) return <Skeleton rows={2} />;
  if (query.isError) return <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />;
  const velocity = query.data;
  return (
    <section aria-label="Kecepatan penjualan" className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <KpiTile
          label={`Terjual ${velocity.window_days} hari`}
          value={formatNumber(velocity.net_sold)}
          hint={
            velocity.refunded > 0
              ? `${formatNumber(velocity.sold)} terjual, ${formatNumber(velocity.refunded)} refund`
              : `${formatNumber(velocity.daily_rate)} per hari`
          }
        />
        <KpiTile label="Stok" value={formatNumber(velocity.stock)} />
        <KpiTile label="Perkiraan habis" value={coverLabel(velocity)} />
      </div>
      {velocity.truncated ? (
        <p className="text-xs text-fg-muted">Riwayat belum terbaca semua, jadi angka penjualan bisa lebih kecil dari sebenarnya.</p>
      ) : null}
    </section>
  );
}

function MovementHistory({ inventoryId, outletId }: { inventoryId: number; outletId: string | undefined }) {
  const history = useMorePages({
    tool: "stock_history",
    args: { inventory_id: inventoryId, ...(outletId === undefined ? {} : { outlet_id: outletId }) },
    startPage: 1,
    rowsOf: (page) => page.movements,
  });
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    history.loadMore();
  });
  const movements = uniqueBy(history.rows, (row) => row.id);

  return (
    <section aria-labelledby={`riwayat-${inventoryId}`} className="space-y-2">
      <h3 id={`riwayat-${inventoryId}`} className="text-sm font-semibold">
        Riwayat stok
      </h3>
      {movements.length === 0 && history.error ? (
        <ErrorPanel error={history.error} onRetry={history.loadMore} />
      ) : movements.length === 0 && (history.isFetching || history.hasMore) ? (
        <Skeleton rows={4} />
      ) : movements.length === 0 ? (
        <EmptyState title="Belum ada riwayat stok" />
      ) : (
        <DataTable
          rows={movements}
          columns={MOVEMENT_COLUMNS}
          getRowId={(row) => row.id}
          maxHeight={360}
          emptyText="Belum ada riwayat stok"
          footer={
            <>
              {history.error ? <ErrorPanel error={history.error} onRetry={history.loadMore} /> : null}
              <LoadMoreFooter
                hasMore={history.hasMore}
                isFetching={history.isFetching}
                onLoadMore={history.loadMore}
                loadedLabel={`${formatNumber(movements.length, 0)} pergerakan dimuat`}
              />
            </>
          }
        />
      )}
    </section>
  );
}

function StokPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const today = jakartaTodayBrowser();
  const args = toolArgsFromSearch("stok", search, today) as StockArgs;
  const query = useToolQuery(VIEW_TOOL.stok, args);
  useModelContext("stok", args);
  const [filters, setFilters] = useState<StockFilter[]>([]);
  const [selected, setSelected] = useState<StockRow | null>(null);

  const data = query.data;
  const outlet = args.outlet_id === undefined ? {} : { outlet_id: args.outlet_id };
  const more = useMorePages({
    tool: "stock_page",
    args: { ...outlet, ...(args.search === undefined ? {} : { search: args.search }) },
    startPage: data?.next_page ?? null,
    rowsOf: (page) => page.rows,
    enabled: query.isSuccess,
  });

  const loaded = data ? uniqueBy([...data.rows, ...more.rows], (row) => row.inventory_id) : [];
  const visible = loaded.filter(
    (row) => (!filters.includes("habis") || isOutOfStock(row)) && (!filters.includes("lama") || isStale(row)),
  );
  const loadedCount = formatNumber(loaded.length, 0);
  const loadedLabel =
    filters.length > 0
      ? `${formatNumber(visible.length, 0)} dari ${loadedCount} baris dimuat`
      : `${loadedCount} baris dimuat${data?.total_rows != null ? ` (total ${formatNumber(data.total_rows, 0)} varian)` : ""}`;

  return (
    <ViewFrame title="Stok" subtitle={data ? viewSubtitle(data) : undefined}>
      <SearchInput
        value={args.search ?? ""}
        placeholder="Cari nama produk"
        onChange={(text) =>
          void navigate({ to: VIEW_PATH.stok, search: searchFromToolArgs("stok", { ...outlet, search: text }, today) })
        }
      />

      {query.isPending ? (
        <Skeleton rows={8} note={args.search === undefined ? COLD_LOAD_NOTE : "Mencari stok…"} />
      ) : query.isError ? (
        <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />
      ) : data ? (
        <section aria-label="Daftar stok" className="space-y-2">
          <ChipGroup
            multiple
            options={[
              { value: "habis", label: "Stok habis", count: loaded.filter(isOutOfStock).length },
              { value: "lama", label: `Belum terjual ≥ ${STALE_SALE_DAYS} hari`, count: loaded.filter(isStale).length },
            ]}
            value={filters}
            onChange={(next) => setFilters(Array.isArray(next) ? next : [next])}
          />
          <p className="text-xs text-fg-muted">
            Filter hanya berlaku untuk baris yang sudah dimuat. Pilih produk untuk melihat riwayat dan perkiraan habis.
          </p>
          <DataTable
            rows={visible}
            columns={STOCK_COLUMNS}
            getRowId={(row) => String(row.inventory_id)}
            onRowClick={setSelected}
            emptyText={args.search ? `Tidak ada produk yang cocok dengan "${args.search}"` : "Belum ada data stok"}
            footer={
              <>
                {more.error ? <ErrorPanel error={more.error} onRetry={more.loadMore} /> : null}
                <LoadMoreFooter
                  hasMore={more.hasMore}
                  isFetching={more.isFetching}
                  onLoadMore={more.loadMore}
                  loadedLabel={loadedLabel}
                />
              </>
            }
          />
        </section>
      ) : null}

      <Sheet open={selected !== null} title={selected?.name ?? ""} onClose={() => setSelected(null)}>
        {selected ? (
          <div key={selected.inventory_id} className="space-y-4">
            <p className="text-sm">
              Stok saat ini {formatNumber(selected.stock)} · Harga jual {formatRupiah(selected.price_sell)} · Terakhir terjual{" "}
              {daysAgoLabel(selected.days_since_sale).toLowerCase()}
            </p>
            <VelocityCard inventoryId={selected.inventory_id} outletId={args.outlet_id} />
            <MovementHistory inventoryId={selected.inventory_id} outletId={args.outlet_id} />
          </div>
        ) : null}
      </Sheet>
    </ViewFrame>
  );
}

export function stokRoute(root: typeof rootRoute): AnyRoute {
  return createRoute({
    getParentRoute: () => root,
    path: VIEW_PATH.stok,
    validateSearch: stokSearch,
    component: StokPage,
  });
}
```

- [ ] **Step 4: Register the Stok route**

In `widgets/src/routes/index.ts`, replace:

```ts
import { produkRoute } from "./produk";
```

with:

```ts
import { produkRoute } from "./produk";
import { stokRoute } from "./stok";
```

and replace:

```ts
export const VIEW_ROUTES: Array<(root: typeof rootRoute) => AnyRoute> = [penjualanRoute, produkRoute];
```

with:

```ts
export const VIEW_ROUTES: Array<(root: typeof rootRoute) => AnyRoute> = [penjualanRoute, produkRoute, stokRoute];
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run widgets:test widgets/test/routes/stok.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 6: Write the failing Pembelian test**

`widgets/test/routes/pembelian.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ToolInput, ToolName, ToolOutput, ViewName } from "../../../src/widgets/contract";
import { createWidgetQueryClient } from "../../src/app/queryClient";
import { createWidgetRouter } from "../../src/app/router";
import { searchFromToolArgs } from "../../src/app/search";
import { VIEW_PATH } from "../../src/app/viewPaths";
import { BridgeContext, ToolCallError, type Bridge, type HostInfo } from "../../src/bridge/bridge";
import { createMockBridge } from "../../src/bridge/mockBridge";
import { formatNumber } from "../../src/lib/format";
import { FIXTURES } from "../../dev/fixtures";

type PurchaseRow = ToolOutput<"show_purchase_orders">["rows"][number];

/**
 * Optional: DataTable already renders the rows that fit in maxHeight before measuring (T9).
 * happy-dom has no layout, so this stub only gives the virtualizer a size to measure.
 */
const LAYOUT_PROPS = ["offsetHeight", "offsetWidth"] as const;
const originalLayout = LAYOUT_PROPS.map((prop) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop));
beforeAll(() => {
  for (const prop of LAYOUT_PROPS) {
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => (prop === "offsetHeight" ? 600 : 800) });
  }
});
afterAll(() => {
  LAYOUT_PROPS.forEach((prop, i) => {
    const descriptor = originalLayout[i];
    if (descriptor) Object.defineProperty(HTMLElement.prototype, prop, descriptor);
    else Reflect.deleteProperty(HTMLElement.prototype, prop);
  });
});

function pathFor(view: ViewName, args: Record<string, unknown>): string {
  const search = searchFromToolArgs(view, args, "2026-09-15");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) params.set(key, typeof value === "string" ? value : JSON.stringify(value));
  const query = params.toString();
  return query === "" ? VIEW_PATH[view] : `${VIEW_PATH[view]}?${query}`;
}

function makeBridge(options: { host?: Partial<HostInfo>; fail?: ToolCallError; repeatOnNextPage?: PurchaseRow } = {}) {
  const mock = createMockBridge();
  const callTool = vi.fn((name: ToolName, args: unknown, signal?: AbortSignal): Promise<unknown> => {
    if (options.fail) return Promise.reject(options.fail);
    const result = mock.callTool(name, args as ToolInput<ToolName>, signal);
    const repeated = options.repeatOnNextPage;
    if (name !== "purchase_orders_page" || repeated === undefined) return result;
    // A PO created while paging shifts purchases.list (newest first): the next page repeats a row.
    return result.then((page) => {
      const typed = page as ToolOutput<"purchase_orders_page">;
      return { ...typed, rows: [repeated, ...typed.rows] };
    });
  });
  const spies = {
    callTool,
    openLink: vi.fn(async (_url: string) => {}),
    sendMessage: vi.fn(async (_text: string) => {}),
    updateContext: vi.fn(async (_text: string) => {}),
    toggleFullscreen: vi.fn(async () => {}),
  };
  const bridge: Bridge = {
    ...spies,
    host: { ...mock.host, canFullscreen: false, canSendMessage: false, canUpdateContext: false, ...options.host },
    callTool: callTool as unknown as Bridge["callTool"],
  };
  return { bridge, ...spies };
}

function renderView(path: string, bridge: Bridge) {
  const router = createWidgetRouter({ initialPath: path });
  const utils = render(
    <BridgeContext.Provider value={bridge}>
      <QueryClientProvider client={createWidgetQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </BridgeContext.Provider>,
  );
  return { ...utils, router };
}

describe("Pembelian view", () => {
  afterEach(cleanup);

  it("lists purchase orders for all statuses without a <form>", async () => {
    const { bridge, callTool } = makeBridge();
    const fixture = FIXTURES.show_purchase_orders({ status: "semua" });
    const { container } = renderView(pathFor("pembelian", {}), bridge);

    expect(await screen.findByText(fixture.rows[0]!.order_no)).toBeTruthy();
    expect(callTool).toHaveBeenCalledWith("show_purchase_orders", { status: "semua" }, expect.anything());
    for (const header of ["No. PO", "Tanggal", "Pemasok", "Total", "Status"]) {
      expect(screen.getAllByText(header).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText(fixture.rows[0]!.status_label).length).toBeGreaterThan(0);
    expect(container.querySelector("form")).toBeNull();
  });

  it("re-queries show_purchase_orders when a status chip is chosen", async () => {
    const { bridge, callTool } = makeBridge();
    const completed = FIXTURES.show_purchase_orders({ status: "completed" });
    renderView(pathFor("pembelian", {}), bridge);
    await screen.findByText(FIXTURES.show_purchase_orders({ status: "semua" }).rows[0]!.order_no);

    fireEvent.click(screen.getByRole("button", { name: /^Selesai/ }));

    await waitFor(() =>
      expect(callTool).toHaveBeenCalledWith("show_purchase_orders", { status: "completed" }, expect.anything()),
    );
    expect(
      await screen.findByText(
        `${formatNumber(completed.rows.length, 0)} PO Selesai dari ${formatNumber(completed.scanned_rows, 0)} baris dimuat`,
      ),
    ).toBeTruthy();
  });

  it("expands a row and loads its items through purchase_order_items", async () => {
    const { bridge, callTool } = makeBridge();
    const row = FIXTURES.show_purchase_orders({ status: "semua" }).rows[0]!;
    const items = FIXTURES.purchase_order_items({ purchase_id: row.id });
    renderView(pathFor("pembelian", {}), bridge);

    fireEvent.click(await screen.findByText(row.order_no));

    await waitFor(() =>
      expect(callTool).toHaveBeenCalledWith("purchase_order_items", { purchase_id: row.id }, expect.anything()),
    );
    expect(await screen.findByText("Subtotal")).toBeTruthy();
    expect(screen.getAllByText(items.items[0]!.product).length).toBeGreaterThan(0);
    expect(screen.getByText("Diterima")).toBeTruthy();
  });

  it("pages older orders through purchase_orders_page and keeps the status filter client-side", async () => {
    const { bridge, callTool } = makeBridge();
    const first = FIXTURES.show_purchase_orders({ status: "semua" });
    expect(first.next_page).not.toBeNull();
    const second = FIXTURES.purchase_orders_page({ page: first.next_page! });
    const loaded = new Set([...first.rows, ...second.rows].map((row) => row.id)).size;
    renderView(pathFor("pembelian", {}), bridge);

    fireEvent.click(await screen.findByRole("button", { name: "Muat lebih banyak" }));

    await waitFor(() =>
      expect(callTool).toHaveBeenCalledWith("purchase_orders_page", { page: first.next_page }, expect.anything()),
    );
    expect(await screen.findByText(new RegExp(`^${formatNumber(loaded, 0)} PO dimuat`))).toBeTruthy();
  });

  it("counts a row repeated on the next page only once in the status chips", async () => {
    const first = FIXTURES.show_purchase_orders({ status: "semua" });
    const repeated = first.rows.at(-1)!;
    const second = FIXTURES.purchase_orders_page({ page: first.next_page! });
    const expected =
      (first.status_counts[repeated.status] ?? 0) + second.rows.filter((row) => row.status === repeated.status).length;
    const { bridge } = makeBridge({ repeatOnNextPage: repeated });
    renderView(pathFor("pembelian", {}), bridge);

    fireEvent.click(await screen.findByRole("button", { name: "Muat lebih banyak" }));

    expect(
      await screen.findByText(new RegExp(`^${formatNumber(first.rows.length + second.rows.length, 0)} PO dimuat`)),
    ).toBeTruthy();
    const chip = screen.getByRole("button", { name: new RegExp(`^${repeated.status_label}`) });
    expect(within(chip).getByText(formatNumber(expected, 0))).toBeTruthy();
  });

  it("updates the model context with the status filter", async () => {
    const { bridge, updateContext } = makeBridge({ host: { canUpdateContext: true } });
    renderView(pathFor("pembelian", { status: "canceled" }), bridge);

    await waitFor(() => expect(updateContext).toHaveBeenCalled());
    const text = updateContext.mock.calls.at(-1)![0];
    expect(text).toContain("pembelian");
    expect(text).toContain("status=canceled");
  });

  it("shows the forbidden message from the error panel", async () => {
    const { bridge } = makeBridge({ fail: new ToolCallError({ code: "FORBIDDEN", message: "no scope" }) });
    renderView(pathFor("pembelian", {}), bridge);

    expect(await screen.findByText("Akses ditolak untuk akun ini.")).toBeTruthy();
  });

  it("shows the reconnect panel without retrying when the Qasir session expired", async () => {
    const connectUrl = "https://mcp.example.test/connect";
    const { bridge, callTool, openLink } = makeBridge({
      fail: new ToolCallError({ code: "QASIR_AUTH_EXPIRED", message: "expired", connect_url: connectUrl }),
    });
    renderView(pathFor("pembelian", {}), bridge);

    expect(await screen.findByText("Sesi Qasir sudah berakhir. Pemilik perlu menghubungkan ulang.")).toBeTruthy();
    expect(callTool).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Buka halaman Connect" }));
    expect(openLink).toHaveBeenCalledWith(connectUrl);
    expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `bun run widgets:test widgets/test/routes/pembelian.test.tsx`
Expected: FAIL, 8 failed. `/pembelian` is not registered: `TestingLibraryElementError: Unable to find an element with the text: PO-2026-0001` (the first `FIXTURES.show_purchase_orders` row), `Unable to find role="button" and name "Muat lebih banyak"`, `Unable to find an element with the text: Akses ditolak untuk akun ini.`, `Unable to find an element with the text: Sesi Qasir sudah berakhir. Pemilik perlu menghubungkan ulang.`.

- [ ] **Step 8: Implement the Pembelian route**

`widgets/src/routes/pembelian.tsx`:

```tsx
import { createRoute, useNavigate, useSearch, type AnyRoute } from "@tanstack/react-router";
import {
  PO_STATUS_FILTERS,
  VIEW_TOOL,
  poStatusLabel,
  type PoStatusFilter,
  type ToolInput,
  type ToolOutput,
} from "../../../src/widgets/contract";
import type { rootRoute } from "../app/router";
import { pembelianSearch, searchFromToolArgs, toolArgsFromSearch } from "../app/search";
import { VIEW_PATH } from "../app/viewPaths";
import { useMorePages, useToolQuery } from "../bridge/useToolQuery";
import { ChipGroup } from "../components/ChipGroup";
import { DataTable, type ColumnDef } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorPanel } from "../components/ErrorPanel";
import { LoadMoreFooter } from "../components/LoadMoreFooter";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import { ViewFrame } from "../components/ViewFrame";
import { jakartaTodayBrowser } from "../lib/dates";
import { formatDateTime, formatNumber, formatRupiah } from "../lib/format";
import { useModelContext, viewSubtitle } from "./viewHelpers";

type PurchaseArgs = ToolInput<"show_purchase_orders">;
type PurchaseRow = ToolOutput<"show_purchase_orders">["rows"][number];

/** purchase_order_items accepts only numeric ids (contract: ^[1-9]\d{0,19}$). */
const PURCHASE_ID = /^[1-9]\d{0,19}$/;

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  completed: "success",
  order_processed: "warning",
  canceled: "danger",
};

export function statusFilterLabel(status: PoStatusFilter): string {
  return status === "semua" ? "Semua" : poStatusLabel(status);
}

/** Server counts for its scanned rows plus the rows paged in by the widget. */
export function combinedStatusCounts(serverCounts: Record<string, number>, extraRows: PurchaseRow[]): Record<string, number> {
  const counts: Record<string, number> = { ...serverCounts };
  for (const row of extraRows) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return counts;
}

function uniqueRows(rows: PurchaseRow[], seen: Set<string> = new Set()): PurchaseRow[] {
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

/**
 * Paged rows not already loaded. A PO created while paging shifts purchases.list (newest first),
 * so a later page can repeat a row. With a status filter, firstRows holds only matching rows, so a
 * repeated row of another status still counts once more (accepted approximation).
 */
export function newPagedRows(firstRows: PurchaseRow[], pagedRows: PurchaseRow[]): PurchaseRow[] {
  return uniqueRows(pagedRows, new Set(firstRows.map((row) => row.id)));
}

const COLUMNS: ColumnDef<PurchaseRow>[] = [
  {
    id: "order_no",
    header: "No. PO",
    accessorFn: (row) => row.order_no,
    cell: ({ row }) => <span className="font-medium">{row.original.order_no || "—"}</span>,
  },
  {
    id: "created_at",
    header: "Tanggal",
    accessorFn: (row) => row.created_at ?? "",
    cell: ({ row }) => (row.original.created_at ? formatDateTime(row.original.created_at) : "—"),
  },
  { id: "supplier", header: "Pemasok", accessorFn: (row) => row.supplier, cell: ({ row }) => row.original.supplier || "—" },
  {
    id: "total",
    header: "Total",
    accessorFn: (row) => row.total,
    cell: ({ row }) => <span className="tabular-nums">{formatRupiah(row.original.total)}</span>,
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (row) => row.status_label,
    cell: ({ row }) => (
      <StatusBadge tone={STATUS_TONE[row.original.status] ?? "neutral"}>{row.original.status_label}</StatusBadge>
    ),
  },
];

function PurchaseItems({ row, outletId }: { row: PurchaseRow; outletId: string | undefined }) {
  const valid = PURCHASE_ID.test(row.id);
  const query = useToolQuery(
    "purchase_order_items",
    { purchase_id: row.id, ...(outletId === undefined ? {} : { outlet_id: outletId }) },
    { enabled: valid },
  );
  if (!valid) return <p className="text-sm text-fg-muted">Rincian item tidak tersedia untuk PO ini.</p>;
  if (query.isPending) return <Skeleton rows={2} />;
  if (query.isError) return <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />;
  const { items, total } = query.data;
  if (items.length === 0) return <EmptyState title="PO ini belum punya item" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <caption className="sr-only">Item {row.order_no}</caption>
        <thead>
          <tr className="text-left text-xs text-fg-muted">
            <th scope="col" className="py-1 pr-3 font-medium">
              Produk
            </th>
            <th scope="col" className="py-1 pr-3 font-medium">
              Varian
            </th>
            <th scope="col" className="py-1 pr-3 text-right font-medium">
              Dipesan
            </th>
            <th scope="col" className="py-1 pr-3 text-right font-medium">
              Diterima
            </th>
            <th scope="col" className="py-1 pr-3 text-right font-medium">
              Harga
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              Subtotal
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.product}-${item.variant}-${index}`}>
              <td className="py-1 pr-3">{item.product || "—"}</td>
              <td className="py-1 pr-3">{item.variant || "—"}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{`${formatNumber(item.quantity)} ${item.unit}`.trim()}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{formatNumber(item.received)}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{formatRupiah(item.price)}</td>
              <td className="py-1 text-right tabular-nums">{formatRupiah(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={5} className="py-1 pr-3 text-right font-medium">
              Total
            </th>
            <td className="py-1 text-right font-semibold tabular-nums">{formatRupiah(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function PembelianPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const today = jakartaTodayBrowser();
  const args = toolArgsFromSearch("pembelian", search, today) as PurchaseArgs;
  const status: PoStatusFilter = args.status ?? "semua";
  const query = useToolQuery(VIEW_TOOL.pembelian, args);
  useModelContext("pembelian", args);

  const data = query.data;
  const outlet = args.outlet_id === undefined ? {} : { outlet_id: args.outlet_id };
  const more = useMorePages({
    tool: "purchase_orders_page",
    args: outlet,
    startPage: data?.next_page ?? null,
    rowsOf: (page) => page.rows,
    enabled: query.isSuccess,
  });

  const paged = data ? newPagedRows(data.rows, more.rows) : [];
  const scanned = data ? uniqueRows([...data.rows, ...paged]) : [];
  const visible = status === "semua" ? scanned : scanned.filter((row) => row.status === status);
  const counts = data ? combinedStatusCounts(data.status_counts, paged) : {};
  const scannedRows = data ? data.scanned_rows + paged.length : 0;
  const loadedLabel =
    status === "semua"
      ? `${formatNumber(visible.length, 0)} PO dimuat${data?.total_rows != null ? ` dari ${formatNumber(data.total_rows, 0)}` : ""}`
      : `${formatNumber(visible.length, 0)} PO ${statusFilterLabel(status)} dari ${formatNumber(scannedRows, 0)} baris dimuat`;

  return (
    <ViewFrame title="Pembelian" subtitle={data ? viewSubtitle(data) : undefined}>
      <ChipGroup
        options={PO_STATUS_FILTERS.map((value) => ({
          value,
          label: statusFilterLabel(value),
          ...(value === "semua" || !data ? {} : { count: counts[value] ?? 0 }),
        }))}
        value={status}
        onChange={(next: PoStatusFilter) =>
          void navigate({ to: VIEW_PATH.pembelian, search: searchFromToolArgs("pembelian", { ...outlet, status: next }, today) })
        }
      />

      {query.isPending ? (
        <Skeleton rows={8} note={status === "semua" ? undefined : "Memindai beberapa halaman PO…"} />
      ) : query.isError ? (
        <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />
      ) : data ? (
        <section aria-label="Daftar pesanan pembelian" className="space-y-2">
          {status === "semua" ? null : (
            <p className="text-xs text-fg-muted">
              Status disaring dari baris yang sudah dimuat. Muat lebih banyak untuk memindai PO yang lebih lama.
            </p>
          )}
          <DataTable
            rows={visible}
            columns={COLUMNS}
            getRowId={(row) => row.id}
            renderExpanded={(row) => <PurchaseItems row={row} outletId={args.outlet_id} />}
            emptyText={status === "semua" ? "Belum ada pesanan pembelian" : `Belum ada PO ${statusFilterLabel(status)} di baris yang dimuat`}
            footer={
              <>
                {more.error ? <ErrorPanel error={more.error} onRetry={more.loadMore} /> : null}
                <LoadMoreFooter
                  hasMore={more.hasMore}
                  isFetching={more.isFetching}
                  onLoadMore={more.loadMore}
                  loadedLabel={loadedLabel}
                />
              </>
            }
          />
        </section>
      ) : null}
    </ViewFrame>
  );
}

export function pembelianRoute(root: typeof rootRoute): AnyRoute {
  return createRoute({
    getParentRoute: () => root,
    path: VIEW_PATH.pembelian,
    validateSearch: pembelianSearch,
    component: PembelianPage,
  });
}
```

- [ ] **Step 9: Register the Pembelian route**

In `widgets/src/routes/index.ts`, replace:

```ts
import { stokRoute } from "./stok";
```

with:

```ts
import { stokRoute } from "./stok";
import { pembelianRoute } from "./pembelian";
```

and replace:

```ts
export const VIEW_ROUTES: Array<(root: typeof rootRoute) => AnyRoute> = [penjualanRoute, produkRoute, stokRoute];
```

with:

```ts
export const VIEW_ROUTES: Array<(root: typeof rootRoute) => AnyRoute> = [penjualanRoute, produkRoute, stokRoute, pembelianRoute];
```

- [ ] **Step 10: Run every widget test and the widget types**

Run: `bun run widgets:test && bun run widgets:check-types`
Expected: every widget test file PASSES, including `routes/stok.test.tsx` (9), `routes/pembelian.test.tsx` (8), and T12's `routes/produk.test.tsx` and `routes/penjualan.test.tsx`, whose Stok links now render the real Stok view. `tsc` exits 0.

- [ ] **Step 11: Regenerate the bundle and run the Worker-side checks**

Run: `bun run widgets:bundle && bun run test tests/unit/widgets-bundle.test.ts && bun run check-types`
Expected: `Wrote src/widgets/bundled.ts (… chars, source hash …)`; the bundle test PASSES (7 tests); all three `tsc` projects exit 0.

- [ ] **Step 12: Commit**

```bash
git add widgets/src/routes/stok.tsx widgets/src/routes/pembelian.tsx widgets/src/routes/index.ts widgets/test/routes/stok.test.tsx widgets/test/routes/pembelian.test.tsx src/widgets/bundled.ts
git commit -m "feat(widgets): Stok browser and Pembelian purchase-order views

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

---

### Task 14: Views Transaksi and Piutang

**Files:**
- Create: `widgets/src/components/OrderDetailSheet.tsx`
- Create: `widgets/src/routes/transaksi.tsx`
- Create: `widgets/src/routes/piutang.tsx`
- Modify: `widgets/src/routes/index.ts` (register both route factories)
- Modify: `src/widgets/bundled.ts` (regenerated with `bun run widgets:bundle`)
- Modify: `docs/superpowers/specs/2026-09-15-mcp-app-widgets-design.md` (§5 Piutang: record that the expanded customer is a panel below the table)
- Test: `widgets/test/routes/transaksi.test.tsx`
- Test: `widgets/test/routes/piutang.test.tsx`

**Interfaces:**
- Consumes:
  - T1 (`src/widgets/contract.ts`): `AGING_BUCKET_LABEL`, `type AgingBucketKey`, `type ToolInput`, `type ToolOutput`.
  - T8:
    - `rootRoute` (type only) and `createWidgetRouter` from `widgets/src/app/router.tsx`.
    - From `widgets/src/app/search.ts`: `transaksiSearch`, `piutangSearch`, `DEBT_SORTS`, `type DebtSort`, `searchFromToolArgs`, `toolArgsFromSearch`, `viewPathWithSearch`.
    - `VIEW_PATH`, `createWidgetQueryClient`, `BridgeContext`, `useBridge`.
    - `createMockBridge` and `type MockBridge` (with `calls`, `openedLinks`, `sentMessages`, the `failWith` option and the `host` option).
    - `FIXTURES`, `useToolQuery`, `useMorePages`, `addIsoDays`, `jakartaTodayBrowser`, `formatDate`, `formatDateTime`, `formatNumber`, `formatRupiah`.
  - T9 (`widgets/src/components/*`):
    - Views: `ViewFrame`, `PresetRangePicker({ value, onChange, today? })`, `ChipGroup` + `type ChipOption`, `SearchInput`, `KpiTile`.
    - `DataTable` + `dataColumnHelper`: columns are built once at module scope, per the T9 usage rules.
    - `LoadMoreFooter`, `Sheet`, `StatusBadge` + `type StatusTone`, `ErrorPanel`, `EmptyState`, `Skeleton`, and `buttonClass` + `cx` from `ui.ts`.
  - T12 (`widgets/src/routes/viewHelpers.ts`): `viewSubtitle`, `rangeLabel`, `useModelContext`. T12's rules for route factories, tool arguments, navigation, styling and host features apply unchanged.
  - T13: `VIEW_ROUTES` = `[penjualanRoute, produkRoute, stokRoute, pembelianRoute]`.
  - T10: `bun run widgets:bundle`, `tests/unit/widgets-bundle.test.ts`.
- Produces:
  - `widgets/src/components/OrderDetailSheet.tsx`:
    - `function OrderDetailSheet(props: { salesId: number | null; onClose: () => void; onShowCustomer?: (customerId: number) => void })`
    - `function salesStatusTone(status: number): StatusTone`
  - `widgets/src/routes/transaksi.tsx`:
    - `function transaksiRoute(root: typeof rootRoute): AnyRoute`
    - `function customerTransactionsArgs(customerId: number, today: string, outletId?: string): ToolInput<"show_transactions">` (the last 365 days, ending today)
    - `function mergeTransactionDays(days: readonly TransactionDay[]): TransactionDay[]`
    - `type TransactionDay`, `type TransactionItem`
    - `const DAY_HEADER_HEIGHT = 36`, `TRANSACTION_ROW_HEIGHT = 56`, `TRANSACTION_LIST_MAX_HEIGHT = 560`, `CUSTOMER_HISTORY_DAYS = 365`
  - `widgets/src/routes/piutang.tsx`:
    - `function piutangRoute(root: typeof rootRoute): AnyRoute`
    - `function sortDebtCustomers(rows, sort: DebtSort): DebtCustomer[]`, `function filterDebtCustomers(rows, text: string, bucket: AgingBucketKey | undefined): DebtCustomer[]`
    - `function collectionMessage(detail: ToolOutput<"customer_debt_detail">): string`
    - `const DEBT_SORT_LABEL: Record<DebtSort, string>`, `type DebtCustomer`
  - `VIEW_ROUTES` after this task: `[penjualanRoute, produkRoute, stokRoute, pembelianRoute, transaksiRoute, piutangRoute]`. T15's smoke test relies on the text "INV/20260915/0000", on "Pelanggan E", and on the loaded label "`N` transaksi dimuat".

Behaviour this task pins down (spec §5 Transaksi and Piutang):

**Transaksi**
- **Range.** Presets come from `PresetRangePicker`. The default is Hari ini (T8 `DEFAULT_PRESET`). A range change navigates with `searchFromToolArgs("transaksi", { ...args, start_date, end_date }, today)`.
- **Customer chip.** It shows while `customer_id` is set: "Pelanggan: <name from the tool, else #id>". Its × button ("Hapus filter pelanggan") navigates with the same tool arguments minus `customer_id`, so the range stays.
- **Chip filters.** The payment-mode chips (Semua metode + each mode, with counts) and the status chips (Semua status + each `status_label`, with counts) filter loaded rows only. They are local state and reset when the tool arguments change.
- **Paging.** `useMorePages({ tool: "transactions_page", args, startPage: data.next_page, rowsOf: (page) => page.days })`. `mergeTransactionDays` joins a day split across pages and dedupes by `sales_id`. The footer label reads "`N` transaksi dimuat[ dari `total_transactions`][ · `M` cocok dengan filter]".
- **List.**
  - Entries are day headers (date + `daily_amount`, 36 px) and sale rows (time, invoice, payment mode · sales type, amount, status badge; 56 px).
  - The list is virtualized in a scroll box of at most 560 px.
  - A `rangeExtractor` keeps the active day header rendered with `position: sticky`.
  - Before the box is measured (first paint, happy-dom), the entries that fit in 560 px are rendered.
- **Sheet.** A row click opens `OrderDetailSheet` (`order_detail`). It shows invoice, status, paid time, cashier, the customer with phone, the items table, totals, payments, and the credit block for status 4. "Lihat transaksi pelanggan ini" closes the sheet and navigates with `customerTransactionsArgs(customer.id, today, outlet_id)`.

**Piutang**
- **Tiles.** "Sisa piutang (laporan Qasir)", Pelanggan, Nota terbuka, Lewat jatuh tempo.
- **Aging strip.** "Semua umur" plus one button per bucket (label, receivable, invoices · customers). A button toggles the `bucket` search param, which filters customers by `oldest_bucket`.
- **Search and sort.** `SearchInput` filters loaded customers by name on the client. The sort chips (Lewat jatuh tempo · Nilai kredit terbesar · Nota terlama) set the `sort` search param. `bucket` and `sort` are view-only filters: they are added to `searchFromToolArgs("piutang", args, today)` and never reach the tool.
- **Expansion.** DataTable (T9) has no controlled-expansion prop, so the expanded customer renders as a detail panel directly below the table. This deviates from spec §5 ("Row expand"); Step 13 records it in the spec.
  - A row click opens or closes it, and an ▸/▾ indicator column shows which customer is open.
  - `focus_customer_id` starts open.
  - The customer table scrolls inside 560 px, so a panel opened from a long list could sit off-screen below it. A panel the user opens therefore calls `scrollIntoView({ block: "nearest" })` on mount. The pre-expanded `focus_customer_id` panel does not, so the view never scrolls the host page without a click.
  - The panel loads `customer_debt_detail` and shows the phone, the totals (Total · Dibayar · Sisa), and invoice cards with payments.
  - Its buttons: "Lihat semua transaksi" (Transaksi with `customerTransactionsArgs`), and "Minta Claude buat pesan penagihan", only when `bridge.host.canSendMessage`.
- **Collection message.** Its text names the customer, then lists each invoice with a remaining balance (invoice, sale date, remaining amount, due date and days overdue). It never includes the phone number, and it uses plain spaces instead of NBSP.

- [ ] **Step 1: Write the failing Transaksi test**

`widgets/test/routes/transaksi.test.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWidgetQueryClient } from "../../src/app/queryClient";
import { createWidgetRouter } from "../../src/app/router";
import { searchFromToolArgs, viewPathWithSearch } from "../../src/app/search";
import { BridgeContext } from "../../src/bridge/bridge";
import { createMockBridge, type MockBridge } from "../../src/bridge/mockBridge";
import { customerTransactionsArgs, mergeTransactionDays, type TransactionDay } from "../../src/routes/transaksi";

// 10:00 in Jakarta on 15 Sep 2026.
const NOW = new Date("2026-09-15T03:00:00Z");

function renderAt(path: string, bridge: MockBridge = createMockBridge()) {
  const router = createWidgetRouter({ initialPath: path });
  const view = render(
    <BridgeContext.Provider value={bridge}>
      <QueryClientProvider client={createWidgetQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </BridgeContext.Provider>,
  );
  return { ...view, bridge, router };
}

function callsTo(bridge: MockBridge, name: string) {
  return bridge.calls.filter((call) => call.name === name).map((call) => call.args);
}

function transactionButtons(): HTMLElement[] {
  const list = screen.getByRole("region", { name: "Daftar transaksi" });
  return within(list).getAllByRole("button");
}

describe("transaksi view", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens on Hari ini and lists today's sales grouped under a day header", async () => {
    const { bridge, container } = renderAt("/transaksi");

    expect(await screen.findByText("INV/20260915/0000")).toBeTruthy();
    expect(callsTo(bridge, "show_transactions")).toEqual([{ start_date: "2026-09-15", end_date: "2026-09-15" }]);
    expect(screen.getByRole("heading", { level: 1, name: "Transaksi" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hari ini" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("heading", { level: 3 }).textContent).toContain("15 Sep 2026");
    expect(transactionButtons()).toHaveLength(6);
    expect(screen.getByText("6 transaksi dimuat dari 30")).toBeTruthy();
    expect(container.querySelector("form")).toBeNull();
  });

  it("filters loaded rows by payment mode and by status", async () => {
    renderAt("/transaksi");
    await screen.findByText("INV/20260915/0000");

    fireEvent.click(screen.getByRole("button", { name: /^QRIS/ }));
    expect(transactionButtons().map((row) => within(row).getByText(/^INV\//).textContent)).toEqual([
      "INV/20260915/0001",
      "INV/20260915/0004",
    ]);
    expect(screen.getByText("6 transaksi dimuat dari 30 · 2 cocok dengan filter")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Semua metode/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Refund sebagian/ }));
    expect(transactionButtons()).toHaveLength(1);
    expect(screen.getByText("INV/20260915/0005")).toBeTruthy();
  });

  it("loads the next page through transactions_page with the same filters", async () => {
    const { bridge } = renderAt("/transaksi");
    await screen.findByText("INV/20260915/0000");

    fireEvent.click(screen.getByRole("button", { name: "Muat lebih banyak" }));

    expect(await screen.findByText("18 transaksi dimuat dari 30")).toBeTruthy();
    expect(callsTo(bridge, "transactions_page")).toEqual([{ start_date: "2026-09-15", end_date: "2026-09-15", page: 2 }]);
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("8 Sep 2026")]),
    );
  });

  it("opens the order detail sheet and jumps to that customer's last 365 days", async () => {
    const { bridge } = renderAt("/transaksi");
    fireEvent.click(await screen.findByText("INV/20260915/0000"));

    const sheet = await screen.findByRole("dialog", { name: "Detail transaksi" });
    expect(await within(sheet).findByText("Kredit")).toBeTruthy();
    expect(callsTo(bridge, "order_detail")).toEqual([{ sales_id: 900_000 }]);
    expect(within(sheet).getByText("Pelanggan A")).toBeTruthy();
    expect(within(sheet).getByText("Telepon: 0800-0000-0001")).toBeTruthy();
    expect(within(sheet).getByText("Kasir: Kasir A")).toBeTruthy();

    fireEvent.click(within(sheet).getByRole("button", { name: "Lihat transaksi pelanggan ini" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await screen.findByText("Pelanggan: Pelanggan A")).toBeTruthy();
    expect(callsTo(bridge, "show_transactions").at(-1)).toEqual({
      start_date: "2025-09-16",
      end_date: "2026-09-15",
      customer_id: 3001,
    });
  });

  it("drops customer_id from the search when the customer chip is cleared", async () => {
    const path = viewPathWithSearch("transaksi", searchFromToolArgs("transaksi", customerTransactionsArgs(3001, "2026-09-15"), "2026-09-15"));
    const { bridge, router } = renderAt(path);
    expect(await screen.findByText("Pelanggan: Pelanggan A")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Hapus filter pelanggan" }));

    await waitFor(() => expect(screen.queryByText("Pelanggan: Pelanggan A")).toBeNull());
    expect(router.state.location.search).not.toHaveProperty("customer_id");
    await waitFor(() =>
      expect(callsTo(bridge, "show_transactions").at(-1)).toEqual({ start_date: "2025-09-16", end_date: "2026-09-15" }),
    );
  });

  it("shows the reconnect panel without retrying when the Qasir session expired", async () => {
    const bridge = createMockBridge({ failWith: { show_transactions: "QASIR_AUTH_EXPIRED" } });
    renderAt("/transaksi", bridge);

    expect(await screen.findByText("Sesi Qasir sudah berakhir. Pemilik perlu menghubungkan ulang.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Buka halaman Connect" }));
    expect(bridge.openedLinks).toEqual(["https://widget.example/connect"]);
    expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
    expect(callsTo(bridge, "show_transactions")).toHaveLength(1);
  });
});

describe("mergeTransactionDays", () => {
  const item = (salesId: number) => ({
    sales_id: salesId,
    time: "10:00",
    invoice: `INV${salesId}`,
    payment_mode: "Tunai",
    amount: 1000,
    status: 2,
    status_label: "Selesai",
    sales_type: "",
  });

  it("joins a day split across pages and keeps each sale once, in order", () => {
    const pageOne: TransactionDay[] = [{ date: "2026-09-15", daily_amount: 5000, items: [item(1), item(2)] }];
    const pageTwo: TransactionDay[] = [
      { date: "2026-09-15", daily_amount: 5000, items: [item(2), item(3)] },
      { date: "2026-09-14", daily_amount: 1000, items: [item(4)] },
    ];
    expect(mergeTransactionDays([...pageOne, ...pageTwo])).toEqual([
      { date: "2026-09-15", daily_amount: 5000, items: [item(1), item(2), item(3)] },
      { date: "2026-09-14", daily_amount: 1000, items: [item(4)] },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run widgets:test test/routes/transaksi.test.tsx`
Expected: FAIL with `Failed to resolve import "../../src/routes/transaksi" from "widgets/test/routes/transaksi.test.tsx". Does the file exist?`

- [ ] **Step 3: Implement the order detail sheet**

`widgets/src/components/OrderDetailSheet.tsx`:

```tsx
import type { ReactNode } from "react";
import type { ToolOutput } from "../../../src/widgets/contract";
import { useToolQuery } from "../bridge/useToolQuery";
import { formatDate, formatDateTime, formatNumber, formatRupiah } from "../lib/format";
import { ErrorPanel } from "./ErrorPanel";
import { Sheet } from "./Sheet";
import { Skeleton } from "./Skeleton";
import { StatusBadge, type StatusTone } from "./StatusBadge";
import { buttonClass } from "./ui";

type OrderDetail = ToolOutput<"order_detail">;

/** Badge tone for a Qasir sales status: 2 selesai, 3 refund, 4 kredit belum lunas, 6 refund sebagian. */
export function salesStatusTone(status: number): StatusTone {
  if (status === 2) return "success";
  if (status === 3) return "danger";
  if (status === 4 || status === 6) return "warning";
  return "neutral";
}

export interface OrderDetailSheetProps {
  /** The sale to show; null keeps the sheet closed. */
  salesId: number | null;
  onClose: () => void;
  /** Offered as "Lihat transaksi pelanggan ini" when the sale has a customer. */
  onShowCustomer?: (customerId: number) => void;
}

/** Receipt detail of one sale (order_detail): items, payments, credit block, customer and cashier. */
export function OrderDetailSheet({ salesId, onClose, onShowCustomer }: OrderDetailSheetProps) {
  return (
    <Sheet open={salesId !== null} title="Detail transaksi" onClose={onClose}>
      {salesId !== null ? <OrderDetailBody salesId={salesId} onShowCustomer={onShowCustomer} /> : null}
    </Sheet>
  );
}

function OrderDetailBody({ salesId, onShowCustomer }: { salesId: number; onShowCustomer?: (customerId: number) => void }) {
  const query = useToolQuery("order_detail", { sales_id: salesId });
  if (query.isPending) return <Skeleton rows={6} note="Memuat detail transaksi…" />;
  if (query.isError) {
    return (
      <ErrorPanel
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  return <OrderDetailContent order={query.data} onShowCustomer={onShowCustomer} />;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-fg-muted">{label}</dt>
      <dd className={tone === "danger" ? "font-semibold tabular-nums text-danger" : "tabular-nums text-fg"}>{value}</dd>
    </div>
  );
}

function OrderDetailContent({ order, onShowCustomer }: { order: OrderDetail; onShowCustomer?: (customerId: number) => void }) {
  const customer = order.customer;
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-fg">{order.invoice}</p>
          <StatusBadge tone={salesStatusTone(order.status)}>{order.status_label}</StatusBadge>
        </div>
        {order.settled_at ? <p className="text-xs text-fg-muted">Dibayar {formatDateTime(order.settled_at)}</p> : null}
        {order.cashier ? <p className="text-xs text-fg-muted">Kasir: {order.cashier}</p> : null}
      </div>

      {customer ? (
        <Section title="Pelanggan">
          <p className="text-sm text-fg">{customer.name}</p>
          <p className="text-sm text-fg-muted">{customer.mobile ? `Telepon: ${customer.mobile}` : "Nomor telepon tidak tersedia"}</p>
          {onShowCustomer ? (
            <button type="button" className={buttonClass} onClick={() => onShowCustomer(customer.id)}>
              Lihat transaksi pelanggan ini
            </button>
          ) : null}
        </Section>
      ) : null}

      <Section title="Item">
        {order.items.length === 0 ? (
          <p className="text-sm text-fg-muted">Tidak ada item.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-fg-muted">
                  <th scope="col" className="py-1 pr-2 font-medium">
                    Produk
                  </th>
                  <th scope="col" className="py-1 pr-2 text-right font-medium">
                    Jumlah
                  </th>
                  <th scope="col" className="py-1 pr-2 text-right font-medium">
                    Harga
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, index) => (
                  <tr key={`${item.product}-${index}`} className="border-b border-line-muted align-top">
                    <td className="py-1.5 pr-2 text-fg">
                      {item.product}
                      {item.variant ? <span className="block text-xs text-fg-muted">{item.variant}</span> : null}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{formatNumber(item.quantity)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{formatRupiah(item.price)}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatRupiah(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <dl className="space-y-1 pt-1">
          <Line label="Total tagihan" value={formatRupiah(order.total_bill)} />
          <Line label="Dibayar" value={formatRupiah(order.total_paid)} />
          {order.change > 0 ? <Line label="Kembalian" value={formatRupiah(order.change)} /> : null}
        </dl>
      </Section>

      <Section title="Pembayaran">
        {order.payments.length === 0 ? (
          <p className="text-sm text-fg-muted">Belum ada pembayaran.</p>
        ) : (
          <ul className="space-y-1.5">
            {order.payments.map((payment, index) => (
              <li key={`${payment.name}-${index}`} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="text-fg">{payment.name || payment.mode || "Pembayaran"}</span>
                  {payment.paid_at ? <span className="block text-xs text-fg-muted">{formatDateTime(payment.paid_at)}</span> : null}
                </span>
                <span className="tabular-nums text-fg">{formatRupiah(payment.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {order.credit ? (
        <Section title="Kredit">
          <dl className="space-y-1">
            <Line
              label="Jangka waktu"
              value={order.credit.period === null ? "—" : `${formatNumber(order.credit.period, 0)} ${order.credit.unit}`.trim()}
            />
            <Line label="Jatuh tempo" value={order.credit.due_date ? formatDate(order.credit.due_date) : "—"} />
            <Line label="Total kredit" value={formatRupiah(order.credit.total)} />
            <Line label="Sisa" value={formatRupiah(order.credit.remaining)} tone="danger" />
          </dl>
        </Section>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Implement the Transaksi route**

`widgets/src/routes/transaksi.tsx`:

```tsx
import { createRoute, useNavigate, useSearch, type AnyRoute } from "@tanstack/react-router";
import { defaultRangeExtractor, useVirtualizer, type Range } from "@tanstack/react-virtual";
import { useCallback, useMemo, useRef, useState } from "react";
import type { ToolInput, ToolOutput } from "../../../src/widgets/contract";
import type { rootRoute } from "../app/router";
import { searchFromToolArgs, toolArgsFromSearch, transaksiSearch } from "../app/search";
import { VIEW_PATH } from "../app/viewPaths";
import { useMorePages, useToolQuery } from "../bridge/useToolQuery";
import { ChipGroup, type ChipOption } from "../components/ChipGroup";
import { EmptyState } from "../components/EmptyState";
import { ErrorPanel } from "../components/ErrorPanel";
import { KpiTile } from "../components/KpiTile";
import { LoadMoreFooter } from "../components/LoadMoreFooter";
import { OrderDetailSheet, salesStatusTone } from "../components/OrderDetailSheet";
import { PresetRangePicker } from "../components/PresetRangePicker";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import { ViewFrame } from "../components/ViewFrame";
import { addIsoDays, jakartaTodayBrowser } from "../lib/dates";
import { formatDate, formatNumber, formatRupiah } from "../lib/format";
import { rangeLabel, useModelContext, viewSubtitle } from "./viewHelpers";

export type TransactionDay = ToolOutput<"show_transactions">["days"][number];
export type TransactionItem = TransactionDay["items"][number];
type TransactionsArgs = ToolInput<"show_transactions">;

/** Fixed entry heights of the virtualized list (no DOM measuring needed). */
export const DAY_HEADER_HEIGHT = 36;
export const TRANSACTION_ROW_HEIGHT = 56;
export const TRANSACTION_LIST_MAX_HEIGHT = 560;
/** "Lihat transaksi pelanggan ini" and "Lihat semua transaksi" open this many days, ending today. */
export const CUSTOMER_HISTORY_DAYS = 365;

const ALL = "semua";

/** show_transactions arguments for one customer's last 365 days (Asia/Jakarta), ending `today`. */
export function customerTransactionsArgs(customerId: number, today: string, outletId?: string): TransactionsArgs {
  return {
    start_date: addIsoDays(today, -(CUSTOMER_HISTORY_DAYS - 1)),
    end_date: today,
    customer_id: customerId,
    ...(outletId ? { outlet_id: outletId } : {}),
  };
}

/**
 * Joins day groups from several pages. A day split across pages becomes one group (upstream repeats the
 * per-day total, so the first daily_amount wins) and a sale seen twice is kept once. Order is preserved.
 */
export function mergeTransactionDays(days: readonly TransactionDay[]): TransactionDay[] {
  const byDate = new Map<string, { day: TransactionDay; seen: Set<number> }>();
  for (const day of days) {
    let entry = byDate.get(day.date);
    if (!entry) {
      entry = { day: { date: day.date, daily_amount: day.daily_amount, items: [] }, seen: new Set() };
      byDate.set(day.date, entry);
    }
    for (const item of day.items) {
      if (entry.seen.has(item.sales_id)) continue;
      entry.seen.add(item.sales_id);
      entry.day.items.push(item);
    }
  }
  return [...byDate.values()].map((entry) => entry.day);
}

export function transaksiRoute(root: typeof rootRoute): AnyRoute {
  return createRoute({
    getParentRoute: () => root,
    path: VIEW_PATH.transaksi,
    validateSearch: transaksiSearch,
    component: TransaksiPage,
  });
}

function TransaksiPage() {
  const search = transaksiSearch.parse(useSearch({ strict: false }));
  const navigate = useNavigate();
  const today = jakartaTodayBrowser();
  const args = toolArgsFromSearch("transaksi", search, today) as TransactionsArgs;
  const query = useToolQuery("show_transactions", args);
  const [openSalesId, setOpenSalesId] = useState<number | null>(null);
  useModelContext("transaksi", args);

  const openTransactions = (nextArgs: TransactionsArgs) => {
    void navigate({ to: VIEW_PATH.transaksi, search: searchFromToolArgs("transaksi", nextArgs, today) });
  };
  const { customer_id: customerId, ...withoutCustomer } = args;
  const data = query.data;

  return (
    <ViewFrame title="Transaksi" subtitle={data ? `${viewSubtitle(data)} · ${rangeLabel(data.range)}` : rangeLabel(args)}>
      <PresetRangePicker
        today={today}
        value={{ preset: search.preset, start_date: args.start_date, end_date: args.end_date }}
        onChange={(range) => openTransactions({ ...args, start_date: range.start_date, end_date: range.end_date })}
      />
      {customerId !== undefined ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1 rounded-full bg-info-soft py-0.5 pl-3 pr-1 text-info">
            Pelanggan: {data?.customer?.name ?? `#${customerId}`}
            <button
              type="button"
              aria-label="Hapus filter pelanggan"
              className="inline-flex size-6 items-center justify-center rounded-full hover:bg-surface-muted"
              onClick={() => openTransactions(withoutCustomer)}
            >
              ×
            </button>
          </span>
        </div>
      ) : null}
      {query.isPending ? (
        <Skeleton rows={6} note="Memuat transaksi…" />
      ) : query.isError ? (
        <ErrorPanel
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <TransactionsPanel key={JSON.stringify(args)} data={query.data} args={args} onOpen={setOpenSalesId} />
      )}
      <OrderDetailSheet
        salesId={openSalesId}
        onClose={() => setOpenSalesId(null)}
        onShowCustomer={(id) => {
          setOpenSalesId(null);
          openTransactions(customerTransactionsArgs(id, today, args.outlet_id));
        }}
      />
    </ViewFrame>
  );
}

function TransactionsPanel({
  data,
  args,
  onOpen,
}: {
  data: ToolOutput<"show_transactions">;
  args: TransactionsArgs;
  onOpen: (salesId: number) => void;
}) {
  const more = useMorePages({ tool: "transactions_page", args, startPage: data.next_page, rowsOf: (page) => page.days });
  const [payment, setPayment] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);

  const days = useMemo(() => mergeTransactionDays([...data.days, ...more.rows]), [data.days, more.rows]);
  const items = useMemo(() => days.flatMap((day) => day.items), [days]);

  const paymentOptions = useMemo<ChipOption<string>[]>(() => {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.payment_mode, (counts.get(item.payment_mode) ?? 0) + 1);
    return [
      { value: ALL, label: "Semua metode", count: items.length },
      ...[...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "id"))
        .map(([mode, count]) => ({ value: mode, label: mode === "" ? "Tanpa metode" : mode, count })),
    ];
  }, [items]);

  const statusOptions = useMemo<ChipOption<string>[]>(() => {
    const groups = new Map<number, { label: string; count: number }>();
    for (const item of items) {
      const group = groups.get(item.status) ?? { label: item.status_label, count: 0 };
      group.count += 1;
      groups.set(item.status, group);
    }
    return [
      { value: ALL, label: "Semua status", count: items.length },
      ...[...groups.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([code, group]) => ({ value: String(code), label: group.label, count: group.count })),
    ];
  }, [items]);

  const filtered = useMemo(
    () =>
      days
        .map((day) => ({
          ...day,
          items: day.items.filter(
            (item) => (payment === ALL || item.payment_mode === payment) && (status === ALL || String(item.status) === status),
          ),
        }))
        .filter((day) => day.items.length > 0),
    [days, payment, status],
  );
  const shown = filtered.reduce((sum, day) => sum + day.items.length, 0);
  const loadedAmount = items.filter((item) => item.status !== 3).reduce((sum, item) => sum + item.amount, 0);
  const filtersActive = payment !== ALL || status !== ALL;
  const loadedLabel = [
    `${formatNumber(items.length, 0)} transaksi dimuat`,
    data.total_transactions !== null ? ` dari ${formatNumber(data.total_transactions, 0)}` : "",
    filtersActive ? ` · ${formatNumber(shown, 0)} cocok dengan filter` : "",
  ].join("");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <KpiTile
          label="Transaksi"
          value={formatNumber(data.total_transactions ?? items.length, 0)}
          hint={`${formatNumber(items.length, 0)} baris dimuat`}
        />
        <KpiTile label="Nilai transaksi dimuat" value={formatRupiah(loadedAmount)} hint="Tanpa refund penuh" />
      </div>
      {items.length > 0 ? (
        <div className="space-y-2">
          <ChipGroup label="Metode pembayaran" options={paymentOptions} value={payment} onChange={setPayment} />
          <ChipGroup label="Status transaksi" options={statusOptions} value={status} onChange={setStatus} />
        </div>
      ) : null}
      {items.length === 0 ? (
        <EmptyState title="Belum ada transaksi pada periode ini" />
      ) : shown === 0 ? (
        <EmptyState title="Tidak ada transaksi yang cocok dengan filter" body={loadedLabel} />
      ) : (
        <TransactionList days={filtered} onOpen={onOpen} />
      )}
      {more.error ? <ErrorPanel error={more.error} onRetry={more.loadMore} /> : null}
      <LoadMoreFooter hasMore={more.hasMore} isFetching={more.isFetching} onLoadMore={more.loadMore} loadedLabel={loadedLabel} />
    </div>
  );
}

type ListEntry = { kind: "day"; key: string; day: TransactionDay } | { kind: "item"; key: string; item: TransactionItem };

function entryHeight(entry: ListEntry | undefined): number {
  return entry?.kind === "day" ? DAY_HEADER_HEIGHT : TRANSACTION_ROW_HEIGHT;
}

/** Positions of the entries that fit in TRANSACTION_LIST_MAX_HEIGHT, for the render before measuring. */
function firstScreen(entries: readonly ListEntry[]): Array<{ key: string; index: number; start: number }> {
  const out: Array<{ key: string; index: number; start: number }> = [];
  let start = 0;
  for (const [index, entry] of entries.entries()) {
    if (start >= TRANSACTION_LIST_MAX_HEIGHT) break;
    out.push({ key: entry.key, index, start });
    start += entryHeight(entry);
  }
  return out;
}

/** Day-grouped, virtualized list; the header of the day at the top of the scroll box stays pinned. */
function TransactionList({ days, onOpen }: { days: TransactionDay[]; onOpen: (salesId: number) => void }) {
  const entries = useMemo<ListEntry[]>(
    () =>
      days.flatMap((day) => [
        { kind: "day" as const, key: `day-${day.date}`, day },
        ...day.items.map((item) => ({ kind: "item" as const, key: `sale-${item.sales_id}`, item })),
      ]),
    [days],
  );
  const stickyIndexes = useMemo(() => entries.flatMap((entry, index) => (entry.kind === "day" ? [index] : [])), [entries]);
  const activeSticky = useRef<number | null>(null);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);

  // Always render the active day header, even when its own slot has scrolled out of the range.
  const rangeExtractor = useCallback(
    (range: Range) => {
      const active = [...stickyIndexes].reverse().find((index) => range.startIndex >= index);
      activeSticky.current = active ?? null;
      const indexes = defaultRangeExtractor(range);
      return active === undefined ? indexes : [...new Set([active, ...indexes])].sort((a, b) => a - b);
    },
    [stickyIndexes],
  );

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollElement,
    estimateSize: (index) => entryHeight(entries[index]),
    getItemKey: (index) => entries[index]?.key ?? index,
    overscan: 8,
    rangeExtractor,
  });

  // Before the scroll box has a measured height (first paint, or happy-dom without layout) the virtualizer
  // yields no items; show the entries that fit in the maximum height until it measures.
  const measured = virtualizer.getVirtualItems();
  const visible = measured.length > 0 ? measured : firstScreen(entries);

  return (
    <div
      ref={setScrollElement}
      role="region"
      aria-label="Daftar transaksi"
      className="overflow-y-auto rounded-lg border border-line"
      style={{ maxHeight: TRANSACTION_LIST_MAX_HEIGHT }}
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {visible.map((virtual) => {
          const entry = entries[virtual.index];
          if (!entry) return null;
          // The pinned day header stays in flow with position: sticky; every other entry is placed absolutely.
          const pinned = activeSticky.current === virtual.index;
          const position = pinned
            ? { position: "sticky" as const, top: 0 }
            : { position: "absolute" as const, top: 0, transform: `translateY(${virtual.start}px)` };
          if (entry.kind === "day") {
            return (
              <div
                key={virtual.key}
                role="heading"
                aria-level={3}
                className="left-0 flex w-full items-center justify-between gap-2 border-b border-line bg-surface-muted px-3 text-xs font-semibold text-fg"
                style={{ ...position, height: DAY_HEADER_HEIGHT, zIndex: pinned ? 2 : 1 }}
              >
                <span>{formatDate(entry.day.date)}</span>
                <span className="tabular-nums text-fg-muted">{formatRupiah(entry.day.daily_amount)}</span>
              </div>
            );
          }
          const item = entry.item;
          return (
            <button
              key={virtual.key}
              type="button"
              onClick={() => onOpen(item.sales_id)}
              className="left-0 grid w-full grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-line-muted bg-surface px-3 text-left text-sm hover:bg-surface-muted"
              style={{ ...position, height: TRANSACTION_ROW_HEIGHT }}
            >
              <span className="tabular-nums text-fg-muted">{item.time.replace(":", ".")}</span>
              <span className="min-w-0">
                <span className="block truncate text-fg">{item.invoice}</span>
                <span className="block truncate text-xs text-fg-muted">
                  {[item.payment_mode, item.sales_type].filter((part) => part !== "").join(" · ") || "—"}
                </span>
              </span>
              <span className="flex flex-col items-end gap-0.5">
                <span className="tabular-nums text-fg">{formatRupiah(item.amount)}</span>
                <StatusBadge tone={salesStatusTone(item.status)}>{item.status_label}</StatusBadge>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Register the Transaksi route**

In `widgets/src/routes/index.ts`, replace:

```ts
import { pembelianRoute } from "./pembelian";
```

with:

```ts
import { pembelianRoute } from "./pembelian";
import { transaksiRoute } from "./transaksi";
```

and replace:

```ts
export const VIEW_ROUTES: Array<(root: typeof rootRoute) => AnyRoute> = [penjualanRoute, produkRoute, stokRoute, pembelianRoute];
```

with:

```ts
export const VIEW_ROUTES: Array<(root: typeof rootRoute) => AnyRoute> = [penjualanRoute, produkRoute, stokRoute, pembelianRoute, transaksiRoute];
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `bun run widgets:test test/routes/transaksi.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 7: Write the failing Piutang test**

`widgets/test/routes/piutang.test.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolOutput } from "../../../src/widgets/contract";
import { FIXTURES } from "../../dev/fixtures";
import { createWidgetQueryClient } from "../../src/app/queryClient";
import { createWidgetRouter } from "../../src/app/router";
import { BridgeContext } from "../../src/bridge/bridge";
import { createMockBridge, type MockBridge } from "../../src/bridge/mockBridge";
import { collectionMessage, filterDebtCustomers, sortDebtCustomers } from "../../src/routes/piutang";

// 10:00 in Jakarta on 15 Sep 2026.
const NOW = new Date("2026-09-15T03:00:00Z");

function renderAt(path: string, bridge: MockBridge = createMockBridge()) {
  const router = createWidgetRouter({ initialPath: path });
  const view = render(
    <BridgeContext.Provider value={bridge}>
      <QueryClientProvider client={createWidgetQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </BridgeContext.Provider>,
  );
  return { ...view, bridge, router };
}

function callsTo(bridge: MockBridge, name: string) {
  return bridge.calls.filter((call) => call.name === name).map((call) => call.args);
}

/** Customer names in table order (data rows only). */
function tableNames(): string[] {
  const table = screen.getByRole("table", { name: "Pelanggan dengan piutang" });
  return within(table)
    .getAllByRole("row")
    .filter((row) => row.getAttribute("aria-rowindex") !== "1" && within(row).queryAllByRole("cell").length > 1)
    .map((row) => within(row).getAllByRole("cell")[1]!.textContent ?? "");
}

describe("piutang view", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows the reconnect panel without retrying when the Qasir session expired", async () => {
    const bridge = createMockBridge({ failWith: { show_customer_debts: "QASIR_AUTH_EXPIRED" } });
    renderAt("/piutang", bridge);

    expect(await screen.findByText("Sesi Qasir sudah berakhir. Pemilik perlu menghubungkan ulang.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Buka halaman Connect" }));
    expect(bridge.openedLinks).toEqual(["https://widget.example/connect"]);
    expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
    expect(callsTo(bridge, "show_customer_debts")).toHaveLength(1);
  });

  it("shows summary tiles, the aging strip and customers with overdue ones first", async () => {
    const { bridge, container } = renderAt("/piutang");

    expect(await screen.findByText("Sisa piutang (laporan Qasir)")).toBeTruthy();
    expect(callsTo(bridge, "show_customer_debts")).toEqual([{}]);
    for (const label of ["Pelanggan", "Nota terbuka", "Lewat jatuh tempo"]) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    const strip = screen.getByRole("group", { name: "Umur piutang" });
    expect(within(strip).getAllByRole("button")).toHaveLength(8);
    expect(tableNames()).toEqual(["Pelanggan E", "Pelanggan C", "Pelanggan B", "Pelanggan A", "Pelanggan D", "Pelanggan F"]);
    expect(screen.getByText("lewat 200 hari")).toBeTruthy();
    expect(screen.queryByRole("region", { name: /Rincian piutang/ })).toBeNull();
    expect(container.querySelector("form")).toBeNull();
  });

  it("filters by oldest bucket, by name and re-sorts loaded customers", async () => {
    renderAt("/piutang");
    await screen.findByText("Sisa piutang (laporan Qasir)");

    fireEvent.click(within(screen.getByRole("group", { name: "Umur piutang" })).getByRole("button", { name: /^1–3 bulan/ }));
    await waitFor(() => expect(tableNames()).toEqual(["Pelanggan C"]));
    expect(screen.getByText("1 dari 6 pelanggan")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Semua umur/ }));
    await waitFor(() => expect(tableNames()).toHaveLength(6));

    fireEvent.change(screen.getByRole("searchbox", { name: "Cari pelanggan" }), { target: { value: "pelanggan a" } });
    await waitFor(() => expect(tableNames()).toEqual(["Pelanggan A"]), { timeout: 2_000 });

    fireEvent.click(screen.getByRole("button", { name: "Hapus pencarian" }));
    fireEvent.click(screen.getByRole("button", { name: "Nilai kredit terbesar" }));
    await waitFor(() => expect(tableNames()[0]).toBe("Pelanggan A"));
    fireEvent.click(screen.getByRole("button", { name: "Nota terlama" }));
    await waitFor(() => expect(tableNames()[0]).toBe("Pelanggan F"));
  });

  it("pre-expands focus_customer_id with phone, totals, invoices and payments", async () => {
    const scrolled = vi.spyOn(Element.prototype, "scrollIntoView");
    const { bridge } = renderAt("/piutang?customer_id=3002");

    const panel = await screen.findByRole("region", { name: "Rincian piutang Pelanggan B" });
    expect(scrolled).not.toHaveBeenCalled();
    expect(await within(panel).findByText("Telepon: 0800-0000-0002")).toBeTruthy();
    expect(callsTo(bridge, "show_customer_debts")).toEqual([{ customer_id: 3002 }]);
    expect(callsTo(bridge, "customer_debt_detail")).toEqual([{ customer_id: 3002 }]);
    expect(within(panel).getByText("INV/KREDIT/3002-1")).toBeTruthy();
    expect(within(panel).getByText("Lewat 40 hari")).toBeTruthy();
    expect(within(panel).getAllByText(/^Tunai · /)).toHaveLength(2);

    fireEvent.click(within(panel).getByRole("button", { name: "Tutup rincian" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: /Rincian piutang/ })).toBeNull());
  });

  it("opens a customer's detail on row click, scrolls it into view and closes it on a second click", async () => {
    const scrolled = vi.spyOn(Element.prototype, "scrollIntoView");
    const { bridge } = renderAt("/piutang");
    await screen.findByText("Sisa piutang (laporan Qasir)");

    fireEvent.click(screen.getByText("Pelanggan E"));
    const panel = await screen.findByRole("region", { name: "Rincian piutang Pelanggan E" });
    expect(callsTo(bridge, "customer_debt_detail")).toEqual([{ customer_id: 3005 }]);
    expect(scrolled).toHaveBeenCalledTimes(1);
    expect(scrolled).toHaveBeenCalledWith({ block: "nearest" });
    expect(scrolled.mock.contexts[0]).toBe(panel);

    fireEvent.click(screen.getAllByText("Pelanggan E")[0]!);
    await waitFor(() => expect(screen.queryByRole("region", { name: /Rincian piutang/ })).toBeNull());
  });

  it("asks Claude for a collection message without the phone number", async () => {
    const { bridge } = renderAt("/piutang?customer_id=3002");
    const panel = await screen.findByRole("region", { name: "Rincian piutang Pelanggan B" });

    fireEvent.click(await within(panel).findByRole("button", { name: "Minta Claude buat pesan penagihan" }));

    await waitFor(() => expect(bridge.sentMessages).toHaveLength(1));
    const message = bridge.sentMessages[0]!;
    expect(message).toContain("Pelanggan B");
    expect(message).toContain("INV/KREDIT/3002-1");
    expect(message).toContain("sisa Rp 150.000");
    expect(message).toContain("jatuh tempo");
    expect(message).not.toContain("0800");
    expect(await within(panel).findByText("Permintaan dikirim ke Claude.")).toBeTruthy();
  });

  it("hides the message button when the host cannot send messages", async () => {
    renderAt("/piutang?customer_id=3002", createMockBridge({ host: { canSendMessage: false } }));
    const panel = await screen.findByRole("region", { name: "Rincian piutang Pelanggan B" });
    expect(await within(panel).findByRole("button", { name: "Lihat semua transaksi" })).toBeTruthy();
    expect(within(panel).queryByRole("button", { name: "Minta Claude buat pesan penagihan" })).toBeNull();
  });

  it("links to the customer's transactions for the last 365 days", async () => {
    const { bridge, router } = renderAt("/piutang?customer_id=3002");
    const panel = await screen.findByRole("region", { name: "Rincian piutang Pelanggan B" });

    fireEvent.click(await within(panel).findByRole("button", { name: "Lihat semua transaksi" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/transaksi"));
    expect(await screen.findByRole("button", { name: "Hapus filter pelanggan" })).toBeTruthy();
    expect(callsTo(bridge, "show_transactions")).toEqual([{ start_date: "2025-09-16", end_date: "2026-09-15", customer_id: 3002 }]);
  });
});

describe("piutang helpers", () => {
  const debts = FIXTURES.show_customer_debts({});

  it("sorts and filters loaded customers", () => {
    expect(sortDebtCustomers(debts.customers, "credit").map((c) => c.name)).toEqual([
      "Pelanggan A",
      "Pelanggan B",
      "Pelanggan C",
      "Pelanggan D",
      "Pelanggan E",
      "Pelanggan F",
    ]);
    expect(filterDebtCustomers(debts.customers, "  PELANGGAN d ", undefined).map((c) => c.name)).toEqual(["Pelanggan D"]);
    expect(filterDebtCustomers(debts.customers, "", "gt-730").map((c) => c.name)).toEqual(["Pelanggan F"]);
  });

  it("lists only invoices with a remaining balance in the collection message", () => {
    const detail: ToolOutput<"customer_debt_detail"> = {
      ...FIXTURES.customer_debt_detail({ customer_id: 3001 }),
      invoices: [
        { ...FIXTURES.customer_debt_detail({ customer_id: 3001 }).invoices[0]!, invoice: "INV-LUNAS", remaining: 0 },
        { ...FIXTURES.customer_debt_detail({ customer_id: 3001 }).invoices[1]!, invoice: "INV-SISA", due_date: null, days_overdue: null },
      ],
    };
    const message = collectionMessage(detail);
    expect(message).not.toContain("INV-LUNAS");
    expect(message).toContain("- Nota INV-SISA");
    expect(message).toContain("tanpa tanggal jatuh tempo");
    expect(message).not.toMatch(/\u00a0/);
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `bun run widgets:test test/routes/piutang.test.tsx`
Expected: FAIL with `Failed to resolve import "../../src/routes/piutang" from "widgets/test/routes/piutang.test.tsx". Does the file exist?`

- [ ] **Step 9: Implement the Piutang route**

`widgets/src/routes/piutang.tsx`:

```tsx
import { createRoute, useNavigate, useSearch, type AnyRoute } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AGING_BUCKET_LABEL, type AgingBucketKey, type ToolInput, type ToolOutput } from "../../../src/widgets/contract";
import type { rootRoute } from "../app/router";
import { DEBT_SORTS, piutangSearch, searchFromToolArgs, toolArgsFromSearch, type DebtSort } from "../app/search";
import { VIEW_PATH } from "../app/viewPaths";
import { useBridge } from "../bridge/bridge";
import { useToolQuery } from "../bridge/useToolQuery";
import { ChipGroup, type ChipOption } from "../components/ChipGroup";
import { DataTable, dataColumnHelper } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorPanel } from "../components/ErrorPanel";
import { KpiTile } from "../components/KpiTile";
import { SearchInput } from "../components/SearchInput";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import { ViewFrame } from "../components/ViewFrame";
import { buttonClass, cx } from "../components/ui";
import { jakartaTodayBrowser } from "../lib/dates";
import { formatDate, formatDateTime, formatNumber, formatRupiah } from "../lib/format";
import { customerTransactionsArgs } from "./transaksi";
import { useModelContext, viewSubtitle } from "./viewHelpers";

type DebtsData = ToolOutput<"show_customer_debts">;
type DebtsArgs = ToolInput<"show_customer_debts">;
export type DebtCustomer = DebtsData["customers"][number];
type DebtDetail = ToolOutput<"customer_debt_detail">;

export const DEBT_SORT_LABEL: Record<DebtSort, string> = {
  overdue: "Lewat jatuh tempo",
  credit: "Nilai kredit terbesar",
  oldest: "Nota terlama",
};

const SORT_OPTIONS: ChipOption<DebtSort>[] = DEBT_SORTS.map((sort) => ({ value: sort, label: DEBT_SORT_LABEL[sort] }));

/** Loaded customers in the chosen order: overdue first (most days late, then credit), credit desc, or oldest sale first. */
export function sortDebtCustomers(rows: readonly DebtCustomer[], sort: DebtSort): DebtCustomer[] {
  const byCredit = (a: DebtCustomer, b: DebtCustomer) => b.credit_total - a.credit_total || a.name.localeCompare(b.name, "id");
  const copy = [...rows];
  switch (sort) {
    case "overdue":
      return copy.sort(
        (a, b) =>
          Number(b.overdue_invoices > 0) - Number(a.overdue_invoices > 0) || b.max_days_overdue - a.max_days_overdue || byCredit(a, b),
      );
    case "credit":
      return copy.sort(byCredit);
    case "oldest":
      return copy.sort((a, b) => a.oldest_sale_date.localeCompare(b.oldest_sale_date) || byCredit(a, b));
  }
}

/** Case-insensitive name filter plus the oldest-bucket filter, over loaded customers. */
export function filterDebtCustomers(rows: readonly DebtCustomer[], text: string, bucket: AgingBucketKey | undefined): DebtCustomer[] {
  const needle = text.trim().toLocaleLowerCase("id");
  return rows.filter(
    (row) => (bucket === undefined || row.oldest_bucket === bucket) && (needle === "" || row.name.toLocaleLowerCase("id").includes(needle)),
  );
}

/** Prompt for "Minta Claude buat pesan penagihan": customer name, open invoices, remaining and due dates. Never the phone number. */
export function collectionMessage(detail: DebtDetail): string {
  const money = (n: number) => formatRupiah(n).replace(/\u00a0/g, " ");
  const open = detail.invoices.filter((invoice) => invoice.remaining > 0);
  const lines = open.map((invoice) => {
    const due = invoice.due_date ? `jatuh tempo ${formatDate(invoice.due_date)}` : "tanpa tanggal jatuh tempo";
    const late = invoice.days_overdue !== null && invoice.days_overdue > 0 ? `, lewat ${invoice.days_overdue} hari` : "";
    return `- Nota ${invoice.invoice} (${formatDate(invoice.sale_date)}): sisa ${money(invoice.remaining)}, ${due}${late}`;
  });
  return [
    `Tolong buatkan pesan penagihan yang sopan dan singkat dalam Bahasa Indonesia untuk pelanggan ${detail.customer.name}.`,
    `Total sisa piutang ${money(detail.totals.remaining)} dari ${open.length} nota:`,
    ...lines,
    "Sebutkan nomor nota, sisa tagihan dan tanggal jatuh temponya. Jangan menambahkan data lain.",
  ].join("\n");
}

/** The customer whose detail is open; read by the expand-indicator cells. */
const OpenCustomerContext = createContext<number | null>(null);

function ExpandIndicator({ customerId }: { customerId: number }) {
  const open = useContext(OpenCustomerContext) === customerId;
  return (
    <span className="text-fg-muted">
      <span aria-hidden="true">{open ? "▾" : "▸"}</span>
      <span className="sr-only">{open ? "Rincian dibuka" : "Buka rincian"}</span>
    </span>
  );
}

const col = dataColumnHelper<DebtCustomer>();
const columns = col.columns([
  col.display({
    id: "rincian",
    header: () => <span className="sr-only">Rincian</span>,
    cell: ({ row }) => <ExpandIndicator customerId={row.original.customer_id} />,
    meta: { minWidth: 36, grow: 0 },
  }),
  col.accessor("name", { header: "Pelanggan", meta: { minWidth: 160, grow: 2 } }),
  col.accessor("invoices", { header: "Nota", cell: (info) => formatNumber(info.getValue(), 0), meta: { align: "right", minWidth: 64 } }),
  col.accessor("credit_total", {
    header: "Nilai kredit",
    cell: (info) => formatRupiah(info.getValue()),
    meta: { align: "right", minWidth: 128 },
  }),
  col.accessor("oldest_sale_date", {
    header: "Nota tertua",
    cell: ({ row }) => (
      <span>
        {formatDate(row.original.oldest_sale_date)}
        <span className="block text-xs text-fg-muted">{AGING_BUCKET_LABEL[row.original.oldest_bucket]}</span>
      </span>
    ),
    meta: { minWidth: 120 },
  }),
  col.accessor((row) => row.nearest_due_date ?? "", {
    id: "nearest_due_date",
    header: "Jatuh tempo terdekat",
    cell: ({ row }) => (
      <span>
        {row.original.nearest_due_date ? formatDate(row.original.nearest_due_date) : "—"}
        {row.original.max_days_overdue > 0 ? (
          <span className="block text-xs font-medium text-danger">lewat {formatNumber(row.original.max_days_overdue, 0)} hari</span>
        ) : null}
      </span>
    ),
    meta: { minWidth: 140 },
  }),
]);

export function piutangRoute(root: typeof rootRoute): AnyRoute {
  return createRoute({
    getParentRoute: () => root,
    path: VIEW_PATH.piutang,
    validateSearch: piutangSearch,
    component: PiutangPage,
  });
}

function PiutangPage() {
  const search = piutangSearch.parse(useSearch({ strict: false }));
  const navigate = useNavigate();
  const today = jakartaTodayBrowser();
  const args = toolArgsFromSearch("piutang", search, today) as DebtsArgs;
  const query = useToolQuery("show_customer_debts", args);
  useModelContext("piutang", { ...args, bucket: search.bucket, sort: search.sort });

  // bucket and sort are view-only filters: they change the search, not the tool arguments.
  const setFilters = (next: { bucket: AgingBucketKey | undefined; sort: DebtSort }) => {
    void navigate({
      to: VIEW_PATH.piutang,
      search: { ...searchFromToolArgs("piutang", args, today), sort: next.sort, ...(next.bucket ? { bucket: next.bucket } : {}) },
    });
  };
  const showTransactions = (customerId: number) => {
    void navigate({
      to: VIEW_PATH.transaksi,
      search: searchFromToolArgs("transaksi", customerTransactionsArgs(customerId, today, args.outlet_id), today),
    });
  };

  return (
    <ViewFrame title="Piutang" subtitle={query.data ? viewSubtitle(query.data) : undefined}>
      {query.isPending ? (
        <Skeleton rows={6} note="Memuat piutang dari Qasir, bisa sampai 30 detik…" />
      ) : query.isError ? (
        <ErrorPanel
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <DebtsPanel
          data={query.data}
          bucket={search.bucket}
          sort={search.sort}
          outletId={args.outlet_id}
          onFiltersChange={setFilters}
          onShowTransactions={showTransactions}
        />
      )}
    </ViewFrame>
  );
}

function DebtsPanel({
  data,
  bucket,
  sort,
  outletId,
  onFiltersChange,
  onShowTransactions,
}: {
  data: DebtsData;
  bucket: AgingBucketKey | undefined;
  sort: DebtSort;
  outletId: string | undefined;
  onFiltersChange: (next: { bucket: AgingBucketKey | undefined; sort: DebtSort }) => void;
  onShowTransactions: (customerId: number) => void;
}) {
  const [text, setText] = useState("");
  // undefined until the user opens or closes a row, so the tool's focus_customer_id starts expanded.
  const [chosenId, setChosenId] = useState<number | null | undefined>(undefined);
  const openId = chosenId === undefined ? data.focus_customer_id : chosenId;
  const rows = useMemo(() => sortDebtCustomers(filterDebtCustomers(data.customers, text, bucket), sort), [data.customers, text, bucket, sort]);
  const openName = data.customers.find((customer) => customer.customer_id === openId)?.name ?? null;
  const summary = data.summary;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiTile label="Sisa piutang (laporan Qasir)" value={formatRupiah(summary.receivable_total)} hint={`Per ${formatDate(data.as_of)}`} />
        <KpiTile label="Pelanggan" value={formatNumber(summary.customers, 0)} />
        <KpiTile label="Nota terbuka" value={formatNumber(summary.open_invoices, 0)} hint={`Nilai kredit ${formatRupiah(summary.credit_total)}`} />
        <KpiTile
          label="Lewat jatuh tempo"
          value={`${formatNumber(summary.overdue_invoices, 0)} nota`}
          hint={`${formatNumber(summary.overdue_customers, 0)} pelanggan`}
        />
      </div>

      <div role="group" aria-label="Umur piutang" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          aria-pressed={bucket === undefined}
          onClick={() => onFiltersChange({ bucket: undefined, sort })}
          className={bucketClass(bucket === undefined)}
        >
          <span className="block font-medium">Semua umur</span>
          <span className="block text-xs text-fg-muted">{formatNumber(summary.open_invoices, 0)} nota</span>
        </button>
        {data.buckets.map((item) => {
          const active = bucket === item.key;
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={active}
              onClick={() => onFiltersChange({ bucket: active ? undefined : item.key, sort })}
              className={bucketClass(active)}
            >
              <span className="block font-medium">{item.label}</span>
              <span className="block tabular-nums">{formatRupiah(item.receivable)}</span>
              <span className="block text-xs text-fg-muted">
                {formatNumber(item.invoices, 0)} nota · {formatNumber(item.customers, 0)} pelanggan
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-48 flex-1">
          <SearchInput value={text} onChange={setText} placeholder="Cari pelanggan" />
        </div>
        <ChipGroup label="Urutkan" options={SORT_OPTIONS} value={sort} onChange={(next) => onFiltersChange({ bucket, sort: next })} />
      </div>

      {data.customers.length === 0 ? (
        <EmptyState title="Tidak ada piutang terbuka" body="Semua penjualan kredit sudah lunas." />
      ) : (
        <OpenCustomerContext.Provider value={openId}>
          <DataTable
            label="Pelanggan dengan piutang"
            rows={rows}
            columns={columns}
            getRowId={(row) => String(row.customer_id)}
            onRowClick={(row) => setChosenId(row.customer_id === openId ? null : row.customer_id)}
            emptyText="Tidak ada pelanggan yang cocok dengan filter"
            footer={
              <p className="text-xs text-fg-muted" aria-live="polite">
                {formatNumber(rows.length, 0)} dari {formatNumber(data.customers.length, 0)} pelanggan
              </p>
            }
          />
        </OpenCustomerContext.Provider>
      )}

      {openId !== null ? (
        <CustomerDebtPanel
          key={openId}
          customerId={openId}
          name={openName}
          outletId={outletId}
          revealOnOpen={chosenId !== undefined}
          onClose={() => setChosenId(null)}
          onShowTransactions={onShowTransactions}
        />
      ) : null}
    </div>
  );
}

function bucketClass(active: boolean): string {
  return cx(
    "min-w-32 shrink-0 rounded-lg border px-3 py-2 text-left text-sm",
    active ? "border-transparent bg-info-soft text-info" : "border-line bg-surface text-fg hover:bg-surface-muted",
  );
}

/**
 * The expanded customer: phone, totals, invoices with payments, and the follow-up actions.
 * It renders below the table, so a panel the user opens is scrolled into view (revealOnOpen);
 * the pre-expanded focus_customer_id panel is not, so the view never scrolls without a click.
 */
function CustomerDebtPanel({
  customerId,
  name,
  outletId,
  revealOnOpen,
  onClose,
  onShowTransactions,
}: {
  customerId: number;
  name: string | null;
  outletId: string | undefined;
  revealOnOpen: boolean;
  onClose: () => void;
  onShowTransactions: (customerId: number) => void;
}) {
  const bridge = useBridge();
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (revealOnOpen) sectionRef.current?.scrollIntoView({ block: "nearest" });
  }, [revealOnOpen]);
  const query = useToolQuery("customer_debt_detail", outletId ? { customer_id: customerId, outlet_id: outletId } : { customer_id: customerId });
  const [messageState, setMessageState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const title = `Rincian piutang ${query.data?.customer.name ?? name ?? `pelanggan #${customerId}`}`;

  return (
    <section ref={sectionRef} aria-label={title} className="space-y-3 rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        <button type="button" className={buttonClass} onClick={onClose}>
          Tutup rincian
        </button>
      </div>
      {query.isPending ? (
        <Skeleton rows={4} note="Memuat nota dan pembayaran…" />
      ) : query.isError ? (
        <ErrorPanel
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <p className="text-sm text-fg-muted">
            {query.data.customer.mobile ? `Telepon: ${query.data.customer.mobile}` : "Nomor telepon tidak tersedia"}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <KpiTile label="Total" value={formatRupiah(query.data.totals.total)} />
            <KpiTile label="Dibayar" value={formatRupiah(query.data.totals.paid)} />
            <KpiTile label="Sisa" value={formatRupiah(query.data.totals.remaining)} />
          </div>
          {query.data.truncated ? (
            <p className="text-xs text-warning">Sebagian nota tidak dimuat karena terlalu banyak. Angka di atas hanya untuk nota yang dimuat.</p>
          ) : null}
          <InvoiceList detail={query.data} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={buttonClass} onClick={() => onShowTransactions(customerId)}>
              Lihat semua transaksi
            </button>
            {bridge.host.canSendMessage ? (
              <button
                type="button"
                className={buttonClass}
                disabled={messageState === "sending"}
                onClick={() => {
                  setMessageState("sending");
                  bridge
                    .sendMessage(collectionMessage(query.data))
                    .then(() => setMessageState("sent"))
                    .catch(() => setMessageState("failed"));
                }}
              >
                Minta Claude buat pesan penagihan
              </button>
            ) : null}
            <span className="text-xs text-fg-muted" aria-live="polite">
              {messageState === "sent" ? "Permintaan dikirim ke Claude." : messageState === "failed" ? "Gagal mengirim permintaan." : ""}
            </span>
          </div>
        </>
      )}
    </section>
  );
}

function InvoiceList({ detail }: { detail: DebtDetail }) {
  if (detail.invoices.length === 0) return <EmptyState title="Tidak ada nota terbuka untuk pelanggan ini" />;
  return (
    <ul className="space-y-2">
      {detail.invoices.map((invoice) => (
        <li key={invoice.sales_id} className="rounded-md border border-line-muted p-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-fg">{invoice.invoice}</span>
            {invoice.days_overdue !== null && invoice.days_overdue > 0 ? (
              <StatusBadge tone="danger">Lewat {formatNumber(invoice.days_overdue, 0)} hari</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">{AGING_BUCKET_LABEL[invoice.bucket]}</StatusBadge>
            )}
          </div>
          <p className="text-xs text-fg-muted">
            Tanggal {formatDate(invoice.sale_date)} · Jatuh tempo {invoice.due_date ? formatDate(invoice.due_date) : "—"}
          </p>
          <dl className="mt-1 grid grid-cols-3 gap-2 tabular-nums">
            <div>
              <dt className="text-xs text-fg-muted">Total</dt>
              <dd>{formatRupiah(invoice.total)}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">Dibayar</dt>
              <dd>{formatRupiah(invoice.paid)}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">Sisa</dt>
              <dd className="font-semibold text-danger">{formatRupiah(invoice.remaining)}</dd>
            </div>
          </dl>
          {invoice.payments.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-xs text-fg-muted">
              {invoice.payments.map((payment, index) => (
                <li key={`${invoice.sales_id}-${index}`} className="flex justify-between gap-2">
                  <span>
                    {payment.name || "Pembayaran"}
                    {payment.paid_at ? ` · ${formatDateTime(payment.paid_at)}` : ""}
                  </span>
                  <span className="tabular-nums">{formatRupiah(payment.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-fg-muted">Belum ada pembayaran.</p>
          )}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 10: Register the Piutang route**

In `widgets/src/routes/index.ts`, replace:

```ts
import { transaksiRoute } from "./transaksi";
```

with:

```ts
import { transaksiRoute } from "./transaksi";
import { piutangRoute } from "./piutang";
```

and replace:

```ts
export const VIEW_ROUTES: Array<(root: typeof rootRoute) => AnyRoute> = [penjualanRoute, produkRoute, stokRoute, pembelianRoute, transaksiRoute];
```

with:

```ts
export const VIEW_ROUTES: Array<(root: typeof rootRoute) => AnyRoute> = [penjualanRoute, produkRoute, stokRoute, pembelianRoute, transaksiRoute, piutangRoute];
```

- [ ] **Step 11: Run every widget test and the widget types**

Run: `bun run widgets:test && bun run widgets:check-types`
Expected: every widget test file PASSES, including `routes/transaksi.test.tsx` (7) and `routes/piutang.test.tsx` (10); `tsc` exits 0.

- [ ] **Step 12: Regenerate the bundle and run the Worker-side checks**

Run: `bun run widgets:bundle && bun run test tests/unit/widgets-bundle.test.ts && bun run check-types`
Expected:
- `Wrote src/widgets/bundled.ts (… chars, source hash …)`. With all six views the bundle is about 785,000 characters, under the 1 MB limit.
- The bundle test PASSES.
- All three `tsc` projects exit 0.

- [ ] **Step 13: Record the Piutang expansion in the spec**

In `docs/superpowers/specs/2026-09-15-mcp-app-widgets-design.md` (§5, **Piutang.**), replace:

````md
  - Row expand loads `customer_debt_detail`: phone, totals (Total · Dibayar · Sisa), per-invoice rows with payments, plus buttons:
    - "Lihat semua transaksi" (Transaksi, `customer_id`, last 365 days)
    - "Minta Claude buat pesan penagihan" (`sendMessage` with name, invoices, remaining; user-initiated)
````

with:

````md
  - Row click expands the customer (▸/▾ indicator; the tool's `customer_id` starts expanded) and loads `customer_debt_detail`: phone, totals (Total · Dibayar · Sisa), per-invoice rows with payments, plus buttons:
    - "Lihat semua transaksi" (Transaksi, `customer_id`, last 365 days)
    - "Minta Claude buat pesan penagihan" (`sendMessage` with name, invoices, remaining; user-initiated)
  - The expanded detail is a panel directly below the table, not an inline row, because DataTable has no controlled expansion. A panel the user opens scrolls into view (`scrollIntoView({ block: "nearest" })`); the pre-expanded one does not scroll.
````

Run: `grep -c "The expanded detail is a panel directly below the table" docs/superpowers/specs/2026-09-15-mcp-app-widgets-design.md`
Expected: `1`.

- [ ] **Step 14: Commit**

```bash
git add widgets/src/components/OrderDetailSheet.tsx widgets/src/routes/transaksi.tsx widgets/src/routes/piutang.tsx widgets/src/routes/index.ts widgets/test/routes/transaksi.test.tsx widgets/test/routes/piutang.test.tsx src/widgets/bundled.ts docs/superpowers/specs/2026-09-15-mcp-app-widgets-design.md
git commit -m "feat(widgets): Transaksi list with order detail and Piutang aging views

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Widget smoke test and live E2E checks

**Files:**
- Create: `scripts/widgets-smoke-host.ts` (browser side of the smoke test, bundled on the fly and never shipped)
- Create: `scripts/widgets-smoke.ts`
- Modify: `scripts/e2e-mcp.ts` (widget tool and resource checks; `--live` calls each view tool)
- Modify: `package.json` (devDependency `playwright-core` 1.63.0, script `widgets:smoke`), `bun.lock`
- Modify: `src/widgets/bundled.ts` (regenerated: `package.json` and `bun.lock` are bundle source-hash inputs)

**Prerequisites:** T11 and T14 are committed (lanes: T11 → T15 → T16). The smoke landmarks come from the T12–T14 views and the transaksi pager; a view that is not registered yet renders "Tampilan belum tersedia", so `bun run widgets:smoke` fails before T14.

**Interfaces:**
- Consumes:
  - T1 (`src/widgets/contract.ts`): `VIEWS`, `VIEW_TOOL`, `APP_TOOL`, `WIDGET_TOOL_NAMES`, `TOOL_SCHEMAS`, `STRUCTURED_MAX_CHARS`, `MCP_APP_MIME_TYPE`, `viewResourceUri`, `type ToolName`, `type ToolInput`, `type ViewName`.
  - T1 (`src/widgets/qasir-dates.ts`): `jakartaToday`, `addDays`.
  - T8:
    - `FIXTURES` and `SAMPLE_ARGS` from `widgets/dev/fixtures.ts`; `VIEW_LABEL` from `widgets/src/app/viewPaths.ts`.
    - `AppShell` behaviour: it waits for `toolinput`, then primes the opening query with the host's `toolresult`.
  - T10: `WIDGET_HTML` and `WIDGET_SOURCE_HASH` (`src/widgets/bundled.ts`), `computeWidgetSourceHash(root)` (`scripts/lib/widget-source-hash.ts`), `bun run widgets:bundle`.
  - T11: `renderViewHtml(html, view)` (`src/widgets/resources.ts`); tool `_meta.ui`, the six `ui://` resources, `ENABLE_WIDGETS`.
  - T12–T14 view output, used as smoke landmarks:
    - Every view: the `h1` equals `VIEW_LABEL[view]`.
    - Fixture text for the `SAMPLE_ARGS` call: penjualan "Tunai", produk "Produk 1", stok "Kopi 3 - Reguler", pembelian "PO-2026-0001", transaksi "INV/20260915/0000", piutang "Pelanggan E".
    - Transaksi: the "Muat lebih banyak" button and the "`N` transaksi dimuat" label.
  - ext-apps `AppBridge` and `PostMessageTransport` (`@modelcontextprotocol/ext-apps/app-bridge`); `CallToolResult` (`@modelcontextprotocol/client`); `build` (`vite`); `chromium` (`playwright-core`).
- Produces:
  - `bun run widgets:smoke`.
  - `scripts/widgets-smoke-host.ts`: `interface SmokeMountOptions { html: string; tool: ToolName; args: Record<string, unknown> }`; `interface SmokeHost { calls; events; mount(options): Promise<void> }`; `window.__smoke`.
  - `scripts/e2e-mcp.ts`: the `--stock-search <fragment>` option (default `a`), plus widget checks with and without `--live`.

Decisions this task fixes:
- **Browser.** `playwright-core` drives the installed Google Chrome (`channel: "chrome"`), as the toolchain probe did. `CHROME_PATH` overrides it. No browser is downloaded.
- **Host page.** It is `scripts/widgets-smoke-host.ts`, bundled by Vite's `build()` into an IIFE in memory and injected with `page.addScriptTag`. The page itself is `page.setContent`, so it has no URL and needs no server.
- **Type checking.** The host file starts with `/// <reference lib="dom" />`, which adds DOM types to the `tsconfig.scripts.json` program (verified: `bun run check-types` exits 0). It lives in `scripts/`, not `widgets/`, so it is not a bundle hash input.
- **Network detection.** Chrome does not report requests from a sandboxed `srcdoc` frame to Playwright; a probe with `page.on("request")` and a CDP session saw nothing. The smoke test therefore:
  - adds the MCP Apps default host CSP (`connect-src 'none'` and so on) to the view HTML;
  - records `securitypolicyviolation` events that carry a URL, plus resource-timing entries, inside the frame;
  - counts CSP console errors as failures.

  Step 7 proves that an injected image and a `fetch` are both caught. zod's guarded `Function("")` probe reports a violation with `blockedURI: "eval"`; it is not a request and is ignored.
- **Opening tool call.** The host delivers `toolinput` and `toolresult` right after `ui/initialize`. The test asserts that the view never calls its own view tool again.

- [ ] **Step 1: Add the browser driver and the script entry**

Run: `bun add -d --exact playwright-core@1.63.0`
Expected: `installed playwright-core@1.63.0` and `Saved lockfile`. `devDependencies` gains `"playwright-core": "1.63.0",` between `happy-dom` and `react`.

In `package.json`, replace:

```json
    "widgets:bundle": "bun run scripts/bundle-widgets.ts"
  },
```

with:

```json
    "widgets:bundle": "bun run scripts/bundle-widgets.ts",
    "widgets:smoke": "bun run scripts/widgets-smoke.ts"
  },
```

- [ ] **Step 2: Run the smoke test to verify it fails**

Run: `bun run widgets:smoke`
Expected: FAIL with `error: Module not found "scripts/widgets-smoke.ts"`.

- [ ] **Step 3: Write the smoke host page script**

`scripts/widgets-smoke-host.ts`:

```ts
/// <reference lib="dom" />
/**
 * Browser side of scripts/widgets-smoke.ts (bundled into an IIFE, never shipped).
 * Plays the MCP Apps host: mounts one widget view in <iframe sandbox="allow-scripts">, connects an
 * ext-apps AppBridge over postMessage, delivers the opening tool call (toolinput + toolresult) and
 * answers every tools/call from widgets/dev/fixtures.ts.
 */
import type { CallToolResult } from "@modelcontextprotocol/client";
import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";
import { TOOL_SCHEMAS, type ToolName } from "../src/widgets/contract";
import { FIXTURES } from "../widgets/dev/fixtures";

export interface SmokeMountOptions {
  html: string;
  tool: ToolName;
  args: Record<string, unknown>;
}

export interface SmokeHost {
  /** tools/call requests the widget sent, in order. */
  calls: Array<{ name: string; arguments: Record<string, unknown> }>;
  /** Host-side lifecycle events ("initialized", "toolinput", "toolresult", "message", "openlink", "error: …"). */
  events: string[];
  mount(options: SmokeMountOptions): Promise<void>;
}

declare global {
  interface Window {
    __smoke: SmokeHost;
  }
}

function isToolName(name: string): name is ToolName {
  return Object.hasOwn(TOOL_SCHEMAS, name);
}

/** The result a real server would return: fixture structuredContent, or the SDK's input-validation error text. */
function answer(name: string, args: Record<string, unknown>): CallToolResult {
  if (!isToolName(name)) {
    return { isError: true, content: [{ type: "text", text: JSON.stringify({ code: "UNSUPPORTED_OPERATION", message: `Unknown tool ${name}` }) }] };
  }
  const input = TOOL_SCHEMAS[name].input.safeParse(args);
  if (!input.success) {
    return { isError: true, content: [{ type: "text", text: `Input validation error: Invalid arguments for tool ${name}` }] };
  }
  const fixture = FIXTURES[name] as (fixtureArgs: unknown) => Record<string, unknown>;
  return { content: [{ type: "text", text: `Fixture result for ${name}` }], structuredContent: fixture(input.data) };
}

const host: SmokeHost = {
  calls: [],
  events: [],
  async mount({ html, tool, args }) {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.title = "Widget";
    iframe.style.cssText = "width: 820px; height: 1400px; border: 0;";
    document.body.appendChild(iframe);
    const target = iframe.contentWindow;
    if (!target) throw new Error("iframe has no contentWindow");

    const bridge = new AppBridge(
      null,
      { name: "manujujaya-widgets-smoke", version: "1.0.0" },
      { serverTools: {}, openLinks: {}, message: { text: {} }, updateModelContext: { text: {} } },
      {
        hostContext: {
          theme: "light",
          displayMode: "inline",
          availableDisplayModes: ["inline"],
          locale: "id-ID",
          timeZone: "Asia/Jakarta",
          platform: "web",
        },
      },
    );
    bridge.oncalltool = async (params) => {
      const callArgs = (params.arguments ?? {}) as Record<string, unknown>;
      host.calls.push({ name: params.name, arguments: callArgs });
      return answer(params.name, callArgs);
    };
    bridge.onopenlink = async () => {
      host.events.push("openlink");
      return {};
    };
    bridge.onmessage = async () => {
      host.events.push("message");
      return {};
    };
    bridge.onupdatemodelcontext = async () => ({});
    bridge.onrequestdisplaymode = async () => ({ mode: "inline" });
    bridge.oninitialized = () => {
      host.events.push("initialized");
      void (async () => {
        await bridge.sendToolInput({ arguments: args });
        host.events.push("toolinput");
        await bridge.sendToolResult(answer(tool, args));
        host.events.push("toolresult");
      })().catch((err: unknown) => host.events.push(`error: ${String(err)}`));
    };

    // The transport listens before the frame loads, so the widget's ui/initialize is never missed.
    await bridge.connect(new PostMessageTransport(target, target));
    iframe.srcdoc = html;
  },
};

window.__smoke = host;
```

- [ ] **Step 4: Write the smoke test**

`scripts/widgets-smoke.ts`:

```ts
/**
 * Smoke test of the committed widget bundle in a real browser:
 *
 *   bun run widgets:smoke                 # uses installed Google Chrome (playwright-core channel "chrome")
 *   CHROME_PATH=/path/to/chrome bun run widgets:smoke
 *
 * For each view it renders renderViewHtml(WIDGET_HTML, view) inside <iframe sandbox="allow-scripts">
 * (opaque origin, no forms, no storage) with the hosts' default CSP, under an ext-apps AppBridge host page
 * that answers tools/call from widgets/dev/fixtures.ts. It asserts the view's landmark text, no <form>, no
 * repeated opening tool call, no console errors or page errors, and zero network requests; the transaksi
 * view also round-trips one transactions_page call. It never contacts Qasir or the Worker.
 */
import path from "node:path";
import { chromium, type Frame, type Page } from "playwright-core";
import { build } from "vite";
import { WIDGET_HTML, WIDGET_SOURCE_HASH } from "../src/widgets/bundled";
import { VIEW_TOOL, VIEWS, type ViewName } from "../src/widgets/contract";
import { renderViewHtml } from "../src/widgets/resources";
import { VIEW_LABEL } from "../widgets/src/app/viewPaths";
import { SAMPLE_ARGS } from "../widgets/dev/fixtures";
import { computeWidgetSourceHash } from "./lib/widget-source-hash";
import type { SmokeHost, SmokeMountOptions } from "./widgets-smoke-host";

const ROOT = path.resolve(import.meta.dirname, "..");
const VIEW_TIMEOUT_MS = 20_000;

/**
 * The restrictive CSP MCP Apps hosts apply when a resource declares no domains (ext-apps spec 2026-01-26).
 * Chrome does not report requests from sandboxed srcdoc frames to Playwright, so network attempts are
 * caught inside the frame instead: blocked ones fire securitypolicyviolation, allowed ones leave
 * resource-timing entries. Violations without a URL (zod's guarded eval probe reports "eval") are not requests.
 */
const HOST_DEFAULT_CSP =
  "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' data:; connect-src 'none'";
const NETWORK_PROBE =
  '<script>window.__mjNetwork=[];document.addEventListener("securitypolicyviolation",function(e){if(!/^(eval|inline|wasm-eval|trusted-types-sink)$/.test(e.blockedURI))window.__mjNetwork.push(e.effectiveDirective+" "+e.blockedURI)});</script>';

/** The view HTML as a host would serve it, plus the CSP meta and the in-frame network probe. */
function instrumentWidgetHtml(html: string): string {
  const head = /<head(\s[^>]*)?>/i.exec(html);
  if (!head) throw new Error("widget HTML has no <head>");
  const at = head.index + head[0].length;
  return `${html.slice(0, at)}<meta http-equiv="Content-Security-Policy" content="${HOST_DEFAULT_CSP}">${NETWORK_PROBE}${html.slice(at)}`;
}

/** Fixture text each view must render from its opening tool result (see widgets/dev/fixtures.ts SAMPLE_ARGS). */
const LANDMARK: Record<ViewName, string> = {
  penjualan: "Tunai",
  produk: "Produk 1",
  stok: "Kopi 3 - Reguler",
  pembelian: "PO-2026-0001",
  transaksi: "INV/20260915/0000",
  piutang: "Pelanggan E",
};

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

/** The host page script: scripts/widgets-smoke-host.ts bundled into one IIFE (ext-apps AppBridge + fixtures). */
async function bundleHostScript(): Promise<string> {
  const output = await build({
    configFile: false,
    root: ROOT,
    logLevel: "silent",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
      write: false,
      minify: false,
      emptyOutDir: false,
      lib: { entry: path.join(ROOT, "scripts", "widgets-smoke-host.ts"), formats: ["iife"], name: "WidgetsSmokeHost" },
    },
  });
  const results = Array.isArray(output) ? output : [output];
  for (const result of results) {
    if (!("output" in result)) continue;
    const chunk = result.output.find((item) => item.type === "chunk");
    if (chunk && chunk.type === "chunk") return chunk.code;
  }
  throw new Error("Vite produced no host script chunk");
}

async function widgetFrame(page: Page): Promise<Frame> {
  const deadline = Date.now() + VIEW_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
    if (frame) return frame;
    await page.waitForTimeout(50);
  }
  throw new Error("widget iframe never attached");
}

function textIncludes(frame: Frame, text: string, timeout = VIEW_TIMEOUT_MS): Promise<unknown> {
  return frame.waitForFunction((needle) => document.body?.innerText.includes(needle) ?? false, text, { timeout });
}

async function smokeView(page: Page, hostScript: string, view: ViewName): Promise<void> {
  const consoleErrors: string[] = [];
  const requests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 200));
  });
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message.slice(0, 200)}`));
  page.on("request", (request) => requests.push(request.url().slice(0, 120)));
  await page.route("**/*", (route) => route.abort());

  await page.setContent('<!doctype html><html lang="id"><head><meta charset="utf-8"><title>widgets smoke host</title></head><body></body></html>');
  await page.addScriptTag({ content: hostScript });

  const tool = VIEW_TOOL[view];
  const mount: SmokeMountOptions = {
    html: instrumentWidgetHtml(renderViewHtml(WIDGET_HTML, view)),
    tool,
    args: SAMPLE_ARGS[tool] as Record<string, unknown>,
  };
  await page.evaluate((options) => window.__smoke.mount(options), mount);
  const frame = await widgetFrame(page);

  let rendered = true;
  try {
    await textIncludes(frame, LANDMARK[view]);
  } catch {
    rendered = false;
  }
  const heading = await frame.evaluate(() => document.querySelector("h1")?.textContent?.trim() ?? "");
  check(`${view}: renders "${LANDMARK[view]}" under heading ${VIEW_LABEL[view]}`, rendered && heading === VIEW_LABEL[view], `h1="${heading}"`);
  check(`${view}: no <form> elements`, (await frame.evaluate(() => document.querySelectorAll("form").length)) === 0);

  if (view === "transaksi") {
    const loadedCount = async () =>
      Number((await frame.evaluate(() => /(\d+) transaksi dimuat/.exec(document.body.innerText)?.[1] ?? "0")) || 0);
    const before = await loadedCount();
    await frame.getByRole("button", { name: "Muat lebih banyak" }).click();
    let after = before;
    try {
      await frame.waitForFunction((count) => Number(/(\d+) transaksi dimuat/.exec(document.body.innerText)?.[1] ?? "0") > count, before, {
        timeout: VIEW_TIMEOUT_MS,
      });
      after = await loadedCount();
    } catch {
      // reported below
    }
    const pagerCalls = await page.evaluate(() => window.__smoke.calls.filter((call) => call.name === "transactions_page"));
    check(
      "transaksi: one transactions_page round trip appends rows",
      pagerCalls.length === 1 && pagerCalls[0]?.arguments.page === 2 && after > before,
      `rows ${before} → ${after}`,
    );
  }

  const host: Pick<SmokeHost, "calls" | "events"> = await page.evaluate(() => ({ calls: window.__smoke.calls, events: window.__smoke.events }));
  check(`${view}: host delivered the opening tool call`, host.events.includes("toolresult"), host.events.join(","));
  const repeated = host.calls.filter((call) => call.name === tool).length;
  check(`${view}: opening tool result reused (no repeated ${tool} call)`, repeated === 0, `${repeated} call(s)`);
  check(`${view}: no console errors or page errors`, consoleErrors.length === 0, consoleErrors.join(" | "));
  const frameNetwork = await frame.evaluate(() => [
    ...((window as unknown as { __mjNetwork?: string[] }).__mjNetwork ?? []),
    ...performance.getEntriesByType("resource").map((entry) => entry.name),
  ]);
  const network = [...requests, ...frameNetwork];
  check(`${view}: zero network requests`, network.length === 0, network.join(", ").slice(0, 300));
}

async function main(): Promise<void> {
  const currentHash = computeWidgetSourceHash(ROOT);
  if (currentHash !== WIDGET_SOURCE_HASH) {
    throw new Error("src/widgets/bundled.ts is stale: run bun run widgets:bundle");
  }
  check("bundle present", WIDGET_HTML.length > 0, `${WIDGET_HTML.length} chars, source ${WIDGET_SOURCE_HASH.slice(0, 12)}`);

  const hostScript = await bundleHostScript();
  const executablePath = process.env.CHROME_PATH?.trim();
  const browser = await chromium.launch(executablePath ? { executablePath, headless: true } : { channel: "chrome", headless: true });
  try {
    for (const view of VIEWS) {
      const page = await browser.newPage({ viewport: { width: 900, height: 1000 }, timezoneId: "Asia/Jakarta", locale: "id-ID" });
      try {
        await smokeView(page, hostScript, view);
      } catch (err) {
        check(`${view}: smoke run`, false, err instanceof Error ? err.message.split("\n")[0] : String(err));
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll widget smoke checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error("Widget smoke test crashed:", err instanceof Error ? err.message : err);
  process.exit(2);
});
```

- [ ] **Step 5: Run it against the stale bundle**

Run: `bun run widgets:smoke`
Expected: exit 2 with `Widget smoke test crashed: src/widgets/bundled.ts is stale: run bun run widgets:bundle`. Step 1 changed `package.json` and `bun.lock`, which are hash inputs.

- [ ] **Step 6: Regenerate the bundle and run the smoke test**

Run: `bun run widgets:bundle && bun run widgets:smoke`
Expected: `Wrote src/widgets/bundled.ts (…)`, `PASS  bundle present`, and six `PASS` lines per view:
- `renders "<landmark>" under heading <Label>`
- `no <form> elements`
- `host delivered the opening tool call`
- `opening tool result reused (no repeated show_… call) — 0 call(s)`
- `no console errors or page errors`
- `zero network requests`

Transaksi also prints `PASS  transaksi: one transactions_page round trip appends rows — rows 6 → 18`. The run ends with `All widget smoke checks passed` (exit 0, about 3 s).

- [ ] **Step 7: Prove the console and network checks catch violations (negative control)**

Run:

```bash
sed -e 's|html: instrumentWidgetHtml(renderViewHtml(WIDGET_HTML, view)),|html: instrumentWidgetHtml(renderViewHtml(WIDGET_HTML, view)).replace("<body>", "<body><img src=\\"https://example.com/x.png\\"><script>fetch(\\"https://example.org/y\\").catch(function(){})</script>"),|' -e 's|for (const view of VIEWS)|for (const view of ["transaksi"] as const)|' scripts/widgets-smoke.ts > scripts/widgets-smoke-negative.tmp.ts && bun run scripts/widgets-smoke-negative.tmp.ts; echo "exit=$?"; rm scripts/widgets-smoke-negative.tmp.ts
```

Expected: exit 1, with these two failures (the other transaksi checks still PASS):
- `FAIL  transaksi: no console errors or page errors — Loading the image 'https://example.com/x.png' violates the following Content Security Policy directive …`
- `FAIL  transaksi: zero network requests — img-src https://example.com/x.png, connect-src https://example.org/y, …`

The temporary file is removed.

- [ ] **Step 8: Add the widget checks to `scripts/e2e-mcp.ts`**

Apply these replacements in order. Each old snippet occurs exactly once.

1. Replace:

````ts
 *   bun run scripts/e2e-mcp.ts --base https://mcp.manujujaya.com --live # + read-only Qasir calls
````

with:

````ts
 *   bun run scripts/e2e-mcp.ts --base https://mcp.manujujaya.com --live # + read-only Qasir calls
 *   bun run scripts/e2e-mcp.ts --base http://localhost:8787 --live --stock-search kampas
 *     --live also opens each widget view tool once with a small range and validates its
 *     structuredContent against src/widgets/contract.ts (prints shapes, never values).
 *     --stock-search sets the product-name fragment for show_stock_browser (default "a").
````

2. Replace:

````ts
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
````

with:

````ts
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import {
  APP_TOOL,
  MCP_APP_MIME_TYPE,
  STRUCTURED_MAX_CHARS,
  TOOL_SCHEMAS,
  VIEW_TOOL,
  VIEWS,
  WIDGET_TOOL_NAMES,
  viewResourceUri,
  type ToolInput,
  type ViewName,
} from "../src/widgets/contract";
import { addDays, jakartaToday } from "../src/widgets/qasir-dates";
````

3. Replace:

````ts
const LIVE = flag("live");
````

with:

````ts
const LIVE = flag("live");
const STOCK_SEARCH = opt("stock-search", "a");
````

4. Replace:

````ts
  return content.map((c) => c.text ?? "").join("\n");
}

````

with:

````ts
  return content.map((c) => c.text ?? "").join("\n");
}

/** `_meta.ui` of a listed tool, if any. */
function uiMeta(tool: { _meta?: Record<string, unknown> } | undefined): { resourceUri?: unknown; visibility?: unknown } | undefined {
  const ui = tool?._meta?.ui;
  return typeof ui === "object" && ui !== null ? (ui as { resourceUri?: unknown; visibility?: unknown }) : undefined;
}

/** Structure without values: arrays as key[length], objects as key{field count}, scalars as key:type. */
function shapeOf(value: Record<string, unknown>): string {
  return Object.entries(value)
    .map(([key, v]) =>
      Array.isArray(v) ? `${key}[${v.length}]` : v === null ? `${key}:null` : typeof v === "object" ? `${key}{${Object.keys(v).length}}` : `${key}:${typeof v}`,
    )
    .join(" ");
}

/** Indonesian mobile numbers (08…, 628…, +628…). Widget tool text must never contain one. */
const PHONE_PATTERN = /(?<!\d)(?:\+?62|0)8\d{7,11}(?!\d)/;

/** One small read-only call per view tool; dates are Asia/Jakarta. */
function liveViewArgs(today: string): { [V in ViewName]: ToolInput<(typeof VIEW_TOOL)[V]> } {
  return {
    penjualan: { start_date: addDays(today, -1), end_date: today },
    produk: { start_date: addDays(today, -6), end_date: today, order: "terlaris" },
    stok: { search: STOCK_SEARCH },
    pembelian: { status: "semua" },
    transaksi: { start_date: today, end_date: today },
    piutang: {},
  };
}

async function liveWidgetChecks(client: Client): Promise<void> {
  const args = liveViewArgs(jakartaToday(new Date()));
  for (const view of VIEWS) {
    const name = VIEW_TOOL[view];
    const started = Date.now();
    const result = await client.callTool({ name, arguments: args[view] as Record<string, unknown> });
    const content = (result.content ?? []) as Array<{ type: string; text?: string }>;
    const text = content[0]?.text ?? "";
    if (result.isError) {
      check(`live widget: ${name}`, false, text.slice(0, 160));
      continue;
    }
    const size = JSON.stringify(result.structuredContent ?? null).length;
    const parsed = TOOL_SCHEMAS[name].output.safeParse(result.structuredContent);
    check(
      `live widget: ${name} structuredContent matches the contract`,
      parsed.success && size <= STRUCTURED_MAX_CHARS,
      parsed.success
        ? `${Date.now() - started} ms, ${size} chars`
        : parsed.error.issues.slice(0, 3).map((issue) => issue.path.join(".") || "(root)").join(", "),
    );
    check(
      `live widget: ${name} returns one text block (≤ 2,000 chars, no phone numbers)`,
      content.length === 1 && content[0]?.type === "text" && text.length <= 2_000 && !PHONE_PATTERN.test(text),
      `${text.length} chars`,
    );
    if (parsed.success) console.log(`INFO  ${name} shape: ${shapeOf(result.structuredContent as Record<string, unknown>)}`);
  }
}

````

5. Replace:

````ts
  const names = tools.map((t) => t.name).sort();
  // execute_mutation is only registered for qasir:write tokens when ENABLE_MUTATIONS=true.
  check("tools/list (read-only token)", JSON.stringify(names) === '["execute","search"]', names.join(","));
  check("tools annotated readOnlyHint + title", tools.every((t) => t.annotations?.readOnlyHint === true && Boolean(t.title)));

  const resources = (await client.listResources()).resources.map((r) => r.uri);
  check("resources/list", ["qasir://docs/index", "qasir://openapi", "qasir://capabilities", "qasir://coverage"].every((u) => resources.includes(u)), resources.join(","));
````

with:

````ts
  const names = tools.map((t) => t.name).sort();
  const widgetNames = names.filter((name) => WIDGET_TOOL_NAMES.includes(name));
  const widgetsEnabled = widgetNames.length > 0;
  // execute_mutation is only registered for qasir:write tokens when ENABLE_MUTATIONS=true.
  check("tools/list (read-only token)", JSON.stringify(names.filter((name) => !WIDGET_TOOL_NAMES.includes(name))) === '["execute","search"]',
    names.join(","));
  check("tools annotated readOnlyHint + title", tools.every((t) => t.annotations?.readOnlyHint === true && Boolean(t.title)));
  if (widgetsEnabled) {
    const byName = new Map(tools.map((t) => [t.name, t]));
    check("widget tools listed (6 views + 9 app-only)", widgetNames.length === WIDGET_TOOL_NAMES.length, `${widgetNames.length}`);
    check("view tools carry _meta.ui.resourceUri", VIEWS.every((view) => uiMeta(byName.get(VIEW_TOOL[view]))?.resourceUri === viewResourceUri(view)));
    check("app-only tools carry _meta.ui.visibility [\"app\"]",
      Object.values(APP_TOOL).every((name) => JSON.stringify(uiMeta(byName.get(name))?.visibility) === '["app"]'));
  } else {
    console.log("INFO  widget tools not listed (ENABLE_WIDGETS=false on this Worker)");
  }

  const listedResources = (await client.listResources()).resources;
  const resources = listedResources.map((r) => r.uri);
  check("resources/list", ["qasir://docs/index", "qasir://openapi", "qasir://capabilities", "qasir://coverage"].every((u) => resources.includes(u)), resources.join(","));
  if (widgetsEnabled) {
    check("resources/list has the six ui:// views (MCP App mime type)",
      VIEWS.every((view) => listedResources.some((r) => r.uri === viewResourceUri(view) && r.mimeType === MCP_APP_MIME_TYPE)));
    const viewResource = await client.readResource({ uri: viewResourceUri("transaksi") });
    const viewContent = viewResource.contents[0] as { mimeType?: string; text?: string } | undefined;
    const viewHtml = viewContent?.text ?? "";
    check("resources/read ui://manujujaya/transaksi.html",
      viewContent?.mimeType === MCP_APP_MIME_TYPE && viewHtml.includes('data-view="transaksi"') && viewHtml.includes('name="mj-build"'),
      `${viewHtml.length} chars`);
  }
````

6. Replace:

````ts
      toolText(limit).slice(0, 160));
````

with:

````ts
      toolText(limit).slice(0, 160));
    if (widgetsEnabled) await liveWidgetChecks(client);
````

The widget checks print only tool names, counts, character lengths and payload shapes (keys, array lengths, types). They never print the text or values of a widget result: the piutang text names customers.

- [ ] **Step 9: Run the checks**

Run: `bun run check-types && bun run test tests/unit/widgets-bundle.test.ts`
Expected: all three `tsc` projects exit 0; the bundle test PASSES.

Then run the end-to-end script against a local Worker. It needs `OWNER_PASSWORD` in `.dev.vars`.

```bash
bun run dev                                                     # terminal 1
bun run e2e                                                     # terminal 2
```

Expected: every line `PASS`, including:
- `PASS  tools/list (read-only token) — customer_debt_detail,execute,order_detail,…`
- `PASS  widget tools listed (6 views + 9 app-only) — 15`
- `PASS  view tools carry _meta.ui.resourceUri`
- `PASS  app-only tools carry _meta.ui.visibility ["app"]`
- `PASS  resources/list has the six ui:// views (MCP App mime type)`
- `PASS  resources/read ui://manujujaya/transaksi.html — … chars`

The run ends with `All checks passed`.

With a Qasir test account (`QASIR_E2E_USERNAME`/`QASIR_E2E_PIN` in `.dev.vars`), also run `bun run scripts/e2e-mcp.ts --base http://localhost:8787 --connect --live`.
Expected, for each of the six view tools:
- `PASS  live widget: <tool> structuredContent matches the contract — … ms, … chars`
- `PASS  live widget: <tool> returns one text block (≤ 2,000 chars, no phone numbers) — … chars`
- `INFO  <tool> shape: …`

If `show_stock_browser` is slow or empty, pass `--stock-search <fragment of a product name>`.

- [ ] **Step 10: Commit**

```bash
git add package.json bun.lock scripts/widgets-smoke-host.ts scripts/widgets-smoke.ts scripts/e2e-mcp.ts src/widgets/bundled.ts
git commit -m "test(widgets): headless Chrome smoke test and live E2E widget checks

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: Documentation and the 0.3.0 release

**Files:**
- Modify: `docs/mcp-tools.md`
- Modify: `docs/architecture/overview.md`
- Modify: `docs/architecture/security.md`
- Modify: `docs/architecture/setup.md`
- Modify: `package.json` (version `0.3.0`)
- Modify: `src/widgets/bundled.ts` (regenerated: `package.json` is a bundle source-hash input)
- Modify, working tree only and never staged: `README.md` (the owner has uncommitted edits in it)

**Prerequisites:** T15 is committed (lanes: T11 → T15 → T16). The docs describe `widgets:smoke` and the `e2e --live` widget checks that T15 adds.

**Interfaces:**
- Consumes (documented exactly as built):
  - T1: `WIDGET_TOOL_NAMES`, `VIEW_TOOL`, `APP_TOOL`, the input bounds, `STRUCTURED_MAX_CHARS` (250,000), `MCP_APP_MIME_TYPE`, `viewResourceUri`.
  - T2: `DEFAULT_WIDGET_LIMITS` (concurrency 4, 30,000 ms, 8,000,000 chars), the 2,000-char text cap, `connect_url` on `QASIR_AUTH_EXPIRED`.
  - T3–T7: the `maxRequests` budget of each tool.
  - T8–T10: the scripts `widgets:dev`, `widgets:build`, `widgets:bundle`, `widgets:test`, `widgets:check-types`, and `check-types` including `widgets/tsconfig.json`.
  - T11: `ENABLE_WIDGETS` (default `"true"`), `WIDGET_RESOURCE_TTL_MS` (600,000), `widgets` in `qasir://capabilities`, `MCP_SERVER_VERSION` `0.3.0`.
  - T15: `widgets:smoke` (Google Chrome or `CHROME_PATH`), `e2e --live` widget checks, `--stock-search`.
- Produces: documentation and the `0.3.0` package version. There is no code API.

- [ ] **Step 1: Write the failing documentation check**

Run this check before editing. It fails until every widget tool name, every `widgets:*` script and `ENABLE_WIDGETS` appear in the docs.

```bash
bun -e '
import { readFileSync } from "node:fs";
import { WIDGET_TOOL_NAMES } from "./src/widgets/contract";
const read = (p) => readFileSync(p, "utf8");
const tools = read("docs/mcp-tools.md");
const overview = read("docs/architecture/overview.md");
const security = read("docs/architecture/security.md");
const setup = read("docs/architecture/setup.md");
const missing = [
  ...WIDGET_TOOL_NAMES.filter((name) => !tools.includes("`" + name + "`")).map((name) => "mcp-tools.md: " + name),
  ...["widgets:dev", "widgets:bundle", "widgets:smoke", "widgets:test", "ENABLE_WIDGETS"].filter((s) => !setup.includes(s)).map((s) => "setup.md: " + s),
  ...["ENABLE_WIDGETS", "src/widgets/"].filter((s) => !overview.includes(s)).map((s) => "overview.md: " + s),
  ...["visibility", "structuredContent"].filter((s) => !security.includes(s)).map((s) => "security.md: " + s),
];
console.log(missing.length ? "MISSING\n" + missing.join("\n") : "docs cover every widget tool, script and flag");
process.exit(missing.length ? 1 : 0);
'
```

Expected: exit 1. The output starts with `MISSING` and lists all 15 tool names for `mcp-tools.md`, then the `setup.md`, `overview.md` and `security.md` entries.

- [ ] **Step 2: Document the widget tools in `docs/mcp-tools.md`**

Replace:

````md
| `execute_mutation` | `qasir:write` | Only if `ENABLE_MUTATIONS=true` **and** the token has `qasir:write` (or `qasir:admin`) | destructive, open world |
````

with:

````md
| `execute_mutation` | `qasir:write` | Only if `ENABLE_MUTATIONS=true` **and** the token has `qasir:write` (or `qasir:admin`) | destructive, open world |
| 6 widget view tools (`show_*`) | `qasir:read` | Unless `ENABLE_WIDGETS=false` | readOnly, idempotent, open world |
| 9 widget helper tools | `qasir:read` | Unless `ENABLE_WIDGETS=false`; `_meta.ui.visibility: ["app"]` | readOnly, idempotent, open world |

The widget tools are described in [Widgets (MCP Apps)](#widgets-mcp-apps).
````

Replace:

````md
## Error codes

Tool errors are `isError: true` results with a JSON text body `{ "code", "message" }`. Only the code and message leave the server.
````

with:

````md
## Widgets (MCP Apps)

Six interactive views, in Bahasa Indonesia, are served as MCP Apps (extension `io.modelcontextprotocol/ui`, `@modelcontextprotocol/ext-apps` 2.0.0). Each view has one model-visible tool. The tool's `_meta.ui.resourceUri` (mirrored in the older `_meta["ui/resourceUri"]` key) points to `ui://manujujaya/<view>.html`.

- **Hosts that render MCP Apps** show the view inline. The view receives the tool's `structuredContent` and then calls the helper tools through the host for more pages and details.
- **Other clients** get the text block only. It is written to answer the question without the UI.

Client UI support is only known per request, after the server factory runs. So the tools are registered for every token unless `ENABLE_WIDGETS=false`. None of them declares an `outputSchema`; the contract lives in `src/widgets/contract.ts` and is enforced by tests and by the widget.

### View tools

| Tool | View | Input | Upstream requests (max) | Returns |
| --- | --- | --- | --- | --- |
| `show_sales_dashboard` | `penjualan` | `start_date`, `end_date`, `outlet_id?` | 6 | KPIs against the preceding period of equal length, daily trend, payment methods, top categories and products, open receivable |
| `show_product_ranking` | `produk` | `start_date`, `end_date`, `order?` (`terlaris` default, `kurang_laris`, `omzet_tertinggi`, `omzet_terendah`), `outlet_id?` | 2 | Ranked products (50 per page) and categories; the "Transaksi Manual" pseudo row is reported separately |
| `show_stock_browser` | `stok` | `search?`, `outlet_id?` | 1 | Variants with stock, sell price, days since last sale and since last adjustment. Without `search` the first load takes about 15 s |
| `show_purchase_orders` | `pembelian` | `status?` (`semua` default, `order_processed`, `completed`, `canceled`), `outlet_id?` | 5 | Purchase orders with status counts; a specific status scans up to 5 pages of 100 |
| `show_transactions` | `transaksi` | `start_date`, `end_date`, `customer_id?`, `outlet_id?` | 2 | Sales grouped by day (100 per page), total count, loaded amount without full refunds, payment-mode split |
| `show_customer_debts` | `piutang` | `customer_id?`, `outlet_id?` | 20 | Open credit sales since 2015-01-01 per customer and aging bucket (0–7 hari … > 2 tahun), overdue counts, Qasir's receivable per bucket |

### Helper tools (app-only)

These tools carry `_meta.ui.visibility: ["app"]`, and their descriptions start with `Widget helper:`. Hosts hide them from the model, but the server still lists them to every client.

| Tool | Used by | Input | Upstream requests (max) |
| --- | --- | --- | --- |
| `product_ranking_page` | `produk` | `start_date`, `end_date`, `order`, `page`, `outlet_id?` | 1 |
| `stock_page` | `stok` | `search?`, `page`, `outlet_id?` | 1 |
| `stock_history` | `stok` | `inventory_id`, `page`, `outlet_id?` | 1 |
| `stock_velocity` | `stok` | `inventory_id`, `outlet_id?` | 5 |
| `purchase_orders_page` | `pembelian` | `page`, `outlet_id?` | 1 |
| `purchase_order_items` | `pembelian` | `purchase_id`, `outlet_id?` | 1 |
| `transactions_page` | `transaksi` | `start_date`, `end_date`, `customer_id?`, `page`, `outlet_id?` | 1 |
| `order_detail` | `transaksi` | `sales_id` | 1 |
| `customer_debt_detail` | `piutang` | `customer_id`, `outlet_id?` | 45 |

### Rules for every widget tool

- **Read-only.** Each tool hard-codes its read `operationId`s and calls the same `QasirDispatcher` as `execute`. There is no model code and no mutation path.
- **Input bounds.**
  - Dates are `YYYY-MM-DD` with `start_date ≤ end_date` and at most 366 days, inclusive.
  - `page` is 1–500. Ids are positive integers; `purchase_id` is a numeric string.
  - `search` is 1–100 characters after trimming. `outlet_id` is a numeric string.
  - A schema failure comes back as the SDK's `Input validation error: …` text; a range failure as `INVALID_INPUT`.
- **Outlet.** `outlet_id` is optional. Without it, a tool uses the connected session's outlet: the one chosen during `/connect`, else `DEFAULT_OUTLET_ID`.
- **Time zone.** "Today", overdue days and aging buckets use Asia/Jakarta.
- **Limits per call.** At most 4 concurrent upstream requests and a 30 s deadline that aborts in-flight fetches. Upstream responses may total about 8 MB (8,000,000 JSON characters). Each tool also has the request budget shown above. Going past a limit returns `RESULT_LIMIT_EXCEEDED` or `UPSTREAM_TIMEOUT`.
- **Result.** Exactly one text block (Bahasa Indonesia, at most 2,000 characters, never phone numbers) plus `structuredContent` of at most 250,000 JSON characters.
  - Rows are trimmed from the tail to fit, with `truncated: true` and a `truncated_reason`.
  - Every payload carries `outlet_id`, `generated_at`, `truncated` and `truncated_reason`; view payloads also carry `view`.
- **Errors.** The same `{ "code", "message" }` JSON body as other tools. `QASIR_AUTH_EXPIRED` also carries `connect_url` (`<PUBLIC_BASE_URL>/connect`), so the view can offer the reconnect page. Failures are logged as `tool.<name>.error` with the code only.
- **Compatibility.** Hosts may keep a view's HTML for up to 10 minutes, so contract changes are additive. The widget ignores unknown fields.

### Views

All six views share one single-file React + TanStack SPA (`widgets/`, bundled into `src/widgets/bundled.ts`). They use a view switcher, and the refresh and fullscreen buttons appear when the host supports them.

- **The views make no network requests.** Every read goes through the host's `tools/call`. They use no storage or `<form>` elements, and open links only through the host.

| View | What it shows |
| --- | --- |
| Penjualan | Period presets (Hari ini … 30 hari terakhir, Pilih tanggal), KPI tiles with change, trend chart (a day opens Transaksi), payment methods, categories, top products (open the Produk ranking), receivable tile (opens Piutang), "Tanya Claude tentang periode ini" when the host accepts messages |
| Produk | Same presets; Terlaris · Kurang laris · Omzet tertinggi · Omzet terendah; ranking table with paging; a product opens Stok |
| Stok | Debounced search, stock table with "Stok habis" / "Belum terjual ≥ 90 hari" chips; a row opens movement history and 30-day velocity |
| Pembelian | Status chips, PO table, expandable line items |
| Transaksi | Presets (default Hari ini), customer chip, payment-mode and status chips, virtualized day-grouped list with sticky day headers, receipt detail sheet with "Lihat transaksi pelanggan ini" |
| Piutang | Summary tiles, aging bucket strip, customer search and sort, customer detail with phone, invoices and payments, "Lihat semua transaksi" and, when the host accepts messages, "Minta Claude buat pesan penagihan" |

## Error codes

Tool errors are `isError: true` results with a JSON text body `{ "code", "message" }`. Only the code and message leave the server. Widget tools add `connect_url` to `QASIR_AUTH_EXPIRED` errors.
````

Replace:

````md
| `qasir://capabilities` | JSON | Protocol, tools registered **for this token**, operation counts by safety, mutation policy, Code Mode limits |
````

with:

````md
| `qasir://capabilities` | JSON | Protocol, tools registered **for this token**, operation counts by safety, mutation policy, Code Mode limits, `widgets { enabled, views, resourceUris }` |
| `ui://manujujaya/penjualan.html`, `produk.html`, `stok.html`, `pembelian.html`, `transaksi.html`, `piutang.html` | `text/html;profile=mcp-app` | The widget SPA with `data-view` set to the view (unless `ENABLE_WIDGETS=false`). Self-contained HTML under 1 MB with no data or credentials. `_meta.ui.prefersBorder: true`, no CSP domains, `ttlMs` 600,000 |
````

Replace:

````md
`outlet_ids` is not filled in automatically. The server does not expose `DEFAULT_OUTLET_ID` to the model, so pass the outlet id when an operation requires it.
````

with:

````md
`outlet_ids` is not filled in automatically for `execute` and the prompts. The server does not expose `DEFAULT_OUTLET_ID` to the model, so pass the outlet id when an operation requires it. The widget tools are the exception: they fall back to the connected session's outlet.
````

- [ ] **Step 3: Update `docs/architecture/overview.md`**

Replace:

````md
| Observability | `src/observability/log.ts`, `redact.ts` | JSON log lines with key- and pattern-based redaction; doc sanitizer |
````

with:

````md
| Observability | `src/observability/log.ts`, `redact.ts` | JSON log lines with key- and pattern-based redaction; doc sanitizer |
| Widget tools | `src/widgets/contract.ts`, `qasir-dates.ts`, `qasir-values.ts`, `budget.ts`, `tools/*` | 6 view tools and 9 app-only helpers over hard-coded read operations, per-call `RequestBudget`, zod contract shared with the SPA |
| Widget views | `src/widgets/resources.ts`, `src/widgets/bundled.ts`, `widgets/` | Six `ui://manujujaya/<view>.html` MCP App resources serving one generated single-file SPA (React 19 + TanStack, Vite; `bun run widgets:bundle`) |
````

Replace:

````md
3. **`createManujujayaServer`** registers `search` and `execute`. It also registers `execute_mutation`, but only if `ENABLE_MUTATIONS=true` and the token has `qasir:write`. Then it adds resources and prompts. Nothing persists between requests: there is no MCP session id, and `GET /mcp` returns 405.
````

with:

````md
3. **`createManujujayaServer`** registers `search` and `execute`. It also registers `execute_mutation`, but only if `ENABLE_MUTATIONS=true` and the token has `qasir:write`. Unless `ENABLE_WIDGETS=false`, it then registers the 15 widget tools and the six `ui://manujujaya/*.html` resources for every token, since the client's UI capability only arrives per request. Then it adds resources and prompts. Nothing persists between requests: there is no MCP session id, and `GET /mcp` returns 405.
````

Replace:

````md
7. The result goes back into the sandbox. The final return value is truncated structurally and capped at ~24 KB of text.
````

with:

````md
7. The result goes back into the sandbox. The final return value is truncated structurally and capped at ~24 KB of text.

## Request flow: widget view

1. The model calls a view tool, for example `show_transactions { start_date, end_date }`.
2. The tool handler runs on the host, not in the sandbox:
   - checks `qasir:read`;
   - validates the range;
   - resolves `outlet_id` (input, else the session outlet);
   - sends its fixed read operations through `QasirDispatcher` under a `RequestBudget` (4 concurrent, 30 s, ~8 MB, per-tool request cap).
3. It projects the responses into the contract shape. It returns one Indonesian text block and `structuredContent`, trimmed to 250 KB if needed.
4. A host that supports MCP Apps reads `ui://manujujaya/transaksi.html` and renders it in a sandboxed iframe. It then delivers the tool input and result over `postMessage`.
5. The SPA seeds its query cache from that result, so the first render needs no second call. Paging, details and filter changes call tools through the host's `tools/call` (`transactions_page`, `order_detail`, `show_transactions`). The iframe itself makes no network requests.
````

Replace:

````md
| Client used for E2E | `@modelcontextprotocol/client` 2.0.0 | Installed as a peer of `agents`; used by `scripts/e2e-mcp.ts` only |
````

with:

````md
| Client used for E2E | `@modelcontextprotocol/client` 2.0.0 | Installed as a peer of `agents`; used by `scripts/e2e-mcp.ts` only |
| `@modelcontextprotocol/ext-apps` | 2.0.0 (exact, dev) | `App` + React hooks in the widget SPA, `AppBridge` in `scripts/widgets-smoke.ts`. The Worker inlines the MCP Apps constants and does not import it |
| Widget toolchain | React 19.3.0, @tanstack/react-router 1.170.36, react-query 5.102.8, react-table 9.2.4, react-virtual 3.14.13, react-form 1.33.5, react-pacer 0.23.0, Vite 8.3.0, vite-plugin-singlefile 2.3.3, Tailwind CSS 4.3.3 (all exact, dev) | Compiled into `src/widgets/bundled.ts`. The Worker ships only the HTML string |
| `playwright-core` | 1.63.0 (exact, dev) | Drives installed Google Chrome for `bun run widgets:smoke` |
````

Replace:

````md
- **Outlet ids.** `DEFAULT_OUTLET_ID` is only a fallback for the stored session. It is not injected into requests and not shown to the model. Operations that need `outlet_ids` get it from the caller.
````

with:

````md
- **Outlet ids.** `DEFAULT_OUTLET_ID` is only a fallback for the stored session and is never shown to the model. `execute` and the prompts do not inject it: operations that need `outlet_ids` get it from the caller. The widget tools resolve `outlet_id` themselves, in this order: the tool input, the outlet stored by `/connect`, `DEFAULT_OUTLET_ID`.
- **MCP Apps hosts.** The views were verified in headless Google Chrome inside `sandbox="allow-scripts"`, under the ext-apps `AppBridge` and the hosts' default CSP (`bun run widgets:smoke`). Rendering in Claude.ai, Claude Desktop and ChatGPT still needs manual acceptance, and so do WebKit webviews (iOS) and each host's real CSP and sandbox flags. If a host sends an `Origin` header, the agents Origin check may reject the request. If a host fails protocol negotiation with -32022, set `MCP_LEGACY_MODE=stateless`; widgets never require the client UI capability.
````

- [ ] **Step 4: Update `docs/architecture/security.md`**

Replace:

````md
### Logging and output hygiene (`src/observability/*`)
````

with:

````md
### Widget tools and views (`src/widgets/*`, `widgets/`)

- **Scope and operations.** Every widget tool checks `qasir:read` inside its handler. It dispatches only its hard-coded read `operationId`s through `QasirDispatcher` and never passes `allowMutation`. There is no model-written code. `tests/security/widget-tools.test.ts` asserts, for each tool:
  - a missing scope gives `FORBIDDEN` with zero dispatches;
  - only the allowed operations are dispatched, and never a non-read one;
  - out-of-bounds inputs are rejected;
  - no credential strings appear in results.
- **Bounded fan-out.** Each call has its own budget: a per-tool request cap (the largest is `customer_debt_detail` with 45), 4 concurrent requests, and a 30 s deadline that aborts in-flight fetches. Upstream responses may total about 8 MB. `structuredContent` is capped at 250,000 characters and the text at 2,000.
- **Error and log hygiene.** Errors return `{ code, message }` only, plus `connect_url` for `QASIR_AUTH_EXPIRED`. Logs record `tool.<name>.error` with the error code, never arguments or results.
- **The view HTML is static.** `src/widgets/bundled.ts` holds no data and no secrets. `tests/unit/widgets-bundle.test.ts` rejects the following in the bundle:
  - external `src`/`href`/`url(http` references;
  - `<form>` elements;
  - token-like strings.
- **The views run in the host's sandboxed iframe.** They read data only through the host's `tools/call` and make no network requests; the smoke test runs them under the default MCP Apps CSP with `connect-src 'none'`.
  - No `localStorage`, `sessionStorage` or cookies, and no `dangerouslySetInnerHTML`: all text is rendered by React.
  - Links open only through the host's `openLink`.
  - "Minta Claude buat pesan penagihan" sends a message only when the user clicks it. The message carries the customer name, invoice numbers, remaining amounts and due dates, and never the phone number.

### Logging and output hygiene (`src/observability/*`)
````

Replace:

````md
- **Live data reaches the model provider.** `execute` results are not PII-redacted. Customer names, phone numbers and sales figures go to whichever MCP client or model the owner connected. Grant access only to clients you trust with that data.
````

with:

````md
- **Live data reaches the model provider.** `execute` results and widget `structuredContent` are not PII-redacted. Customer names, phone numbers and sales figures go to whichever MCP client or model the owner connected. Grant access only to clients you trust with that data.
- **App-only visibility is cosmetic.** `_meta.ui.visibility: ["app"]` only asks hosts to hide the 9 helper tools from the model. The server lists them to every client, and any holder of a `qasir:read` token can call them directly, including from a client that ignores MCP Apps. Each is read-only, scope-checked and budgeted, so it is as safe as `execute`, but it is one more path to the same data.
- **Personal data in widget results.** `structuredContent` carries:
  - customer names: `show_customer_debts`, `customer_debt_detail`, `order_detail`, and the customer filter of `show_transactions`;
  - mobile numbers: `order_detail`, `customer_debt_detail`;
  - staff names: `order_detail` (`cashier`) and `stock_history` (`movements[].by`);
  - free-text stock notes typed by staff, which can contain names or numbers: `stock_history` (`movements[].note`).

  Hosts may pass `structuredContent` to the model. Text blocks never contain phone numbers, and name customers only in the `show_customer_debts` top 5. To turn the whole surface off, set `ENABLE_WIDGETS=false`.
````

- [ ] **Step 5: Update `docs/architecture/setup.md`**

Replace:

````md
bun run check-types          # tsc (Worker) + tsc -p tsconfig.scripts.json
bun run test                 # vitest; use this, not `bun test`
bun run coverage:validate    # manifest vs the 13 API docs
bun run openapi:validate
bun run build                # wrangler deploy --dry-run --outdir=dist (uploads nothing)
```

After editing any of the 13 API docs (`docs/<name>.md`), run `bun run docs:bundle` to regenerate `src/docs/bundled.ts`. Then run `bun run coverage:report` to regenerate `docs/architecture/coverage.md`. `tests/unit/docs-pii.test.ts` fails if the bundle drifts or known sample PII comes back.
````

with:

````md
bun run check-types          # tsc (Worker) + tsc -p tsconfig.scripts.json + tsc -p widgets/tsconfig.json
bun run test                 # vitest; use this, not `bun test`
bun run widgets:test         # widget unit and render tests (vitest + happy-dom)
bun run widgets:smoke        # committed widget bundle in headless Google Chrome (see Widgets below)
bun run coverage:validate    # manifest vs the 13 API docs
bun run openapi:validate
bun run build                # wrangler deploy --dry-run --outdir=dist (uploads nothing)
```

After editing any of the 13 API docs (`docs/<name>.md`), run `bun run docs:bundle` to regenerate `src/docs/bundled.ts`. Then run `bun run coverage:report` to regenerate `docs/architecture/coverage.md`. `tests/unit/docs-pii.test.ts` fails if the bundle drifts or known sample PII comes back.

### Widgets (MCP App views)

The six views live in `widgets/` (React 19 + TanStack, Tailwind 4, Bahasa Indonesia). They share their data contract with the Worker through `src/widgets/contract.ts`. The Worker serves one prebuilt HTML string from `src/widgets/bundled.ts`, which is generated and committed.

| Command | What it does |
| --- | --- |
| `bun run widgets:dev` | Vite dev server. Open `http://localhost:5173/?view=transaksi` (or any view). Outside an iframe the views use the mock bridge with the synthetic data in `widgets/dev/fixtures.ts`, so no Worker and no Qasir session are needed |
| `bun run widgets:bundle` | `vite build` into one HTML file, then rewrites `src/widgets/bundled.ts` (the HTML plus `WIDGET_SOURCE_HASH`). Run it after changing anything under `widgets/`, `src/widgets/contract.ts`, `package.json` or `bun.lock`, and commit the result. `tests/unit/widgets-bundle.test.ts` fails with "run bun run widgets:bundle" while the bundle is stale |
| `bun run widgets:test` / `bun run widgets:check-types` | Widget tests (happy-dom) and the widget TypeScript project |
| `bun run widgets:smoke` | Loads each view from the committed bundle in headless Google Chrome, inside `<iframe sandbox="allow-scripts">` with the MCP Apps default CSP. The host page is an ext-apps `AppBridge` answering `tools/call` from the fixtures. It checks landmark text, no `<form>`, no console errors, zero network requests, no repeated opening tool call, and one `transactions_page` round trip. It needs Google Chrome installed, or `CHROME_PATH=/path/to/chrome`. It refuses to run while `src/widgets/bundled.ts` is stale |

To switch the widgets off, set `ENABLE_WIDGETS=false` in `wrangler.jsonc` `vars` (or in `.dev.vars` locally) and redeploy. The 15 widget tools and the `ui://` resources disappear; `search` and `execute` are unchanged.
````

Replace:

````md
- `--live` adds read-only upstream calls: `products.list`, `purchases.list`, the suppliers HTML adapter, and a page-size rejection check.
````

with:

````md
- Without `--live`, the script also checks the widget surface when it is enabled: the 15 widget tools with their `_meta.ui` (resource URI or `["app"]` visibility), the six `ui://` resources and their MCP App mime type, and one `resources/read`.
- `--live` adds read-only upstream calls: `products.list`, `purchases.list`, the suppliers HTML adapter, and a page-size rejection check.
  - It also calls each widget view tool once with a small range: yesterday and today, the last 7 days, today, and all open credit. `show_stock_browser` uses `--stock-search <fragment>`, default `a`.
  - Each `structuredContent` is validated against `src/widgets/contract.ts`, and each text block is checked for length and phone numbers. Only shapes (keys, array lengths, types) are printed, never values.
````

Replace:

````md
| `vars` | `PUBLIC_BASE_URL=https://mcp.manujujaya.com`, `MERCHANT_SLUG`, `DEFAULT_OUTLET_ID`, `ENABLE_MUTATIONS=false`, `ALLOW_DEV_PSK=false`, `REQUIRE_SESSION_ENCRYPTION=true`, `MCP_LEGACY_MODE=reject`, `MCP_SERVER_NAME`, `MCP_SERVER_VERSION` | Change vars **in this file** and redeploy. `wrangler deploy` (without `--keep-vars`) resets vars edited in the dashboard |
````

with:

````md
| `vars` | `PUBLIC_BASE_URL=https://mcp.manujujaya.com`, `MERCHANT_SLUG`, `DEFAULT_OUTLET_ID`, `ENABLE_MUTATIONS=false`, `ENABLE_WIDGETS=true`, `ALLOW_DEV_PSK=false`, `REQUIRE_SESSION_ENCRYPTION=true`, `MCP_LEGACY_MODE=reject`, `MCP_SERVER_NAME`, `MCP_SERVER_VERSION` | Change vars **in this file** and redeploy. `wrangler deploy` (without `--keep-vars`) resets vars edited in the dashboard |
````

Replace:

````md
bun run check-types && bun run test && bun run coverage:validate && bun run build
bunx wrangler deploy
````

with:

````md
bun run check-types && bun run test && bun run widgets:test && bun run coverage:validate && bun run build
bunx wrangler deploy
````

- [ ] **Step 6: Run the documentation check again**

Run the same `bun -e` command as in Step 1.
Expected: exit 0, printing `docs cover every widget tool, script and flag`.

Also run: `bun run test tests/unit/docs-pii.test.ts`
Expected: PASS (the new text contains no sample PII).

- [ ] **Step 7: Bump the version and regenerate the bundle**

`package.json` is an input of the widget source hash, so the version bump must ship with a regenerated `src/widgets/bundled.ts`.

In `package.json`, replace:

```json
  "version": "0.2.0",
```

with:

```json
  "version": "0.3.0",
```

Run: `bun run widgets:bundle && bun run test tests/unit/widgets-bundle.test.ts`
Expected: `Wrote src/widgets/bundled.ts (… chars, source hash …)`, then the bundle test PASSES. Only `WIDGET_SOURCE_HASH` and the `mj-build` meta change in `bundled.ts`.

- [ ] **Step 8: Commit**

```bash
git add docs/mcp-tools.md docs/architecture/overview.md docs/architecture/security.md docs/architecture/setup.md package.json src/widgets/bundled.ts
git commit -m "docs: widget tools, views, security notes and setup; release 0.3.0

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 9: Add the README "Interactive views" subsection (working tree only)**

`README.md` has the owner's uncommitted edits. Layer this change on top and **do not stage or commit it**; the owner commits the README.

In `README.md`, replace:

````md
### Built-in prompts

Apps that show MCP prompts (for example as slash commands) offer three ready-made workflows:
````

with:

````md
### Interactive views

In apps that support MCP Apps (interactive widgets inside the chat), the assistant can open six live views in Bahasa Indonesia instead of writing a script. In other apps the same tools answer with a short text summary.

| View | Tool | What it shows |
| --- | --- | --- |
| Penjualan | `show_sales_dashboard` | Sales, gross profit, transactions and average ticket against the previous period, a daily chart, payment methods, top categories and products |
| Produk | `show_product_ranking` | Best- and least-selling products by quantity or by revenue |
| Stok | `show_stock_browser` | Stock per variant, days since the last sale and the last stock adjustment, movement history, estimated days until stock runs out |
| Pembelian | `show_purchase_orders` | Purchase orders by status, with their items |
| Transaksi | `show_transactions` | Transactions per day for today, this week, this month, the last 30 days or any range; filters by payment method, status and customer; receipt details |
| Piutang | `show_customer_debts` | Open credit per customer, aged from 0–7 days to over 2 years, with invoices and payments, and a button that asks Claude to draft a payment reminder |

Try "Tampilkan transaksi hari ini", "Buka dashboard penjualan minggu ini" or "Tampilkan piutang pelanggan".
- The views only read data, and they fill in the connected outlet themselves.
- Like any other answer, they can show customer names and phone numbers.
- The owner can turn them off with `ENABLE_WIDGETS=false`; see [docs/mcp-tools.md § Widgets](docs/mcp-tools.md#widgets-mcp-apps).

### Built-in prompts

Apps that show MCP prompts (for example as slash commands) offer three ready-made workflows:
````

Run: `git status --short README.md && git diff --cached --name-only`
Expected: ` M README.md` (modified, unstaged), and no output from `git diff --cached --name-only`.

- [ ] **Step 10: Final verification**

Run each command from the repository root, in this order:

```bash
bun run check-types
bun run test
bun run widgets:test
bun run widgets:bundle && git diff --exit-code src/widgets/bundled.ts
bun run widgets:smoke
bun run coverage:validate
bun run openapi:validate
bun run build
```

Expected:
- `check-types`: all three `tsc` projects exit 0.
- `test`: every file passes, including `widgets-bundle`, `widget-tools` and the protocol tests.
- `widgets:test`: every widget test passes.
- `widgets:bundle`: the rebuild is byte-identical, so `git diff --exit-code` exits 0.
- `widgets:smoke`: 38 `PASS` lines (bundle, six checks per view, the transaksi pager), ending with `All widget smoke checks passed`.
- `coverage:validate`: `"ok": true`. `openapi:validate`: `{"ok":true,"paths":45,"operations":45}`.
- `build`: wrangler prints `Total Upload: … KiB / gzip: … KiB`. Record both numbers in the hand-off note. For reference, the plan-time dry run with all six views (bundle about 785,000 characters) printed `Total Upload: 2758.00 KiB / gzip: 608.80 KiB`.

Finally run `git status --short`. Expected: nothing staged, and only the owner's files plus `README.md` modified or untracked (`README.md`, `docs/install-prompts.md`, `GATES.md`, `docs/superpowers/plans/`, `manujujaya-mcp.pen`, `q.md`).

- [ ] **Step 11: Manual acceptance (owner, after deploy)**

No automated check covers real MCP Apps hosts (spec §7 and §8). The owner runs this checklist once T16 is merged:

1. Deploy: `bunx wrangler deploy`.
2. In Claude.ai, add `https://mcp.manujujaya.com/mcp` as a custom connector and complete the OAuth approval.
3. Ask, one message each:
   - "Tampilkan transaksi hari ini"
   - "Buka dashboard penjualan minggu ini"
   - "Tampilkan stok kopi"
   - "Tampilkan PO"
   - "Produk terlaris bulan ini"
   - "Tampilkan piutang pelanggan"

   For each, confirm that the view renders inline. Where the view pages (Produk, Stok, Pembelian, Transaksi), confirm the next page loads. In Piutang, open a customer near the bottom of the list and confirm the detail panel scrolls into view.

   When a Qasir session has expired, confirm the error panel shows "Sesi Qasir sudah berakhir…" with a "Buka halaman Connect" button that opens the Connect page. After reconnecting there, ask again and confirm the view loads.
4. Repeat step 3 in the Claude iOS app (WebKit webview).
5. If the connector fails with JSON-RPC error `-32022`, set `"MCP_LEGACY_MODE": "stateless"` in `wrangler.jsonc` `vars` (see [docs/architecture/operations.md](../../architecture/operations.md#legacy-2025-era-clients-error-32022)), redeploy with `bunx wrangler deploy`, and repeat steps 2–4. The widget tools never require the client UI capability.

Expected: all six views render and page in Claude.ai web and on iOS. Record any host that fails, its error text, and whether `MCP_LEGACY_MODE=stateless` fixed it, in the hand-off note. Changing `wrangler.jsonc` is a separate owner-approved commit.

---

