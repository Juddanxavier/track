/** @format */

import { Cell, flexRender } from '@tanstack/react-table';
import { TableCell } from '@/components/ui/table';

export function DefaultCell<TData>({ cell }: { cell: Cell<TData, unknown> }) {
  return (
    <TableCell
      key={cell.id}
      className='px-4 py-2 text-sm'
      style={{
        width: cell.column.getSize(),
        minWidth: cell.column.columnDef.minSize || 50,
        maxWidth: cell.column.columnDef.maxSize || 'none',
      }}
    >
      <div className='flex items-center min-h-[20px]'>
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </div>
    </TableCell>
  );
}
