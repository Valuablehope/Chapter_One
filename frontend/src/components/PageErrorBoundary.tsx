import { Component, ErrorInfo, ReactNode } from 'react';
import { ExclamationTriangleIcon, ArrowPathIcon, HomeIcon } from '@heroicons/react/24/outline';
import Button from './ui/Button';
import Card from './ui/Card';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Page-level error boundary that catches errors in page components
 * without crashing the entire application
 */
export default class PageErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Page Error Boundary caught an error:', error, errorInfo);
    
    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you might want to log to an error reporting service
    // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full">
            <div className="text-center p-8">
              <div className="mb-6 flex justify-center">
                <div className="p-4 bg-red-100 rounded-full">
                  <ExclamationTriangleIcon className="w-12 h-12 text-red-600" />
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Something went wrong
              </h2>
              
              <p className="text-gray-600 mb-2">
                {this.state.error?.message || 'An unexpected error occurred on this page'}
              </p>
              
              <p className="text-sm text-gray-500 mb-8">
                Don't worry, your data is safe. Try refreshing the page or navigating away.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={this.handleReset}
                  variant="primary"
                  leftIcon={<ArrowPathIcon className="w-5 h-5" />}
                >
                  Try Again
                </Button>
                
                <Button
                  onClick={this.handleReload}
                  variant="secondary"
                >
                  Reload Page
                </Button>
                
                <Button
                  onClick={this.handleGoHome}
                  variant="secondary"
                  leftIcon={<HomeIcon className="w-5 h-5" />}
                >
                  Go to Dashboard
                </Button>
              </div>

              {this.state.error && import.meta.env.DEV && (
                <details className="mt-8 text-left">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-3 hover:text-gray-900">
                    Error Details (Development Only)
                  </summary>
                  <div className="bg-gray-50 rounded-lg p-4 overflow-auto max-h-64">
                    <pre className="text-xs text-gray-800 whitespace-pre-wrap">
                      {this.state.error.stack}
                    </pre>
                  </div>
                </details>
              )}
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

