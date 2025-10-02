/** @format */

import { cn } from '@/lib/utils';
import { flexRender, Header } from '@tanstack/react-table';
import { TableHead } from '@/components/ui/table';

export function DefaultHeader<TData>({
  header,
  className,
}: {
  header: Header<TData, unknown>;
  className?: string;
}) {
  const resizeHandler = header.getResizeHandler();
  return (
    <TableHead
      key={header.column.id}
      colSpan={header.colSpan}
      className={cn(
        'relative font-semibold text-left px-4 py-3 text-sm',
        className
      )}
      style={{
        width: header.column.getSize(),
        minWidth: header.column.columnDef.minSize || 50,
        maxWidth: header.column.columnDef.maxSize || 'none',
      }}
    >
      <div className='flex items-center min-h-[20px]'>
        {flexRender(header.column.columnDef.header, header.getContext())}
      </div>
      <div
        onDoubleClick={() => header.column.resetSize()}
        onMouseDown={resizeHandler}
        onTouchStart={resizeHandler}
        className={cn(
          'absolute right-0 top-0 h-full w-1 hover:bg-primary/30 transition-colors duration-200 select-none cursor-col-resize',
          header.column.getIsResizing() && 'bg-primary/50'
        )}
        style={{ touchAction: 'none' }}
      />
    </TableHead>
  );
}

export default DefaultHeader;
