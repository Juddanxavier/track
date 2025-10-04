'use client';

import { useEffect, useState } from 'react';
import { useNotifications, NotificationProvider } from '@/contexts/NotificationContext';
import { authClient } from '@/lib/auth-client';

function TestSSEPageContent() {
    const [logs, setLogs] = useState<string[]>([]);
    const [testResults, setTestResults] = useState<any>(null);
    const { data: session } = authClient.useSession();
    const notifications = useNotifications();

    const addLog = (message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]);
        console.log(`[SSE Test] ${message}`);
    };

    useEffect(() => {
        addLog('Notification test page loaded');
        if (session?.user?.id) {
            addLog(`User authenticated: ${session.user.id}`);
        } else {
            addLog('No user session found');
        }
    }, [session]);

    useEffect(() => {
        addLog(`Polling state: ${notifications.isConnected ? 'Active' : 'Stopped'}`);
        if (notifications.isConnecting) {
            addLog('Starting polling...');
        }
        if (notifications.error) {
            addLog(`Polling error: ${notifications.error}`);
        }
    }, [notifications.isConnected, notifications.isConnecting, notifications.error]);

    const testNotificationEndpoint = async () => {
        try {
            addLog('Testing notification endpoints...');

            // Test recent notifications
            const recentResponse = await fetch('/api/notifications/recent');
            const recentData = await recentResponse.json();

            addLog(`Recent notifications: ${JSON.stringify(recentData, null, 2)}`);
            setTestResults(recentData);

            // Test unread count
            const unreadResponse = await fetch('/api/notifications/unread-count');
            const unreadData = await unreadResponse.json();

            addLog(`Unread count: ${JSON.stringify(unreadData, null, 2)}`);

        } catch (error) {
            addLog(`Test failed: ${error}`);
        }
    };

    const testUnreadCount = async () => {
        try {
            addLog('Testing unread count endpoint...');

            const response = await fetch('/api/notifications/unread-count');
            const data = await response.json();

            addLog(`Unread count: ${JSON.stringify(data, null, 2)}`);

        } catch (error) {
            addLog(`Unread count test failed: ${error}`);
        }
    };

    const testAuth = async () => {
        try {
            addLog('Testing authentication...');

            const response = await fetch('/api/notifications/test-auth');
            const data = await response.json();

            addLog(`Auth test: ${JSON.stringify(data, null, 2)}`);

        } catch (error) {
            addLog(`Auth test failed: ${error}`);
        }
    };

    const forceReconnect = () => {
        addLog('Forcing SSE reconnection...');
        notifications.forceReconnect();
    };

    return (
        <div className="container text-black mx-auto p-6 max-w-4xl">
            <h1 className="text-2xl font-bold mb-6">Notification System Test</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Connection Status */}
                <div className="bg-white p-4 rounded-lg shadow">
                    <h2 className="text-lg font-semibold mb-4">Connection Status</h2>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${notifications.isConnected ? 'bg-green-500' :
                                notifications.isConnecting ? 'bg-yellow-500' :
                                    'bg-red-500'
                                }`} />
                            <span>
                                {notifications.isConnected ? 'Polling Active' :
                                    notifications.isConnecting ? 'Starting...' :
                                        'Polling Stopped'}
                            </span>
                        </div>
                        <p>User ID: {session?.user?.id || 'Not logged in'}</p>
                        <p>Connection ID: {notifications.connectionId || 'None'}</p>
                        <p>Unread Count: {notifications.unreadCount}</p>
                        <p>Reconnect Attempts: {notifications.reconnectAttempts}</p>
                        {notifications.error && (
                            <p className="text-red-600">Error: {notifications.error}</p>
                        )}
                    </div>
                </div>

                {/* Test Controls */}
                <div className="bg-white p-4 rounded-lg shadow">
                    <h2 className="text-lg font-semibold mb-4">Test Controls</h2>
                    <div className="space-y-2">
                        <button
                            onClick={testNotificationEndpoint}
                            className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        >
                            Test Notification Endpoints
                        </button>
                        <button
                            onClick={testUnreadCount}
                            className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                        >
                            Test Unread Count
                        </button>
                        <button
                            onClick={testAuth}
                            className="w-full bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
                        >
                            Test Authentication
                        </button>
                        <button
                            onClick={forceReconnect}
                            className="w-full bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600"
                        >
                            Restart Polling
                        </button>
                        <button
                            onClick={() => setLogs([])}
                            className="w-full bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                        >
                            Clear Logs
                        </button>
                    </div>
                </div>
            </div>

            {/* Test Results */}
            {testResults && (
                <div className="mt-6 bg-white p-4 rounded-lg shadow">
                    <h2 className="text-lg font-semibold mb-4">Test Results</h2>
                    <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                        {JSON.stringify(testResults, null, 2)}
                    </pre>
                </div>
            )}

            {/* Logs */}
            <div className="mt-6 bg-white p-4 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4">Logs</h2>
                <div className="bg-black text-green-400 p-4 rounded font-mono text-sm h-64 overflow-auto">
                    {logs.map((log, index) => (
                        <div key={index}>{log}</div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function TestSSEPage() {
    return (
        <NotificationProvider>
            <TestSSEPageContent />
        </NotificationProvider>
    );
}