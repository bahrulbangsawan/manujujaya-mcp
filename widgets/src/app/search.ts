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
