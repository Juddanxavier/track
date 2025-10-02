/** @format */

'use client';

import { useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CleanupSummary } from '@/types/lead';
import { AlertTriangle, Trash2, Archive, CheckCircle } from 'lucide-react';

interface ManualCleanupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCleanupCompleted?: () => void;
}

export function ManualCleanupDialog({
    open,
    onOpenChange,
    onCleanupCompleted,
}: ManualCleanupDialogProps) {
    const [archiveDays, setArchiveDays] = useState(90);
    const [dryRun, setDryRun] = useState(true);
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState<CleanupSummary | null>(null);
    const [dryRunResults, setDryRunResults] = useState<any>(null);

    const handleCleanup = async () => {
        setLoading(true);
        setSummary(null);
        setDryRunResults(null);

        try {
            const response = await fetch('/api/lead/cleanup/run', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    archiveDays,
                    dryRun,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to run cleanup');
            }

            const data = await response.json();

            if (dryRun) {
                setDryRunResults(data);
                toast.success('Dry run completed successfully');
            } else {
                setSummary(data.summary);
                toast.success('Cleanup completed successfully');
                onCleanupCompleted?.();
            }
        } catch (error) {
            console.error('Error running cleanup:', error);
            toast.error('Failed to run cleanup');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setSummary(null);
        setDryRunResults(null);
        setDryRun(true);
    };

    const handleClose = () => {
        handleReset();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        Manual Lead Cleanup
                    </DialogTitle>
                    <DialogDescription>
                        Run lead cleanup manually to delete expired failed leads and archive successful leads.
                        Use dry run first to preview what will be affected.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="archiveDays">
                            Archive successful leads after (days)
                        </Label>
                        <Input
                            id="archiveDays"
                            type="number"
                            min="1"
                            max="365"
                            value={archiveDays}
                            onChange={(e) => setArchiveDays(parseInt(e.target.value) || 90)}
                            disabled={loading}
                        />
                        <p className="text-sm text-muted-foreground">
                            Successful leads older than this will be moved to archive.
                        </p>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Switch
                            id="dryRun"
                            checked={dryRun}
                            onCheckedChange={setDryRun}
                            disabled={loading}
                        />
                        <Label htmlFor="dryRun">Dry run (preview only)</Label>
                    </div>

                    {dryRunResults && (
                        <div className="border rounded-lg p-4 bg-muted/50">
                            <h4 className="font-medium mb-3 flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                Dry Run Results
                            </h4>
                            <div className="grid gap-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                        <span>Leads to delete:</span>
                                    </div>
                                    <Badge variant="destructive">
                                        {dryRunResults.summary.deletedCount}
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Archive className="h-4 w-4 text-blue-500" />
                                        <span>Leads to archive:</span>
                                    </div>
                                    <Badge variant="secondary">
                                        {dryRunResults.summary.archivedCount}
                                    </Badge>
                                </div>
                                {(dryRunResults.leadsToDelete?.length > 0 || dryRunResults.leadsToArchive?.length > 0) && (
                                    <div className="mt-3 text-sm text-muted-foreground">
                                        <p>Preview shows the first few leads that would be affected.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {summary && (
                        <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950/20">
                            <h4 className="font-medium mb-3 flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                Cleanup Completed
                            </h4>
                            <div className="grid gap-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                        <span>Leads deleted:</span>
                                    </div>
                                    <Badge variant="destructive">{summary.deletedCount}</Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Archive className="h-4 w-4 text-blue-500" />
                                        <span>Leads archived:</span>
                                    </div>
                                    <Badge variant="secondary">{summary.archivedCount}</Badge>
                                </div>
                                {summary.errors.length > 0 && (
                                    <div className="mt-3">
                                        <p className="text-sm font-medium text-red-600 dark:text-red-400">
                                            Errors encountered:
                                        </p>
                                        <ul className="text-sm text-red-600 dark:text-red-400 mt-1">
                                            {summary.errors.map((error, index) => (
                                                <li key={index} className="truncate">
                                                    • {error}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                <div className="text-sm text-muted-foreground">
                                    Completed at: {new Date(summary.runAt).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={loading}>
                        {summary ? 'Close' : 'Cancel'}
                    </Button>
                    {!summary && (
                        <>
                            {dryRunResults && (
                                <Button
                                    variant="outline"
                                    onClick={handleReset}
                                    disabled={loading}
                                >
                                    Reset
                                </Button>
                            )}
                            <Button
                                onClick={handleCleanup}
                                disabled={loading}
                                variant={dryRun ? 'default' : 'destructive'}
                            >
                                {loading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                                        Running...
                                    </div>
                                ) : dryRun ? (
                                    'Run Dry Run'
                                ) : (
                                    'Run Cleanup'
                                )}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}