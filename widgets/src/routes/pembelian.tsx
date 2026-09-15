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
