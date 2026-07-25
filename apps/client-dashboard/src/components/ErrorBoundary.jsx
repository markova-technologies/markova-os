import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
                    <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-red-200 dark:border-red-900 overflow-hidden">
                        <div className="p-6 md:p-8">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center mb-6">
                                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-500" />
                            </div>
                            
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Something went wrong</h1>
                            <p className="text-gray-600 dark:text-gray-400 mb-8">
                                The application encountered an unexpected error and could not load this section.
                            </p>

                            <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-500/20 rounded-xl p-5 mb-8 overflow-hidden">
                                <h3 className="text-sm font-semibold text-red-800 dark:text-red-400 mb-3 uppercase tracking-wider">Error Details</h3>
                                <pre className="text-sm text-red-900 dark:text-red-300 font-mono whitespace-pre-wrap mb-4 break-words">
                                    {this.state.error && this.state.error.toString()}
                                </pre>
                                <details className="group cursor-pointer">
                                    <summary className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium outline-none">
                                        View Stack Trace
                                    </summary>
                                    <pre className="mt-4 p-4 bg-white/50 dark:bg-black/20 rounded-lg text-xs text-red-800 dark:text-red-200 font-mono overflow-auto max-h-64 opacity-80">
                                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                                    </pre>
                                </details>
                            </div>

                            <button
                                onClick={() => window.location.reload()}
                                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-900 w-full md:w-auto"
                            >
                                <RefreshCcw className="w-5 h-5 mr-2" />
                                Reload Page
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
