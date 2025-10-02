/** @format */

'use client';

import { useState } from 'react';
import {
  ColumnDef,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  PaginationState,
  RowSelectionState,
  SortingState,
  useReactTable,
  OnChangeFn,
  Updater,
  flexRender,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from 'lucide-react';

export type DataTableProps<TData, TValue> = {
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
  pageSizeOptions?: number[];
  initialPageSize?: number;
  height?: number; // px
  isLoading?: boolean;
  emptyMessage?: string;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  onSortingChange?: (sorting: SortingState) => void;
  getRowId?: (originalRow: TData, index: number, parent?: any) => string;
  headerClassName?: string;
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
};

export function DataTable<TData, TValue>({
  data,
  columns,
  pageSizeOptions = [10, 25, 50, 100],
  initialPageSize = 25,
  height = 400,
  isLoading = false,
  emptyMessage = 'No data to display',
  onRowSelectionChange,
  onSortingChange,
  getRowId,
  headerClassName,
  globalFilter = '',
  onGlobalFilterChange,
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });

  const notifySelection: OnChangeFn<RowSelectionState> = (
    updaterOrValue: Updater<RowSelectionState>
  ) => {
    const next =
      typeof updaterOrValue === 'function'
        ? (updaterOrValue as (old: RowSelectionState) => RowSelectionState)(
          rowSelection
        )
        : updaterOrValue;
    setRowSelection(next);
    onRowSelectionChange?.(next);
  };

  const notifySorting: OnChangeFn<SortingState> = (
    updaterOrValue: Updater<SortingState>
  ) => {
    const next =
      typeof updaterOrValue === 'function'
        ? (updaterOrValue as (old: SortingState) => SortingState)(sorting)
        : updaterOrValue;
    setSorting(next);
    onSortingChange?.(next);
  };

  const table = useReactTable<TData>({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: notifySelection,
    onSortingChange: notifySorting,
    onPaginationChange: setPagination,
    getRowId,
    onGlobalFilterChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? (updater as (old: string) => string)(globalFilter)
          : updater;
      onGlobalFilterChange?.(next);
    },
    state: {
      rowSelection,
      sorting,
      pagination,
      globalFilter,
    },
    globalFilterFn: 'auto',
  });

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className='space-y-2'>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className='flex items-center space-x-4 p-4'>
          <Skeleton className='h-4 w-4' />
          <Skeleton className='h-8 w-8 rounded-full' />
          <div className='space-y-2 flex-1'>
            <Skeleton className='h-4 w-[200px]' />
          </div>
          <Skeleton className='h-4 w-[100px]' />
          <Skeleton className='h-4 w-[80px]' />
          <Skeleton className='h-4 w-[60px]' />
          <Skeleton className='h-4 w-[80px]' />
          <Skeleton className='h-4 w-[60px]' />
          <Skeleton className='h-4 w-[80px]' />
          <Skeleton className='h-8 w-8' />
        </div>
      ))}
    </div>
  );

  return (
    <div className='w-full space-y-4'>
      <div className='rounded-lg border bg-card'>
        <div className='relative'>
          {/* Loading Overlay */}
          {isLoading && data.length > 0 && (
            <div className='absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm'>
              <div className='flex items-center gap-2 rounded-lg border bg-background px-4 py-2 shadow-lg'>
                <Loader2 className='h-4 w-4 animate-spin' />
                <span className='text-sm text-muted-foreground'>Loading...</span>
              </div>
            </div>
          )}

          {/* Table Container */}
          <div className='overflow-hidden'>
            <div className='overflow-x-auto'>
              <table className='w-full'>
                {/* Header */}
                <thead className='bg-muted/50'>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className='border-b'>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className='h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0'
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>

                {/* Body */}
                <tbody>
                  {isLoading && data.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className='p-0'>
                        <LoadingSkeleton />
                      </td>
                    </tr>
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className='h-24 text-center'>
                        <div className='flex flex-col items-center justify-center py-12'>
                          <p className='text-sm text-muted-foreground'>{emptyMessage}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className='border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted'
                        data-state={row.getIsSelected() && 'selected'}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className='p-4 align-middle [&:has([role=checkbox])]:pr-0'
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Pagination */}
      <div className='flex items-center justify-between px-2'>
        <div className='flex-1 text-sm text-muted-foreground'>
          {table.getFilteredSelectedRowModel().rows.length > 0 && (
            <span>
              {table.getFilteredSelectedRowModel().rows.length} of{' '}
              {table.getFilteredRowModel().rows.length} row(s) selected
            </span>
          )}
        </div>
        <div className='flex items-center space-x-6 lg:space-x-8'>
          <div className='flex items-center space-x-2'>
            <p className='text-sm font-medium'>Rows per page</p>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className='h-8 w-[70px] rounded-md border border-input bg-background px-3 py-0 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
            >
              {pageSizeOptions.map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
          </div>
          <div className='flex w-[100px] items-center justify-center text-sm font-medium'>
            Page {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount()}
          </div>
          <div className='flex items-center space-x-2'>
            <Button
              variant='outline'
              className='hidden h-8 w-8 p-0 lg:flex'
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className='sr-only'>Go to first page</span>
              <ChevronsLeft className='h-4 w-4' />
            </Button>
            <Button
              variant='outline'
              className='h-8 w-8 p-0'
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className='sr-only'>Go to previous page</span>
              <ChevronLeft className='h-4 w-4' />
            </Button>
            <Button
              variant='outline'
              className='h-8 w-8 p-0'
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className='sr-only'>Go to next page</span>
              <ChevronRight className='h-4 w-4' />
            </Button>
            <Button
              variant='outline'
              className='hidden h-8 w-8 p-0 lg:flex'
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className='sr-only'>Go to last page</span>
              <ChevronsRight className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataTable;
