'use client';

interface TableSkeletonProps {
  columns: number;
  rows?: number;
  headers: React.ReactNode;
}

export default function TableSkeleton({ columns, rows = 5, headers }: TableSkeletonProps) {
  return (
    <div className="surface-card overflow-hidden">
      {headers}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`grid gap-4 px-5 py-3.5 border-b border-white/[0.03] last:border-b-0`}
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className="h-4 bg-white/[0.05] rounded animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  );
}
