import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef as TableColumnDef,
  type RowData,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useState, type ReactNode } from "react";
import { EmptyState } from "./EmptyState";
import { cx } from "./ui";

/** Per-column layout hints, read from `columnDef.meta`. */
export interface DataColumnMeta {
  align?: "left" | "right";
  /** Minimum column width in px (default 96). */
  minWidth?: number;
  /** Share of the remaining width (default 1). */
  grow?: number;
}

export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic, text: sortFn_text },
  columnMeta: {} as DataColumnMeta,
});
export type DataTableFeatures = typeof dataTableFeatures;

/** TanStack Table v9 column definition bound to the DataTable feature set. */
export type ColumnDef<Row extends RowData> = TableColumnDef<DataTableFeatures, Row, any>;

/** Column helper for DataTable columns: `const col = dataColumnHelper<StockRow>()`. */
export function dataColumnHelper<Row extends RowData>() {
  return createColumnHelper<DataTableFeatures, Row>();
}

export interface DataTableProps<Row extends RowData> {
  rows: Row[];
  columns: ColumnDef<Row>[];
  getRowId: (row: Row) => string;
  onRowClick?: (row: Row) => void;
  /** When set, clicking a row toggles this content below it. */
  renderExpanded?: (row: Row) => ReactNode;
  /**
   * Controlled expansion: when not undefined, only the row whose id (from getRowId) equals this
   * value shows renderExpanded (null: none), and a click only calls onRowClick.
   */
  expandedRowId?: string | null;
  estimateRowHeight?: number;
  maxHeight?: number;
  emptyText: string;
  footer?: ReactNode;
  /** Accessible table name. */
  label?: string;
}

const DEFAULT_MIN_WIDTH = 96;

/** Sortable (loaded rows only), virtualized table. Rows scroll inside a box of at most `maxHeight` px. */
export function DataTable<Row extends RowData>({
  rows,
  columns,
  getRowId,
  onRowClick,
  renderExpanded,
  expandedRowId,
  estimateRowHeight = 44,
  maxHeight = 560,
  emptyText,
  footer,
  label,
}: DataTableProps<Row>) {
  const table = useTable({ features: dataTableFeatures, columns, data: rows, getRowId: (row) => getRowId(row) });
  const modelRows = table.getRowModel().rows;
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const controlled = expandedRowId !== undefined;
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);

  const virtualizer = useVirtualizer({
    count: modelRows.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => estimateRowHeight,
    getItemKey: (index) => modelRows[index]?.id ?? index,
    overscan: 8,
  });

  // Before the scroll box has a measured height (first paint, or DOM shims without layout) the
  // virtualizer yields no items; show the rows that fit in maxHeight until it measures.
  const measured = virtualizer.getVirtualItems();
  const items =
    measured.length > 0
      ? measured
      : modelRows
          .slice(0, Math.ceil(maxHeight / estimateRowHeight))
          .map((row, index) => ({ key: row.id, index, start: index * estimateRowHeight }));

  const leafColumns = table.getAllLeafColumns();
  const template = leafColumns
    .map((column) => `minmax(${column.columnDef.meta?.minWidth ?? DEFAULT_MIN_WIDTH}px, ${column.columnDef.meta?.grow ?? 1}fr)`)
    .join(" ");
  const minWidth = leafColumns.reduce((sum, column) => sum + (column.columnDef.meta?.minWidth ?? DEFAULT_MIN_WIDTH), 0);
  const headers = table.getHeaderGroups().at(-1)?.headers ?? [];
  const interactive = Boolean(onRowClick || renderExpanded);

  function toggle(id: string) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-1">
      <div className="overflow-x-auto rounded-lg border border-line">
        <div role="table" aria-label={label} aria-rowcount={modelRows.length + 1} style={{ minWidth }}>
          <div role="rowgroup" className="border-b border-line bg-surface-muted">
            <div role="row" aria-rowindex={1} className="grid" style={{ gridTemplateColumns: template }}>
              {headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const canSort = header.column.getCanSort();
                const align = header.column.columnDef.meta?.align === "right" ? "justify-end text-right" : "justify-start text-left";
                return (
                  <div
                    key={header.id}
                    role="columnheader"
                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : canSort ? "none" : undefined}
                    className={cx("flex min-h-9 items-center px-3 text-xs font-medium text-fg-muted", align)}
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cx("inline-flex items-center gap-1 rounded", align)}
                      >
                        <table.FlexRender header={header} />
                        <span aria-hidden="true" className="w-3">
                          {sorted === "asc" ? "▲" : sorted === "desc" ? "▼" : ""}
                        </span>
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {modelRows.length === 0 ? (
            <div className="p-3">
              <EmptyState title={emptyText} />
            </div>
          ) : (
            <div ref={setScrollElement} role="rowgroup" className="overflow-y-auto" style={{ maxHeight }}>
              <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
                {items.map((item) => {
                  const row = modelRows[item.index];
                  if (!row) return null;
                  const isExpanded = renderExpanded ? (controlled ? row.id === expandedRowId : expanded.has(row.id)) : false;
                  const activate = () => {
                    if (renderExpanded && !controlled) toggle(row.id);
                    onRowClick?.(row.original);
                  };
                  return (
                    <div
                      key={item.key}
                      data-index={item.index}
                      ref={virtualizer.measureElement}
                      className="absolute left-0 top-0 w-full border-b border-line-muted"
                      style={{ transform: `translateY(${item.start}px)` }}
                    >
                      <div
                        role="row"
                        aria-rowindex={item.index + 2}
                        aria-expanded={renderExpanded ? isExpanded : undefined}
                        tabIndex={interactive ? 0 : undefined}
                        onClick={interactive ? activate : undefined}
                        onKeyDown={
                          interactive
                            ? (event) => {
                                if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                                  event.preventDefault();
                                  activate();
                                }
                              }
                            : undefined
                        }
                        className={cx("grid items-center", interactive && "cursor-pointer hover:bg-surface-muted")}
                        style={{ gridTemplateColumns: template, minHeight: estimateRowHeight }}
                      >
                        {row.getAllCells().map((cell) => (
                          <div
                            key={cell.id}
                            role="cell"
                            className={cx(
                              "min-w-0 px-3 py-2 text-sm text-fg",
                              cell.column.columnDef.meta?.align === "right" && "text-right tabular-nums",
                            )}
                          >
                            <table.FlexRender cell={cell} />
                          </div>
                        ))}
                      </div>
                      {isExpanded && renderExpanded ? (
                        <div role="row">
                          <div role="cell" aria-colspan={leafColumns.length} className="px-3 pb-3">
                            {renderExpanded(row.original)}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      {footer}
    </div>
  );
}
