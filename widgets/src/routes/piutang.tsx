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
