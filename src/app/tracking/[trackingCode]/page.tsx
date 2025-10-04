/** @format */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Package, MapPin, Clock, CheckCircle, XCircle, Truck, Home } from 'lucide-react';
import type { PublicShipmentInfo, ShipmentStatusType, EventTypeType } from '@/types/shipment';

interface TrackingResponse {
    success: boolean;
    data?: PublicShipmentInfo;
    error?: string;
    message?: string;
    retryAfter?: number;
}

const statusConfig: Record<ShipmentStatusType, { label: string; color: string; icon: React.ReactNode }> = {
    'pending': {
        label: 'Pending',
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: <Clock className="h-4 w-4" />
    },
    'in-transit': {
        label: 'In Transit',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: <Truck className="h-4 w-4" />
    },
    'out-for-delivery': {
        label: 'Out for Delivery',
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        icon: <MapPin className="h-4 w-4" />
    },
    'delivered': {
        label: 'Delivered',
        color: 'bg-green-100 text-green-800 border-green-200',
        icon: <CheckCircle className="h-4 w-4" />
    },
    'exception': {
        label: 'Exception',
        color: 'bg-red-100 text-red-800 border-red-200',
        icon: <AlertCircle className="h-4 w-4" />
    },
    'cancelled': {
        label: 'Cancelled',
        color: 'bg-gray-100 text-gray-800 border-gray-200',
        icon: <XCircle className="h-4 w-4" />
    },
};

const eventTypeConfig: Record<EventTypeType, { label: string; icon: React.ReactNode }> = {
    'api_ingestion': { label: 'Shipment Created', icon: <Package className="h-4 w-4" /> },
    'tracking_assigned': { label: 'Tracking Assigned', icon: <Package className="h-4 w-4" /> },
    'user_assigned': { label: 'User Assigned', icon: <Package className="h-4 w-4" /> },
    'signup_sent': { label: 'Signup Invitation Sent', icon: <Package className="h-4 w-4" /> },
    'signup_completed': { label: 'Account Created', icon: <CheckCircle className="h-4 w-4" /> },
    'status_change': { label: 'Status Update', icon: <AlertCircle className="h-4 w-4" /> },
    'location_update': { label: 'Location Update', icon: <MapPin className="h-4 w-4" /> },
    'delivery_attempt': { label: 'Delivery Attempt', icon: <Home className="h-4 w-4" /> },
    'pickup': { label: 'Pickup', icon: <Package className="h-4 w-4" /> },
    'in_transit': { label: 'In Transit', icon: <Truck className="h-4 w-4" /> },
    'out_for_delivery': { label: 'Out for Delivery', icon: <MapPin className="h-4 w-4" /> },
    'delivered': { label: 'Delivered', icon: <CheckCircle className="h-4 w-4" /> },
    'exception': { label: 'Exception', icon: <AlertCircle className="h-4 w-4" /> },
    'cancelled': { label: 'Cancelled', icon: <XCircle className="h-4 w-4" /> },
};

function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(date));
}

function formatDateShort(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(date));
}

