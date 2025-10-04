'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2, Bell, Mail, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '../../hooks/use-toast';
import { NotificationPreference, NOTIFICATION_TYPES } from '@/types/notification';

interface NotificationPreferencesProps {
    className?: string;
}

interface PreferenceState {
    enabled: boolean;
    emailEnabled: boolean;
}

type PreferencesMap = Record<string, PreferenceState>;

export function NotificationPreferences({ className }: NotificationPreferencesProps) {
    const [preferences, setPreferences] = useState<PreferencesMap>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const { toast } = useToast();

    // Load preferences on mount
    useEffect(() => {
        loadPreferences();
    }, []);

    const loadPreferences = async () => {
        try {
            setIsLoading(true);
            const response = await fetch('/api/notifications/preferences');

            if (!response.ok) {
                throw new Error('Failed to load preferences');
            }

            const data: NotificationPreference[] = await response.json();

            // Convert array to map for easier manipulation
            const preferencesMap: PreferencesMap = {};

            // Initialize all notification types with defaults
            Object.values(NOTIFICATION_TYPES).forEach(type => {
                preferencesMap[type] = {
                    enabled: true,
                    emailEnabled: false,
                };
            });

            // Override with actual preferences
            data.forEach(pref => {
                preferencesMap[pref.type] = {
                    enabled: pref.enabled,
                    emailEnabled: pref.emailEnabled,
                };
            });

            setPreferences(preferencesMap);
        } catch (error) {
            console.error('Error loading preferences:', error);
            toast({
                title: 'Error',
                description: 'Failed to load notification preferences',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const updatePreference = (type: string, field: 'enabled' | 'emailEnabled', value: boolean) => {
        setPreferences(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                [field]: value,
            },
        }));
        setHasChanges(true);
    };

    const savePreferences = async () => {
        try {
            setIsSaving(true);

            // Convert preferences map to array format for API
            const preferencesArray = Object.entries(preferences).map(([type, pref]) => ({
                type,
                enabled: pref.enabled,
                emailEnabled: pref.emailEnabled,
            }));

            const response = await fetch('/api/notifications/preferences', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ preferences: preferencesArray }),
            });

            if (!response.ok) {
                throw new Error('Failed to save preferences');
            }

            setHasChanges(false);
            toast({
                title: 'Success',
                description: 'Notification preferences saved successfully',
            });
        } catch (error) {
            console.error('Error saving preferences:', error);
            toast({
                title: 'Error',
                description: 'Failed to save notification preferences',
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
        }
    };

    const getNotificationTypeInfo = (type: string) => {
        const typeInfo: Record<string, { label: string; description: string; category: string }> = {
            [NOTIFICATION_TYPES.USER_REGISTERED]: {
                label: 'User Registrations',
                description: 'New user sign-ups and registrations',
                category: 'Admin',
            },
            [NOTIFICATION_TYPES.LEAD_CONVERTED]: {
                label: 'Lead Conversions',
                description: 'When leads are converted to customers',
                category: 'Admin',
            },
            [NOTIFICATION_TYPES.LEAD_ASSIGNED]: {
                label: 'Lead Assignments',
                description: 'When leads are assigned to you',
                category: 'Admin',
            },
            [NOTIFICATION_TYPES.SYSTEM_CLEANUP_COMPLETED]: {
                label: 'System Cleanup',
                description: 'System maintenance and cleanup operations',
                category: 'Admin',
            },
            [NOTIFICATION_TYPES.USER_BANNED]: {
                label: 'User Bans',
                description: 'When users are banned or unbanned',
                category: 'Admin',
            },
            [NOTIFICATION_TYPES.USER_UNBANNED]: {
                label: 'User Unbans',
                description: 'When users are unbanned',
                category: 'Admin',
            },
            [NOTIFICATION_TYPES.SYSTEM_ERROR]: {
                label: 'System Errors',
                description: 'Critical system errors and alerts',
                category: 'Admin',
            },
            [NOTIFICATION_TYPES.BULK_ACTION_COMPLETED]: {
                label: 'Bulk Actions',
                description: 'Completion of bulk operations',
                category: 'Admin',
            },
            // Admin Shipment Notifications
            [NOTIFICATION_TYPES.SHIPMENT_CREATED]: {
                label: 'Shipment Created',
                description: 'When new shipments are created in the system',
                category: 'Shipments (Admin)',
            },
            [NOTIFICATION_TYPES.SHIPMENT_EXCEPTION]: {
                label: 'Shipment Exceptions',
                description: 'When shipments encounter delivery exceptions or issues',
                category: 'Shipments (Admin)',
            },
            [NOTIFICATION_TYPES.SHIPMENT_DELAYED]: {
                label: 'Shipment Delays',
                description: 'When shipments are delayed beyond expected delivery',
                category: 'Shipments (Admin)',
            },
            [NOTIFICATION_TYPES.SHIPMENT_DELIVERY_FAILED]: {
                label: 'Delivery Failures',
                description: 'When shipment delivery attempts fail',
                category: 'Shipments (Admin)',
            },
            [NOTIFICATION_TYPES.ACCOUNT_UPDATED]: {
                label: 'Account Updates',
                description: 'Changes to your account information',
                category: 'Account',
            },
            [NOTIFICATION_TYPES.ACCOUNT_STATUS_CHANGED]: {
                label: 'Account Status',
                description: 'Changes to your account status',
                category: 'Account',
            },
            [NOTIFICATION_TYPES.LEAD_STATUS_UPDATED]: {
                label: 'Lead Status Updates',
                description: 'Updates to your lead status',
                category: 'Account',
            },
            // Customer Shipment Notifications
            [NOTIFICATION_TYPES.SHIPMENT_STATUS_UPDATED]: {
                label: 'Shipment Status Updates',
                description: 'General status updates for your shipments',
                category: 'Shipments (Customer)',
            },
            [NOTIFICATION_TYPES.SHIPMENT_DELIVERED]: {
                label: 'Shipment Delivered',
                description: 'When your shipments are successfully delivered',
                category: 'Shipments (Customer)',
            },
            [NOTIFICATION_TYPES.SHIPMENT_OUT_FOR_DELIVERY]: {
                label: 'Out for Delivery',
                description: 'When your shipments are out for delivery',
                category: 'Shipments (Customer)',
            },
            [NOTIFICATION_TYPES.SHIPMENT_IN_TRANSIT]: {
                label: 'In Transit',
                description: 'When your shipments are in transit',
                category: 'Shipments (Customer)',
            },
            [NOTIFICATION_TYPES.SYSTEM_MAINTENANCE]: {
                label: 'System Maintenance',
                description: 'Scheduled maintenance announcements',
                category: 'System',
            },
            [NOTIFICATION_TYPES.WELCOME]: {
                label: 'Welcome Messages',
                description: 'Welcome and onboarding messages',
                category: 'Account',
            },
        };

        return typeInfo[type] || {
            label: type,
            description: 'Notification type',
            category: 'Other',
        };
    };

    // Group preferences by category
    const groupedPreferences = Object.entries(preferences).reduce((acc, [type, pref]) => {
        const info = getNotificationTypeInfo(type);
        if (!acc[info.category]) {
            acc[info.category] = [];
        }
        acc[info.category].push({ type, pref, info });
        return acc;
    }, {} as Record<string, Array<{ type: string; pref: PreferenceState; info: ReturnType<typeof getNotificationTypeInfo> }>>);

    if (isLoading) {
        return (
            <Card className={className}>
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="ml-3 text-muted-foreground">Loading preferences...</span>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className={`space-y-6 ${className}`}>
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Settings className="h-6 w-6" />
                        Notification Preferences
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Manage how and when you receive notifications
                    </p>
                </div>

                {hasChanges && (
                    <Button
                        onClick={savePreferences}
                        disabled={isSaving}
                        className="gap-2"
                    >
                        {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        Save Changes
                    </Button>
                )}
            </div>

            {Object.entries(groupedPreferences).map(([category, items]) => (
                <Card key={category}>
                    <CardHeader>
                        <CardTitle className="text-lg">{category} Notifications</CardTitle>
                        <CardDescription>
                            Configure {category.toLowerCase()} notification preferences
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {items.map(({ type, pref, info }, index) => (
                            <div key={type}>
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="font-medium">{info.label}</h4>
                                        <p className="text-sm text-muted-foreground">{info.description}</p>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <Bell className="h-4 w-4 text-muted-foreground" />
                                            <div className="space-y-1">
                                                <Label htmlFor={`${type}-enabled`} className="text-sm font-medium">
                                                    In-app notifications
                                                </Label>
                                                <p className="text-xs text-muted-foreground">
                                                    Show notifications in the app
                                                </p>
                                            </div>
                                        </div>
                                        <Switch
                                            id={`${type}-enabled`}
                                            checked={pref.enabled}
                                            onCheckedChange={(checked) => updatePreference(type, 'enabled', checked)}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                            <div className="space-y-1">
                                                <Label htmlFor={`${type}-email`} className="text-sm font-medium">
                                                    Email notifications
                                                </Label>
                                                <p className="text-xs text-muted-foreground">
                                                    Send notifications to your email
                                                </p>
                                            </div>
                                        </div>
                                        <Switch
                                            id={`${type}-email`}
                                            checked={pref.emailEnabled}
                                            onCheckedChange={(checked) => updatePreference(type, 'emailEnabled', checked)}
                                            disabled={!pref.enabled}
                                        />
                                    </div>
                                </div>

                                {index < items.length - 1 && <Separator className="mt-6" />}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            ))}

            {hasChanges && (
                <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                                <span className="text-sm font-medium">You have unsaved changes</span>
                            </div>
                            <Button
                                onClick={savePreferences}
                                disabled={isSaving}
                                size="sm"
                                className="gap-2"
                            >
                                {isSaving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                Save Changes
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}