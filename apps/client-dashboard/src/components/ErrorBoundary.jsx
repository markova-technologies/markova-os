import React from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import './ErrorBoundary.css';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Uncaught ErrorBoundary error:', error, errorInfo);
    }

    componentDidUpdate(prevProps) {
        if (this.state.hasError && this.props.resetKey !== prevProps.resetKey) {
            this.setState({ hasError: false, error: null });
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="error-boundary">
                    <div className="error-boundary-card">
                        <div className="error-boundary-icon">
                            <AlertTriangle size={28} />
                        </div>
                        <h1>This page hit a snag</h1>
                        <p>Something didn't load right. Reloading usually fixes it — your data is safe.</p>
                        {this.state.error?.message && (
                            <div style={{
                                fontSize: '0.8rem',
                                color: 'rgba(255, 100, 100, 0.85)',
                                background: 'rgba(255, 0, 0, 0.08)',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '6px',
                                fontFamily: 'monospace',
                                maxWidth: '100%',
                                wordBreak: 'break-word',
                                margin: '0.5rem 0 1rem'
                            }}>
                                {this.state.error.message}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button onClick={() => window.location.reload()}>
                                <RefreshCcw size={16} /> Reload page
                            </button>
                            <button 
                                onClick={() => {
                                    this.setState({ hasError: false, error: null });
                                    window.location.href = '/app';
                                }}
                                style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.15)' }}
                            >
                                <Home size={16} /> Command Center
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

