import { useInfiniteQuery, useQuery, type InfiniteData, type UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import type { ToolInput, ToolName, ToolOutput } from "../../../src/widgets/contract";
import { useBridge, type ToolCallError } from "./bridge";

/** Query key for one tool call. Query hashes keys with sorted object keys, so argument order does not matter. */
export function toolQueryKey<N extends ToolName>(name: N, args: ToolInput<N>): readonly [N, ToolInput<N>] {
  return [name, args] as const;
}

/** Calls `name` through the bridge; the query's AbortSignal is forwarded to the host call. */
export function useToolQuery<N extends ToolName>(
  name: N,
  args: ToolInput<N>,
  options?: { enabled?: boolean },
): UseQueryResult<ToolOutput<N>, ToolCallError> {
  const bridge = useBridge();
  return useQuery<ToolOutput<N>, ToolCallError, ToolOutput<N>, readonly [N, ToolInput<N>]>({
    queryKey: toolQueryKey(name, args),
    queryFn: ({ signal }) => bridge.callTool(name, args, signal),
    enabled: options?.enabled ?? true,
  });
}

export type PageToolName = "product_ranking_page" | "stock_page" | "stock_history" | "purchase_orders_page" | "transactions_page";

export interface MorePages<Row> {
  rows: Row[];
  hasMore: boolean;
  loadMore: () => void;
  isFetching: boolean;
  error: ToolCallError | null;
}

/**
 * Rows beyond the first page. Nothing is fetched until loadMore(): the first call fetches `startPage`,
 * later calls follow each page's `next_page`. `startPage: null` means there is nothing more to load.
 */
export function useMorePages<N extends PageToolName, Row>(opts: {
  tool: N;
  args: Omit<ToolInput<N>, "page">;
  startPage: number | null;
  rowsOf: (page: ToolOutput<N>) => Row[];
  enabled?: boolean;
}): MorePages<Row> {
  const bridge = useBridge();
  const enabled = (opts.enabled ?? true) && opts.startPage !== null;
  const query = useInfiniteQuery<
    ToolOutput<N>,
    ToolCallError,
    InfiniteData<ToolOutput<N>, number>,
    readonly [N, Omit<ToolInput<N>, "page">, number | null],
    number
  >({
    queryKey: [opts.tool, opts.args, opts.startPage] as const,
    initialPageParam: opts.startPage ?? 1,
    queryFn: ({ pageParam, signal }) =>
      bridge.callTool(opts.tool, { ...opts.args, page: pageParam } as unknown as ToolInput<N>, signal),
    getNextPageParam: (lastPage) => (lastPage as { next_page: number | null }).next_page ?? undefined,
    // Manual: loadMore() drives every fetch.
    enabled: false,
  });

  const { data, hasNextPage, isFetching, refetch, fetchNextPage } = query;
  const rowsOf = opts.rowsOf;
  // Recompute only when pages change; rowsOf is usually an inline arrow.
  const rows = useMemo(() => data?.pages.flatMap((page) => rowsOf(page)) ?? [], [data]);

  const hasMore = enabled && (data === undefined ? true : hasNextPage);
  const loadMore = () => {
    if (!enabled || isFetching) return;
    if (data === undefined) void refetch();
    else if (hasNextPage) void fetchNextPage();
  };

  return { rows, hasMore, loadMore, isFetching, error: query.error ?? null };
}
