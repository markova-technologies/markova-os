import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { io } from 'socket.io-client';

console.log('🔌 SocketContext.jsx: Module loaded');

const SocketContext = createContext();

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const socketInstance = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
        });

        console.log(`🔌 Attempting to connect to ${SOCKET_URL}`);

        socketInstance.on('connect', () => {
            console.log('✅ Socket.IO connected');
            setConnected(true);
        });

        socketInstance.on('disconnect', () => {
            console.log('❌ Socket.IO disconnected');
            setConnected(false);
        });

        socketInstance.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            setConnected(false);
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, []);

    const value = useMemo(() => ({
        socket,
        connected,
    }), [socket, connected]);

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};
