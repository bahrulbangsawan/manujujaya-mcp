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
