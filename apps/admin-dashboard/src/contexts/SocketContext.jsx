import React, { createContext, useContext, useState, useMemo } from 'react';

console.log('🔌 SocketContext.jsx: Mock Module loaded');

const SocketContext = createContext();

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};

export const SocketProvider = ({ children }) => {
    // Return a mock socket that doesn't spam connection errors
    const [connected] = useState(true);

    const mockSocket = useMemo(() => ({
        on: (event, callback) => {
            // No-op mock listener
        },
        off: (event, callback) => {
            // No-op mock listener
        },
        emit: (event, data) => {
            // No-op mock sender
        }
    }), []);

    const value = useMemo(() => ({
        socket: mockSocket,
        connected,
    }), [mockSocket, connected]);

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};
