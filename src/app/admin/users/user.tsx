/** @format */

'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { User } from '@/types/user';
import { createColumnHelper } from '@tanstack/react-table';
import HeaderButton from '@/components/table/header-button';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EllipsisVertical, UserPlus, Ban, Shield, Trash2, User as UserIcon, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import DataTable from '@/components/table/DataTable';
import DataTableToolbar from '@/components/table/DataTableToolbar';
import { userApi } from '@/lib/userApi';
import { toast } from 'sonner';
import { AddUserDialog } from './components/AddUserDialog';
import { EditUserDialog } from './components/EditUserDialog';
import { BanUserDialog } from './components/BanUserDialog';
import { DeleteUserDialog } from './components/DeleteUserDialog';

const columnHelper = createColumnHelper<User>();

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    perPage: 50,
    total: 0,
    totalPages: 0,
  });

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [banningUser, setBanningUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const loadUsers = async (page = 1, searchQuery = '') => {
    try {
      setLoading(true);
      const response = await userApi.getUsers({
        page,
        perPage: pagination.perPage,
        q: searchQuery,
        sortBy: 'createdAt',
        sortDir: 'desc',
      });

      setUsers(response.users);
      setPagination(response.pagination);
    } catch (error) {
      toast.error('Failed to load users');
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSearch = (value: string) => {
    setSearch(value);
    loadUsers(1, value);
  };

  const handleDeleteUser = async (user: User) => {
    setDeletingUser(user);
  };

  const handleBanUser = async (user: User) => {
    setBanningUser(user);
  };

  const handleUnbanUser = async (user: User) => {
    try {
      setOperationLoading(`unban-${user.id}`);
      await userApi.unbanUser(user.id);
      toast.success('User unbanned successfully');
      loadUsers(pagination.page, search);
    } catch (error) {
      toast.error('Failed to unban user');
    } finally {
      setOperationLoading(null);
    }
  };

  const handleRoleChange = async (user: User, newRole: 'customer' | 'admin' | 'super-admin') => {
    try {
      setOperationLoading(`role-${user.id}`);
      await userApi.updateUserRole(user.id, { role: newRole });
      toast.success('User role updated successfully');
      loadUsers(pagination.page, search);
    } catch (error) {
      toast.error('Failed to update user role');
    } finally {
      setOperationLoading(null);
    }
  };

  const columns = [
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <div className='h-full flex items-center'>
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label='Select all'
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className='h-full flex items-center'>
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label='Select row'
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    }),
    columnHelper.display({
      id: 'avatar',
      header: 'Avatar',
      cell: ({ row }) => {
        const user = row.original;
        return (
          <Avatar className='h-8 w-8'>
            <AvatarImage src={user.avatarUrl || user.image || undefined} alt={user.name} />
            <AvatarFallback>
              <UserIcon className='h-4 w-4' />
            </AvatarFallback>
          </Avatar>
        );
      },
      enableSorting: false,
      size: 60,
    }),
    columnHelper.accessor('name', {
      header: (info) => <HeaderButton info={info} name='Name' />,
      cell: (info) => {
        const user = info.row.original;
        return (
          <div>
            <div className='font-medium'>{info.getValue()}</div>
            {user.phone && (
              <div className='text-xs text-muted-foreground'>{user.phone}</div>
            )}
          </div>
        );
      },
    }),
    columnHelper.accessor('email', {
      header: (info) => <HeaderButton info={info} name='Email' />,
      cell: (info) => (
        <div className='text-muted-foreground'>
          {info.getValue()}
        </div>
      ),
    }),
    columnHelper.display({
      id: 'location',
      header: 'Location',
      cell: ({ row }) => {
        const user = row.original;
        const location = [user.city, user.state, user.country].filter(Boolean).join(', ');
        return (
          <div className='text-sm'>
            {location || (
              <span className='text-muted-foreground italic'>No location</span>
            )}
          </div>
        );
      },
      enableSorting: false,
    }),
    columnHelper.accessor('role', {
      header: (info) => <HeaderButton info={info} name='Role' />,
      cell: (info) => {
        const role = info.getValue() || 'customer';
        const variant = role === 'admin' || role === 'super-admin' ? 'default' : 'secondary';
        return (
          <Badge variant={variant} className='capitalize'>
            {role}
          </Badge>
        );
      },
    }),
    columnHelper.accessor('banned', {
      header: (info) => <HeaderButton info={info} name='Status' />,
      cell: (info) => {
        const banned = info.getValue();
        return (
          <Badge variant={banned ? 'destructive' : 'outline'}>
            {banned ? 'Banned' : 'Active'}
          </Badge>
        );
      },
    }),
    columnHelper.accessor('emailVerified', {
      header: (info) => <HeaderButton info={info} name='Verified' />,
      cell: (info) => (
        <Badge variant={info.getValue() ? 'default' : 'secondary'}>
          {info.getValue() ? 'Verified' : 'Unverified'}
        </Badge>
      ),
    }),
    columnHelper.accessor('createdAt', {
      header: (info) => <HeaderButton info={info} name='Created' />,
      cell: (info) => (
        <div className='text-sm text-muted-foreground'>
          {new Date(info.getValue()).toLocaleDateString()}
        </div>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const user = row.original;
        const isAdmin = user.role === 'admin' || user.role === 'super-admin';
        const isOperationLoading = operationLoading?.includes(user.id);

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='sm' disabled={isOperationLoading}>
                {isOperationLoading ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <EllipsisVertical size={16} />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => setEditingUser(user)}
                disabled={isOperationLoading}
              >
                <UserPlus className='mr-2 h-4 w-4' />
                Edit User
              </DropdownMenuItem>

              {user.banned ? (
                <DropdownMenuItem
                  onClick={() => handleUnbanUser(user)}
                  disabled={isOperationLoading}
                >
                  {operationLoading === `unban-${user.id}` ? (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  ) : (
                    <Shield className='mr-2 h-4 w-4' />
                  )}
                  Unban User
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => handleBanUser(user)}
                  disabled={isOperationLoading}
                >
                  <Ban className='mr-2 h-4 w-4' />
                  Ban User
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => handleRoleChange(user, 'customer')}
                disabled={isOperationLoading}
              >
                {operationLoading === `role-${user.id}` ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : null}
                Make Customer
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleRoleChange(user, 'admin')}
                disabled={isOperationLoading}
              >
                {operationLoading === `role-${user.id}` ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : null}
                Make Admin
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {!isAdmin && (
                <DropdownMenuItem
                  onClick={() => handleDeleteUser(user)}
                  className='text-destructive'
                  disabled={isOperationLoading}
                >
                  <Trash2 className='mr-2 h-4 w-4' />
                  Delete User
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
      size: 80,
    }),
  ];

  return (
    <div className='w-full flex flex-col items-start gap-4'>
      <div className='w-full'>
        <DataTableToolbar
          value={search}
          onChange={handleSearch}
          onAdd={() => setShowAddDialog(true)}
          addLabel='Add User'
          variant='panel'
          title={`Users (${pagination.total})`}
          isLoading={loading}
        />
      </div>

      <DataTable<User, unknown>
        data={users}
        columns={columns as any}
        initialPageSize={pagination.perPage}
        height={600}
        headerClassName='bg-muted'
        globalFilter={search}
        onGlobalFilterChange={handleSearch}
        isLoading={loading}
      />

      {/* User Management Dialogs */}
      <AddUserDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={() => {
          loadUsers(pagination.page, search);
          setShowAddDialog(false);
        }}
      />

      <EditUserDialog
        user={editingUser}
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
        onSuccess={() => {
          loadUsers(pagination.page, search);
          setEditingUser(null);
        }}
      />

      <BanUserDialog
        user={banningUser}
        open={!!banningUser}
        onOpenChange={(open) => !open && setBanningUser(null)}
        onSuccess={() => {
          loadUsers(pagination.page, search);
          setBanningUser(null);
        }}
      />

      <DeleteUserDialog
        user={deletingUser}
        open={!!deletingUser}
        onOpenChange={(open) => !open && setDeletingUser(null)}
        onSuccess={() => {
          loadUsers(pagination.page, search);
          setDeletingUser(null);
        }}
      />
    </div>
  );
}
