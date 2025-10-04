/** @format */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, User, UserPlus, Search } from 'lucide-react';
import { Shipment } from '@/types/shipment';
import { userApi } from '@/lib/userApi';

interface AssignUserDialogProps {
    shipment: Shipment | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

interface User {
    id: string;
    name: string;
    email: string;
    phone?: string;
}

export function AssignUserDialog({
    shipment,
    open,
    onOpenChange,
    onSuccess,
}: AssignUserDialogProps) {
    const [loading, setLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUserId, setSelectedUserId] = useState('');

    // New user form state
    const [newUserName, setNewUserName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPhone, setNewUserPhone] = useState('');

    // Load users when dialog opens
    useEffect(() => {
        if (open) {
            loadUsers();
            // Pre-fill new user form with shipment customer data
            if (shipment) {
                setNewUserName(shipment.customerName);
                setNewUserEmail(shipment.customerEmail);
                setNewUserPhone(shipment.customerPhone || '');
            }
        }
    }, [open, shipment]);

    const loadUsers = async () => {
        setSearchLoading(true);
        try {
            const response = await userApi.getUsers({ perPage: 100 });
            setUsers(response.users);
        } catch (error) {
            console.error('Error loading users:', error);
            toast.error('Failed to load users');
        } finally {
            setSearchLoading(false);
        }
    };

    const handleAssignExistingUser = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!shipment || !selectedUserId) {
            toast.error('Please select a user');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`/api/shipments/${shipment.id}/assign-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: selectedUserId,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to assign user');
            }

            toast.success('User assigned successfully');
            onSuccess();
            handleClose();
        } catch (error) {
            console.error('Error assigning user:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to assign user');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAndAssignUser = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!shipment || !newUserName || !newUserEmail) {
            toast.error('Please fill in all required fields');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`/api/shipments/${shipment.id}/create-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: newUserName,
                    email: newUserEmail,
                    phone: newUserPhone || undefined,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create and assign user');
            }

            toast.success('User created and assigned successfully');
            onSuccess();
            handleClose();
        } catch (error) {
            console.error('Error creating user:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to create user');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setSelectedUserId('');
        setSearchQuery('');
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPhone('');
        onOpenChange(false);
    };

    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Assign User to Shipment
                    </DialogTitle>
                    <DialogDescription>
                        Assign an existing user or create a new user for shipment {shipment?.trackingCode}
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="existing" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="existing">Existing User</TabsTrigger>
                        <TabsTrigger value="new">Create New User</TabsTrigger>
                    </TabsList>

                    <TabsContent value="existing" className="space-y-4">
                        <form onSubmit={handleAssignExistingUser} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="userSearch">Search Users</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        id="userSearch"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search by name or email..."
                                        className="pl-9"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="user">Select User *</Label>
                                <Select value={selectedUserId} onValueChange={setSelectedUserId} required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a user" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {searchLoading ? (
                                            <SelectItem value="loading" disabled>
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                Loading users...
                                            </SelectItem>
                                        ) : filteredUsers.length === 0 ? (
                                            <SelectItem value="no-users" disabled>
                                                No users found
                                            </SelectItem>
                                        ) : (
                                            filteredUsers.map((user) => (
                                                <SelectItem key={user.id} value={user.id}>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{user.name}</span>
                                                        <span className="text-xs text-muted-foreground">{user.email}</span>
                                                    </div>
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleClose}
                                    disabled={loading}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={loading || !selectedUserId}>
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Assign User
                                </Button>
                            </DialogFooter>
                        </form>
                    </TabsContent>

                    <TabsContent value="new" className="space-y-4">
                        <form onSubmit={handleCreateAndAssignUser} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="newUserName">Name *</Label>
                                <Input
                                    id="newUserName"
                                    value={newUserName}
                                    onChange={(e) => setNewUserName(e.target.value)}
                                    placeholder="Enter user name"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="newUserEmail">Email *</Label>
                                <Input
                                    id="newUserEmail"
                                    type="email"
                                    value={newUserEmail}
                                    onChange={(e) => setNewUserEmail(e.target.value)}
                                    placeholder="Enter email address"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="newUserPhone">Phone</Label>
                                <Input
                                    id="newUserPhone"
                                    value={newUserPhone}
                                    onChange={(e) => setNewUserPhone(e.target.value)}
                                    placeholder="Enter phone number"
                                />
                            </div>

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleClose}
                                    disabled={loading}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={loading}>
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    Create & Assign User
                                </Button>
                            </DialogFooter>
                        </form>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}