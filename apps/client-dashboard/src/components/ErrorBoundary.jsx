import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import './ErrorBoundary.css';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Uncaught error:', error, errorInfo);
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
                        <button onClick={() => window.location.reload()}>
                            <RefreshCcw size={16} /> Reload page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
