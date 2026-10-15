import { memo, ReactNode } from 'react';
import { clsx } from 'clsx';

interface TableRowProps {
  children: ReactNode;
  index: number;
  className?: string;
  hoverClassName?: string;
}

/**
 * Memoized table row component to prevent unnecessary re-renders
 * Only re-renders when props actually change
 */
export const TableRow = memo<TableRowProps>(({ children, index, className, hoverClassName = 'hover:bg-gray-50/50' }) => {
  return (
    <tr
      className={clsx(
        'transition-all duration-150 group',
        index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50',
        hoverClassName,
        className
      )}
    >
      {children}
    </tr>
  );
});

TableRow.displayName = 'TableRow';



