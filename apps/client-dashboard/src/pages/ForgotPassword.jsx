import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './Signup.css';
import { IoArrowBack, IoMail, IoCheckmarkCircle, IoCloseCircle, IoTimeOutline } from 'react-icons/io5';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState('idle'); // idle, submitting, pending, approved, rejected, error
    const [message, setMessage] = useState('');
    const pollRef = useRef(null);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    const startPolling = (submittedEmail) => {
        // Poll every 5 seconds
        pollRef.current = setInterval(async () => {
            try {
                const res = await axios.get(
                    `${import.meta.env.VITE_SYSTEM_DASHBOARD_URL}/api/clients/reset-request-status?email=${encodeURIComponent(submittedEmail)}`
                );
                const { status: reqStatus } = res.data;

                if (reqStatus === 'approved') {
                    clearInterval(pollRef.current);
                    setStatus('approved');
                } else if (reqStatus === 'rejected') {
                    clearInterval(pollRef.current);
                    setStatus('rejected');
                }
                // If still 'pending', keep polling
            } catch (e) {
                // Ignore polling errors silently
            }
        }, 5000);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('submitting');
        setMessage('');

        try {
            await axios.post(`${import.meta.env.VITE_SYSTEM_DASHBOARD_URL}/api/clients/request-password-reset`, { email });
            setStatus('pending');
            startPolling(email);
        } catch (err) {
            setStatus('error');
            setMessage(err.response?.data?.error || 'Failed to submit request. Please try again.');
        }
    };

    // ---- APPROVED STATE ----
    if (status === 'approved') {
        return (
            <div className="signup-container">
                <div className="signup-content">
                    <div className="signup-form-container text-center" style={{ padding: '2rem' }}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(232, 163, 61,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                            <IoCheckmarkCircle style={{ width: 36, height: 36, color: 'var(--live-amber)' }} />
                        </div>
                        <h3 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Request Approved!</h3>
                        <p style={{ color: 'var(--slate-wire)', marginBottom: '1.5rem' }}>
                            A password reset link has been sent to <strong style={{ color: 'var(--slate-wire)' }}>{email}</strong>. Check your inbox.
                        </p>
                        <Link to="/login" className="signup-button" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                            Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // ---- REJECTED STATE ----
    if (status === 'rejected') {
        return (
            <div className="signup-container">
                <div className="signup-content">
                    <div className="signup-form-container text-center" style={{ padding: '2rem' }}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(232, 92, 74,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                            <IoCloseCircle style={{ width: 36, height: 36, color: 'var(--coral-pulse)' }} />
                        </div>
                        <h3 style={{ color: 'var(--coral-pulse)', fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Not Approved by Admin</h3>
                        <p style={{ color: 'var(--slate-wire)', marginBottom: '1.5rem' }}>
                            Your password reset request was declined. Please contact support or try again later.
                        </p>
                        <Link to="/login" className="signup-button" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', background: 'linear-gradient(135deg, var(--coral-pulse), #B23A2C)' }}>
                            Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // ---- PENDING STATE ----
    if (status === 'pending') {
        return (
            <div className="signup-container">
                <div className="signup-content">
                    <div className="signup-form-container text-center" style={{ padding: '2rem' }}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(91, 100, 120,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                            <IoTimeOutline style={{ width: 36, height: 36, color: 'var(--live-amber)' }} />
                        </div>
                        <h3 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Waiting for Admin Approval</h3>
                        <p style={{ color: 'var(--slate-wire)', marginBottom: '0.5rem' }}>
                            Your request for <strong style={{ color: 'var(--slate-wire)' }}>{email}</strong> has been submitted.
                        </p>
                        <p style={{ color: 'var(--slate-wire)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                            This page will update automatically when the admin responds...
                        </p>
                        {/* Animated spinner dots */}
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '1.5rem' }}>
                            {[0, 1, 2].map(i => (
                                <div key={i} style={{
                                    width: 8, height: 8, borderRadius: '50%',
                                    background: 'var(--live-amber)',
                                    animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`
                                }} />
                            ))}
                        </div>
                        <Link to="/login" className="text-slate-400" style={{ fontSize: '0.85rem', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <IoArrowBack /> Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // ---- FORM STATE (idle / submitting / error) ----
    return (
        <div className="signup-container">
            <div className="signup-content">
                <div className="signup-header">
                    <h1>Reset Password</h1>
                    <p>Enter your email to request a password reset</p>
                </div>

                <div className="signup-form-container">
                    <form onSubmit={handleSubmit} className="signup-form">
                        <div className="input-group">
                            <div className="input-wrapper">
                                <IoMail className="input-icon" />
                                <input
                                    type="email"
                                    placeholder="Enter your registered email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
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
                            {status === 'submitting' ? 'Submitting...' : 'Request Reset'}
                        </button>

                        <div className="text-center mt-4">
                            <Link to="/login" className="text-slate-400 hover:text-white flex items-center justify-center gap-2 transition-colors">
                                <IoArrowBack /> Back to Login
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
