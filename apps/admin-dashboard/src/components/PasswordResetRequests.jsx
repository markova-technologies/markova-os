import React, { useState, useEffect } from 'react';
import { Check, X, Clock, RefreshCw } from 'lucide-react';

const PasswordResetRequests = ({ socket }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionError, setActionError] = useState(null);
    const [confirmRejectId, setConfirmRejectId] = useState(null);

    useEffect(() => {
        fetchRequests();

        if (socket) {
            socket.on('newPasswordResetRequest', (newRequest) => {
                setRequests(prev => [newRequest, ...prev]);
            });

            socket.on('passwordResetRequestUpdated', (updatedRequest) => {
                setRequests(prev => prev.map(req =>
                    req.id === updatedRequest.id ? updatedRequest : req
                ));
            });
        }

        return () => {
            if (socket) {
                socket.off('newPasswordResetRequest');
                socket.off('passwordResetRequestUpdated');
            }
        };
    }, [socket]);

    const fetchRequests = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/password-reset-requests');
            if (!response.ok) throw new Error('Failed to fetch requests');
            const data = await response.json();
            // Sort by requestedAt descending
            setRequests(data.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt)));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id) => {
        setActionError(null);
        try {
            const response = await fetch(`http://localhost:5000/api/password-reset-requests/${id}/approve`, {
                method: 'POST'
            });
            if (!response.ok) throw new Error('Failed to approve request');

            // Optimistic update
            setRequests(prev => prev.map(req =>
                req.id === id ? { ...req, status: 'approved' } : req
            ));
        } catch (err) {
            setActionError('Error approving request: ' + err.message);
        }
    };

    const handleReject = async (id) => {
        setConfirmRejectId(null);
        setActionError(null);
        try {
            const response = await fetch(`http://localhost:5000/api/password-reset-requests/${id}/reject`, {
                method: 'POST'
            });
            if (!response.ok) throw new Error('Failed to reject request');

            // Optimistic update
            setRequests(prev => prev.map(req =>
                req.id === id ? { ...req, status: 'rejected' } : req
            ));
        } catch (err) {
            setActionError('Error rejecting request: ' + err.message);
        }
    };

    if (loading) return <div className="p-4 text-gray-400">Loading requests...</div>;

    const pendingRequests = requests.filter(r => r.status === 'pending');

    if (pendingRequests.length === 0) {
        return (
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center">
                <div className="flex justify-center mb-3">
                    <div className="p-3 bg-slate-700/50 rounded-full">
                        <Check className="w-6 h-6 text-emerald-500" />
                    </div>
                </div>
                <h3 className="text-lg font-medium text-white mb-1">All Clear</h3>
                <p className="text-slate-400 text-sm">No pending password reset requests</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-indigo-400" />
                    Password Reset Requests
                    <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs rounded-full border border-indigo-500/30">
                        {pendingRequests.length} Pending
                    </span>
                </h3>
            </div>

            {actionError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center justify-between">
                    <span>{actionError}</span>
                    <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-300 ml-2">✕</button>
                </div>
            )}

            {confirmRejectId && (
                <div className="p-4 bg-slate-800 border border-red-500/40 rounded-xl text-sm">
                    <p className="text-white font-medium mb-3">Are you sure you want to reject this request?</p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleReject(confirmRejectId)}
                            className="px-4 py-1.5 bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 hover:bg-red-500/30 transition-colors text-xs font-medium"
                        >Yes, Reject</button>
                        <button
                            onClick={() => setConfirmRejectId(null)}
                            className="px-4 py-1.5 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-xs font-medium"
                        >Cancel</button>
                    </div>
                </div>
            )}

            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-800/80 text-slate-400 text-xs uppercase font-medium">
                            <tr>
                                <th className="px-4 py-3">Client</th>
                                <th className="px-4 py-3">Email</th>
                                <th className="px-4 py-3">Requested</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {pendingRequests.map((request) => (
                                <tr key={request.id} className="hover:bg-slate-700/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-white">{request.name}</div>
                                        <div className="text-xs text-slate-400">{request.company}</div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-300">
                                        {request.email}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-400">
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5" />
                                            {new Date(request.requestedAt).toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleApprove(request.id)}
                                                className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors"
                                                title="Approve Reset"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setConfirmRejectId(request.id)}
                                                className="p-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 border border-red-500/30 transition-colors"
                                                title="Reject Request"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PasswordResetRequests;
