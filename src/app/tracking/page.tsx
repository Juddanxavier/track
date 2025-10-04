/** @format */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, Search } from 'lucide-react';

export default function TrackingHomePage() {
    const [trackingCode, setTrackingCode] = useState('');
    const router = useRouter();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (trackingCode.trim()) {
            router.push(`/tracking/${encodeURIComponent(trackingCode.trim())}`);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="container mx-auto px-4 py-16 max-w-2xl">
                <div className="text-center mb-12">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-blue-100 rounded-full">
                            <Package className="h-12 w-12 text-blue-600" />
                        </div>
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">Track Your Shipment</h1>
                    <p className="text-xl text-gray-600">
                        Enter your tracking code to get real-time updates on your package
                    </p>
                </div>

                <Card className="shadow-lg">
                    <CardHeader className="text-center">
                        <CardTitle>Enter Tracking Code</CardTitle>
                        <CardDescription>
                            Your tracking code starts with "SC" followed by 9 digits
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="trackingCode">Tracking Code</Label>
                                <Input
                                    id="trackingCode"
                                    type="text"
                                    placeholder="SC123456789"
                                    value={trackingCode}
                                    onChange={(e) => setTrackingCode(e.target.value)}
                                    className="text-lg h-12"
                                    autoFocus
                                />
                            </div>
                            <Button
                                type="submit"
                                className="w-full h-12 text-lg"
                                disabled={!trackingCode.trim()}
                            >
                                <Search className="h-5 w-5 mr-2" />
                                Track Package
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <div className="mt-12 text-center">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">How to Track</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-600">
                        <div className="flex flex-col items-center">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                                <span className="font-semibold text-blue-600">1</span>
                            </div>
                            <p>Enter your tracking code</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                                <span className="font-semibold text-blue-600">2</span>
                            </div>
                            <p>View real-time updates</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                                <span className="font-semibold text-blue-600">3</span>
                            </div>
                            <p>Track until delivery</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}