export default function TrackingPage() {
    const params = useParams();
    const trackingCode = params.trackingCode as string;

    const [trackingInfo, setTrackingInfo] = useState<PublicShipmentInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchCode, setSearchCode] = useState(trackingCode || '');

    const fetchTrackingInfo = async (code: string) => {
        if (!code) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/tracking/${encodeURIComponent(code)}`);
            const data: TrackingResponse = await response.json();

            if (data.success && data.data) {
                setTrackingInfo(data.data);
            } else {
                setError(data.message || 'Tracking information not found');
                setTrackingInfo(null);
            }
        } catch (err) {
            setError('Failed to fetch tracking information. Please try again.');
            setTrackingInfo(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (trackingCode) {
            fetchTrackingInfo(trackingCode);
        } else {
            setLoading(false);
        }
    }, [trackingCode]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchCode.trim()) {
            window.history.pushState({}, '', `/tracking/${encodeURIComponent(searchCode.trim())}`);
            fetchTrackingInfo(searchCode.trim());
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Track Your Shipment</h1>
                    <p className="text-gray-600">Enter your tracking code to get real-time updates</p>
                </div>

                {/* Search Form */}
                <Card className="mb-8">
                    <CardContent className="pt-6">
                        <form onSubmit={handleSearch} className="flex gap-4">
                            <div className="flex-1">
                                <Label htmlFor="trackingCode" className="sr-only">
                                    Tracking Code
                                </Label>
                                <Input
                                    id="trackingCode"
                                    type="text"
                                    placeholder="Enter tracking code (e.g., SC123456789)"
                                    value={searchCode}
                                    onChange={(e) => setSearchCode(e.target.value)}
                                    className="text-lg"
                                />
                            </div>
                            <Button type="submit" size="lg" disabled={loading}>
                                {loading ? 'Searching...' : 'Track'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Loading State */}
                {loading && (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <Skeleton className="h-6 w-48" />
                                <Skeleton className="h-4 w-32" />
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Error State */}
                {error && !loading && (
                    <Card className="border-red-200 bg-red-50">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3 text-red-800">
                                <AlertCircle className="h-5 w-5" />
                                <div>
                                    <p className="font-medium">Tracking Information Not Found</p>
                                    <p className="text-sm text-red-600">{error}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Tracking Information */}
                {trackingInfo && !loading && (
                    <div className="space-y-6">
                        {/* Status Overview */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-xl">Tracking Code: {trackingInfo.trackingCode}</CardTitle>
                                        <CardDescription>
                                            Current status: {statusConfig[trackingInfo.status].label}
                                        </CardDescription>
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className={`${statusConfig[trackingInfo.status].color} flex items-center gap-2 px-3 py-1`}
                                    >
                                        {statusConfig[trackingInfo.status].icon}
                                        {statusConfig[trackingInfo.status].label}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {trackingInfo.estimatedDelivery && (
                                        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                                            <Clock className="h-5 w-5 text-blue-600" />
                                            <div>
                                                <p className="font-medium text-blue-900">Estimated Delivery</p>
                                                <p className="text-sm text-blue-700">
                                                    {formatDate(trackingInfo.estimatedDelivery)}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    {trackingInfo.status === 'delivered' && (
                                        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                                            <CheckCircle className="h-5 w-5 text-green-600" />
                                            <div>
                                                <p className="font-medium text-green-900">Delivered</p>
                                                <p className="text-sm text-green-700">
                                                    Check tracking history for delivery details
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Tracking Events */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Tracking History</CardTitle>
                                <CardDescription>
                                    Follow your shipment's journey from pickup to delivery
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {trackingInfo.events.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">
                                        No tracking events available yet.
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        {trackingInfo.events.map((event, index) => (
                                            <div key={index} className="flex gap-4">
                                                <div className="flex flex-col items-center">
                                                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                                                        {eventTypeConfig[event.eventType]?.icon || <Package className="h-4 w-4" />}
                                                    </div>
                                                    {index < trackingInfo.events.length - 1 && (
                                                        <div className="w-px h-8 bg-gray-200 mt-2" />
                                                    )}
                                                </div>
                                                <div className="flex-1 pb-4">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <p className="font-medium text-gray-900">
                                                            {eventTypeConfig[event.eventType]?.label || event.eventType}
                                                        </p>
                                                        <p className="text-sm text-gray-500">
                                                            {formatDateShort(event.eventTime)}
                                                        </p>
                                                    </div>
                                                    <p className="text-gray-600 text-sm">{event.description}</p>
                                                    {event.location && (
                                                        <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                                                            <MapPin className="h-3 w-3" />
                                                            {event.location}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Signup Call-to-Action */}
                        {trackingInfo.canSignup && trackingInfo.signupPrefilledData && (
                            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                                <CardHeader>
                                    <CardTitle className="text-blue-900">Create Your Account</CardTitle>
                                    <CardDescription className="text-blue-700">
                                        Get enhanced tracking features and delivery notifications
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                            <div className="flex items-center gap-2 text-blue-800">
                                                <CheckCircle className="h-4 w-4" />
                                                <span>Real-time notifications</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-blue-800">
                                                <CheckCircle className="h-4 w-4" />
                                                <span>Delivery preferences</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-blue-800">
                                                <CheckCircle className="h-4 w-4" />
                                                <span>Order history</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <Button
                                                className="bg-blue-600 hover:bg-blue-700"
                                                onClick={() => {
                                                    // Create signup URL with pre-filled data
                                                    const signupUrl = new URL('/auth/signup', window.location.origin);
                                                    signupUrl.searchParams.set('name', trackingInfo.signupPrefilledData!.name);
                                                    signupUrl.searchParams.set('email', trackingInfo.signupPrefilledData!.email);
                                                    signupUrl.searchParams.set('trackingCode', trackingInfo.trackingCode);
                                                    signupUrl.searchParams.set('from', 'tracking');

                                                    window.location.href = signupUrl.toString();
                                                }}
                                            >
                                                Create Account - It's Free!
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="border-blue-300 text-blue-700 hover:bg-blue-50"
                                                onClick={() => {
                                                    // Create login URL
                                                    const loginUrl = new URL('/auth/login', window.location.origin);
                                                    loginUrl.searchParams.set('redirect', `/tracking/${trackingInfo.trackingCode}`);

                                                    window.location.href = loginUrl.toString();
                                                }}
                                            >
                                                Already have an account? Sign In
                                            </Button>
                                        </div>

                                        <div className="text-xs text-blue-600 bg-blue-100 p-3 rounded-lg">
                                            <p className="font-medium mb-1">Your information is ready:</p>
                                            <p>Name: {trackingInfo.signupPrefilledData.name}</p>
                                            <p>Email: {trackingInfo.signupPrefilledData.email}</p>
                                            <p className="mt-1 text-blue-500">We'll automatically link this shipment to your new account.</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Help Section */}
                        <Card className="bg-gray-50">
                            <CardContent className="pt-6">
                                <div className="text-center">
                                    <h3 className="font-medium text-gray-900 mb-2">Need Help?</h3>
                                    <p className="text-sm text-gray-600 mb-4">
                                        If you have questions about your shipment, please contact our support team.
                                    </p>
                                    <Button variant="outline" size="sm">
                                        Contact Support
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}