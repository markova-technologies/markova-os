import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './Signup.css'; // Reusing signup styles
import { IoLockClosed, IoCheckmarkCircle } from 'react-icons/io5';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState('idle'); // idle, submitting, success, error

    const [isValidating, setIsValidating] = useState(true);

    useEffect(() => {
        const validateToken = async () => {
            if (!token) {
                setStatus('error');
                setMessage('Invalid or missing reset token.');
                setIsValidating(false);
                return;
            }

            // Optional: Verify token validity with backend immediately
            // For now, we'll just check existence to avoid extra round trip delay
            setIsValidating(false);
        };

        validateToken();
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setMessage('Passwords do not match');
            setStatus('error');
            return;
        }

        if (password.length < 6) {
            setMessage('Password must be at least 6 characters');
            setStatus('error');
            return;
        }

        setStatus('submitting');
        setMessage('');

        try {
            await axios.post(`${import.meta.env.VITE_SYSTEM_DASHBOARD_URL}/api/clients/reset-password`, {
                token,
                password
            });
            setStatus('success');
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err) {
            setStatus('error');
            setMessage(err.response?.data?.error || 'Failed to reset password. Token may be expired.');
        }
    };

    if (isValidating) {
        return (
            <div className="signup-container">
                <div className="signup-content text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-slate-300">Verifying link...</p>
                </div>
            </div>
        );
    }

    if (!token) {
        return (
            <div className="signup-container">
                <div className="signup-content text-center">
                    <h2 className="text-xl text-red-500 mb-4">Invalid Link</h2>
                    <p className="text-slate-300">This password reset link is invalid or has expired.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="signup-container">
            <div className="signup-content">
                <div className="signup-header">
                    <h1>Set New Password</h1>
                    <p>Enter your new secure password below</p>
                </div>

                <div className="signup-form-container">
                    {status === 'success' ? (
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto">
                                <IoCheckmarkCircle className="w-10 h-10" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Password Reset!</h3>
                            <p className="text-slate-300">Redirecting to login...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="signup-form">
                            <div className="input-group">
                                <div className="input-wrapper">
                                    <IoLockClosed className="input-icon" />
                                    <input
                                        type="password"
                                        placeholder="New Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        disabled={status === 'submitting'}
                                    />
                                </div>
                            </div>

                            <div className="input-group">
                                <div className="input-wrapper">
                                    <IoLockClosed className="input-icon" />
                                    <input
                                        type="password"
                                        placeholder="Confirm New Password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        disabled={status === 'submitting'}
                                    />
                                </div>
                            </div>

                            {status === 'error' && (
                                <div className="error-message">
                                    {message}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="signup-button"
                                disabled={status === 'submitting'}
                            >
                                {status === 'submitting' ? 'Reseting...' : 'Reset Password'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
