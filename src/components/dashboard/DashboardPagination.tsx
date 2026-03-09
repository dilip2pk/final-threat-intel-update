interface DashboardPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function DashboardPagination({ page, totalPages, onPageChange }: DashboardPaginationProps) {
  const maxVisible = 5;

  const getPageNumbers = () => {
    if (totalPages <= maxVisible) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    const adjusted = Math.max(1, end - maxVisible + 1);
    return Array.from({ length: end - adjusted + 1 }, (_, i) => adjusted + i);
  };

  const pages = getPageNumbers();

  return (
    <div className="flex items-center justify-center gap-1 pt-2">
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="h-8 px-2.5 text-xs font-mono rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent/50 disabled:opacity-30 transition-all"
      >
        ‹
      </button>
      {pages[0] > 1 && (
        <>
          <button onClick={() => onPageChange(1)} className="h-8 w-8 text-xs font-mono rounded-lg border border-border text-muted-foreground hover:bg-accent/50 transition-all">1</button>
          {pages[0] > 2 && <span className="text-xs text-muted-foreground px-1">…</span>}
        </>
      )}
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`h-8 w-8 text-xs font-mono rounded-lg border transition-all ${
            page === p
              ? "bg-primary/15 text-primary border-primary/30 font-semibold"
              : "text-muted-foreground border-border hover:bg-accent/50"
          }`}
        >
          {p}
        </button>
      ))}
      {pages[pages.length - 1] < totalPages && (
        <>
          {pages[pages.length - 1] < totalPages - 1 && <span className="text-xs text-muted-foreground px-1">…</span>}
          <button onClick={() => onPageChange(totalPages)} className="h-8 w-8 text-xs font-mono rounded-lg border border-border text-muted-foreground hover:bg-accent/50 transition-all">{totalPages}</button>
        </>
      )}
      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="h-8 px-2.5 text-xs font-mono rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent/50 disabled:opacity-30 transition-all"
      >
        ›
      </button>
    </div>
  );
}
