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
