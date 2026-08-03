import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { IoMail, IoLockClosed, IoAlertCircle, IoArrowForward } from 'react-icons/io5';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Check role
      const user = data.user;
      if (user.role !== 'admin' && user.role !== 'superadmin') {
        throw new Error('Access Denied: Admin privileges required.');
      }

      // Store credentials and callback
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_user', JSON.stringify(user));
      onLogin(user);
    } catch (err) {
      setError(err.message || 'An error occurred during sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden font-sans">
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/10 blur-[120px]" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 rounded-2xl shadow-2xl relative z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold mb-4">
            M
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Markova Admin</h2>
          <p className="text-sm text-slate-400 mt-2">Enter credentials to access the console</p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-sm"
          >
            <IoAlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Address</label>
            <div className="flex items-center bg-slate-950/50 border border-slate-850 focus-within:border-blue-500/50 rounded-xl px-4 py-3 text-sm text-white transition-all">
              <IoMail className="text-slate-500 w-5 h-5 mr-3" />
              <input 
                type="email" 
                placeholder="admin@markova.et"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="bg-transparent outline-none flex-1 placeholder:text-slate-650"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
            <div className="flex items-center bg-slate-950/50 border border-slate-850 focus-within:border-blue-500/50 rounded-xl px-4 py-3 text-sm text-white transition-all">
              <IoLockClosed className="text-slate-500 w-5 h-5 mr-3" />
              <input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="bg-transparent outline-none flex-1 placeholder:text-slate-655"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 mt-8"
          >
            {loading ? 'Verifying Access...' : 'Sign In'}
            {!loading && <IoArrowForward />}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
