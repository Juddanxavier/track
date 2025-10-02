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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { CleanupConfig } from '@/types/lead';

interface CleanupConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfigUpdated?: () => void;
}

export function CleanupConfigDialog({
    open,
    onOpenChange,
    onConfigUpdated,
}: CleanupConfigDialogProps) {
    const [config, setConfig] = useState<CleanupConfig>({
        failedLeadRetentionDays: 45,
        successLeadArchiveDays: 90,
        isEnabled: true,
        lastRunAt: null,
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            fetchConfig();
        }
    }, [open]);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/lead/cleanup/config');
            if (!response.ok) {
                throw new Error('Failed to fetch cleanup configuration');
            }
            const data = await response.json();
            setConfig(data.config);
        } catch (error) {
            console.error('Error fetching cleanup config:', error);
            toast.error('Failed to load cleanup configuration');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const response = await fetch('/api/lead/cleanup/config', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    failedLeadRetentionDays: config.failedLeadRetentionDays,
                    successLeadArchiveDays: config.successLeadArchiveDays,
                    isEnabled: config.isEnabled,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to update cleanup configuration');
            }

            toast.success('Cleanup configuration updated successfully');
            onConfigUpdated?.();
            onOpenChange(false);
        } catch (error) {
            console.error('Error updating cleanup config:', error);
            toast.error('Failed to update cleanup configuration');
        } finally {
            setSaving(false);
        }
    };

    const handleInputChange = (field: keyof CleanupConfig, value: any) => {
        setConfig(prev => ({
            ...prev,
            [field]: value,
        }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Cleanup Configuration</DialogTitle>
                    <DialogDescription>
                        Configure automatic cleanup settings for lead lifecycle management.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    </div>
                ) : (
                    <div className="grid gap-6 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="failedRetention">
                                Failed Lead Retention (days)
                            </Label>
                            <Input
                                id="failedRetention"
                                type="number"
                                min="1"
                                max="365"
                                value={config.failedLeadRetentionDays}
                                onChange={(e) =>
                                    handleInputChange('failedLeadRetentionDays', parseInt(e.target.value))
                                }
                                placeholder="45"
                            />
                            <p className="text-sm text-muted-foreground">
                                Failed leads will be automatically deleted after this many days.
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="successArchive">
                                Success Lead Archive (days)
                            </Label>
                            <Input
                                id="successArchive"
                                type="number"
                                min="1"
                                max="365"
                                value={config.successLeadArchiveDays}
                                onChange={(e) =>
                                    handleInputChange('successLeadArchiveDays', parseInt(e.target.value))
                                }
                                placeholder="90"
                            />
                            <p className="text-sm text-muted-foreground">
                                Successful leads will be moved to archive after this many days.
                            </p>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Switch
                                id="enabled"
                                checked={config.isEnabled}
                                onCheckedChange={(checked) =>
                                    handleInputChange('isEnabled', checked)
                                }
                            />
                            <Label htmlFor="enabled">Enable automatic cleanup</Label>
                        </div>

                        {config.lastRunAt && (
                            <div className="grid gap-2">
                                <Label>Last Cleanup Run</Label>
                                <p className="text-sm text-muted-foreground">
                                    {new Date(config.lastRunAt).toLocaleString()}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={loading || saving}>
                        {saving ? 'Saving...' : 'Save Configuration'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}