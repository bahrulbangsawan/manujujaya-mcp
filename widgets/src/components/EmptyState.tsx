export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div role="status" className="rounded-lg border border-dashed border-line px-4 py-8 text-center">
      <p className="text-sm font-medium text-fg">{title}</p>
      {body ? <p className="mt-1 text-sm text-fg-muted">{body}</p> : null}
    </div>
  );
}
