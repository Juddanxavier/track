/** @format */

'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

export type DataTableToolbarProps = {
  value: string;
  onChange: (value: string) => void;
  onAdd?: () => void;
  addLabel?: string;
  variant?: 'inline' | 'panel';
  title?: string;
  isLoading?: boolean;
};

export default function DataTableToolbar({
  value,
  onChange,
  onAdd,
  addLabel = 'Add',
  variant = 'inline',
  title,
  isLoading = false,
}: DataTableToolbarProps) {
  if (variant === 'panel') {
    return (
      <div className='rounded-md border border-border bg-card p-3 shadow-sm'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex items-center gap-2'>
            {title && (
              <div className='flex items-center gap-2'>
                <h3 className='text-base font-semibold'>{title}</h3>
                {isLoading && <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />}
              </div>
            )}
            <Input
              placeholder='Search...'
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className='max-w-xs'
              disabled={isLoading}
            />
          </div>
          <div className='flex items-center gap-2'>
            {onAdd && <Button onClick={onAdd} disabled={isLoading}>{addLabel}</Button>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex items-center justify-between gap-2'>
      <Input
        placeholder='Search...'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className='max-w-xs'
      />
      {onAdd && <Button onClick={onAdd}>{addLabel}</Button>}
    </div>
  );
}
