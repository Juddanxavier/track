'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NotificationDropdown } from './NotificationDropdown';
import { useNotifications } from '@/contexts/NotificationContext';
import { cn } from '@/lib/utils';

interface NotificationBellProps {
    className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [previousCount, setPreviousCount] = useState(0);
    const {
        unreadCount,
        refreshNotifications,
        isConnected,
        isConnecting,
        error
    } = useNotifications();

    const dropdownRef = useRef<HTMLDivElement>(null);
    const animationTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Handle real-time notification updates (animation triggers)
    useEffect(() => {
        // Trigger animation when unread count increases
        if (unreadCount > previousCount) {
            setIsAnimating(true);

            // Clear existing timeout
            if (animationTimeoutRef.current) {
                clearTimeout(animationTimeoutRef.current);
            }

            // Stop animation after 2 seconds
            animationTimeoutRef.current = setTimeout(() => {
                setIsAnimating(false);
            }, 2000);
        }

        setPreviousCount(unreadCount);
    }, [unreadCount, previousCount]);



    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (animationTimeoutRef.current) {
                clearTimeout(animationTimeoutRef.current);
            }
        };
    }, []);

    const handleBellClick = () => {
        setIsOpen(!isOpen);
        if (!isOpen) {
            // Refresh notifications when opening dropdown
            refreshNotifications();
        }
    };

    const displayCount = unreadCount > 99 ? '99+' : unreadCount.toString();
    const hasUnread = unreadCount > 0;

    return (
        <div className={cn('relative', className)} ref={dropdownRef}>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="relative h-9 w-9 transition-colors hover:bg-accent hover:text-accent-foreground"
                            onClick={handleBellClick}
                            aria-label={`Notifications${hasUnread ? ` (${unreadCount} unread)` : ''}`}
                        >
                            <Bell className={cn(
                                "h-4 w-4 transition-all duration-200",
                                // Bell animation when new notifications arrive
                                isAnimating && "animate-notification-bounce text-red-500",
                                // Subtle hover effect
                                "hover:scale-110"
                            )} />

                            {hasUnread && (
                                <div
                                    className={cn(
                                        // Base badge styling - red circle with white text
                                        "absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs font-semibold flex items-center justify-center min-w-[1.25rem]",
                                        // Enhanced styling
                                        "shadow-lg border-2 border-background ring-1 ring-red-400/20",
                                        // Smooth transitions
                                        "transition-all duration-300 ease-out transform-gpu",
                                        // Animation states
                                        isAnimating && [
                                            "animate-notification-pulse",
                                            "animate-notification-glow",
                                            "scale-110"
                                        ],
                                        // Hover effects
                                        "hover:scale-105 hover:shadow-xl"
                                    )}
                                    style={{
                                        // Dynamic sizing based on count length
                                        minWidth: displayCount.length > 2 ? '1.5rem' : '1.25rem',
                                        height: displayCount.length > 2 ? '1.375rem' : '1.25rem',
                                        fontSize: displayCount.length > 2 ? '0.625rem' : '0.75rem',
                                        // Ensure proper z-index
                                        zIndex: 10
                                    }}
                                >
                                    <span className={cn(
                                        "leading-none font-bold transition-all duration-200 select-none",
                                        // Text scaling animation
                                        isAnimating && "animate-pulse"
                                    )}>
                                        {displayCount}
                                    </span>
                                </div>
                            )}

                            {/* Connection status indicator (subtle) */}
                            {isConnected && (
                                <div
                                    className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-green-400 opacity-70"
                                    title="Real-time notifications active"
                                />
                            )}
                            {isConnecting && (
                                <div
                                    className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-yellow-400 opacity-70 animate-pulse"
                                    title="Connecting to real-time notifications..."
                                />
                            )}
                            {error && !isConnected && !isConnecting && (
                                <div
                                    className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-red-400 opacity-70 animate-pulse"
                                    title={`Connection error: ${error}`}
                                />
                            )}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <div className="text-center">
                            <p className="font-medium">
                                Notifications
                                {hasUnread && ` (${unreadCount} unread)`}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {isConnected && '🟢 Real-time updates active'}
                                {isConnecting && '🟡 Connecting...'}
                                {error && !isConnected && !isConnecting && '🔴 Connection error'}
                                {!isConnected && !isConnecting && !error && '⚪ Offline mode'}
                            </p>
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            {isOpen && (
                <NotificationDropdown
                    onClose={() => setIsOpen(false)}
                    onNotificationRead={refreshNotifications}
                />
            )}
        </div>
    );
}