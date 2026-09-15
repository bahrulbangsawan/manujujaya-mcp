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
