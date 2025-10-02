/** @format */

import { PageHeader } from '@/components/layout/page-header';
import type { Metadata } from 'next';
import User from './user';

export const metadata: Metadata = {
  title: 'Users',
};

export default function UsersPage() {
  return (
    <div className='space-y-6'>
      <User />
    </div>
  );
}
