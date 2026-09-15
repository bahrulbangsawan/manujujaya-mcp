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
              <p className="text-xs text-fg-muted">Pilih produk untuk melihat peringkatnya.</p>
              <BarList
                emptyText="Belum ada produk terjual"
                items={data.top_products.map((product) => ({
                  key: String(product.id),
                  label: product.name,
                  value: product.quantity,
                  valueLabel: `${formatNumber(product.quantity)} ${product.unit}`.trim(),
                  onSelect: () => goTo("produk", { ...outlet, ...range, order: "terlaris" }),
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
