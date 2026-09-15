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
