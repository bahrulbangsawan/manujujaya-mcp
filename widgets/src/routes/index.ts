import type { AnyRoute } from "@tanstack/react-router";
import type { rootRoute } from "../app/router";
import { penjualanRoute } from "./penjualan";
import { produkRoute } from "./produk";
import { stokRoute } from "./stok";
import { pembelianRoute } from "./pembelian";
import { transaksiRoute } from "./transaksi";
import { piutangRoute } from "./piutang";

/**
 * Route factories, one per view. Each receives the root route and returns
 * createRoute({ getParentRoute: () => root, path: VIEW_PATH[view], validateSearch, component }).
 * Tasks 12–14 append their factories here.
 */
export const VIEW_ROUTES: Array<(root: typeof rootRoute) => AnyRoute> = [penjualanRoute, produkRoute, stokRoute, pembelianRoute, transaksiRoute, piutangRoute];
