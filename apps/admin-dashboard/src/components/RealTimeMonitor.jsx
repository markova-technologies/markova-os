import React from 'react';
import { useSocket } from '../contexts/SocketContext';
import { IoCloudOffline, IoCloudDone } from 'react-icons/io5';

const RealTimeMonitor = () => {
    const { connected } = useSocket();

    return (
        <div
            className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors duration-300
                ${connected
                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                    : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'}
            `}
        >
            {connected ? (
                <>
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="hidden sm:inline">System Online</span>
                    <IoCloudDone className="w-3.5 h-3.5" />
                </>
            ) : (
                <>
                    <span className="h-2 w-2 rounded-full bg-red-500"></span>
                    <span>Reconnecting...</span>
                    <IoCloudOffline className="w-3.5 h-3.5" />
                </>
            )}
        </div>
    );
};

export default RealTimeMonitor;
