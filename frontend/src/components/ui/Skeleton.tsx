import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export default function Skeleton({
  className,
  variant = 'rectangular',
  width,
  height,
  lines,
}: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-gray-200 rounded';

  const variantClasses = {
    text: 'h-4',
    circular: 'rounded-full',
    rectangular: 'rounded',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  if (lines && variant === 'text') {
    return (
      <div className={className}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={clsx(
              baseClasses,
              variantClasses.text,
              i < lines - 1 && 'mb-2'
            )}
            style={i === lines - 1 ? { width: '80%' } : { width: '100%' }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={clsx(baseClasses, variantClasses[variant], className)}
      style={style}
    />
  );
}

// Pre-built skeleton components for common use cases
export function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <Skeleton variant="rectangular" height={24} width="60%" className="mb-4" />
      <Skeleton variant="text" lines={3} />
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={20} className="flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} variant="rectangular" height={16} className="flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <div className="flex items-start justify-between mb-4">
        <Skeleton variant="circular" width={48} height={48} />
        <Skeleton variant="rectangular" width={60} height={20} />
      </div>
      <Skeleton variant="rectangular" height={16} width="40%" className="mb-2" />
      <Skeleton variant="rectangular" height={32} width="70%" />
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <Skeleton variant="rectangular" height={120} className="mb-4 rounded-lg" />
      <Skeleton variant="rectangular" height={20} width="80%" className="mb-2" />
      <Skeleton variant="rectangular" height={16} width="60%" className="mb-4" />
      <div className="flex justify-between items-center">
        <Skeleton variant="rectangular" height={24} width={80} />
        <Skeleton variant="rectangular" height={36} width={100} />
      </div>
    </div>
  );
}



