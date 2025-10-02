/** @format */

import { HeaderContext } from '@tanstack/react-table';
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface HeaderButtonProps<TData, TValue> {
  info: HeaderContext<TData, TValue>;
  name: string;
}

export function HeaderButton<TData, TValue>({
  info,
  name,
}: HeaderButtonProps<TData, TValue>) {
  const { table } = info;
  const sorted = info.column.getIsSorted();

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className='flex items-center space-x-2 cursor-pointer select-none'
          onClick={() => info.column.toggleSorting(info.column.getIsSorted() === 'asc')}
        >
          <span className='font-medium'>{name}</span>
          {sorted === 'asc' && <ArrowUpIcon className='h-4 w-4' />}
          {sorted === 'desc' && <ArrowDownIcon className='h-4 w-4' />}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {table
          .getAllColumns()
          .filter((column) => column.getCanHide())
          .map((column) => (
            <ContextMenuCheckboxItem
              key={column.id}
              className='capitalize'
              checked={column.getIsVisible()}
              onCheckedChange={(value) => column.toggleVisibility(!!value)}
            >
              {column.id}
            </ContextMenuCheckboxItem>
          ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export default HeaderButton;
