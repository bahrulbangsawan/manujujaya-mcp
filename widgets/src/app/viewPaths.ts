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
