import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });
    // Log error to console for debugging
    console.error("Error caught by boundary:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Optionally reload the page or navigate
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background-light dark:bg-background-dark p-4">
          <div className="max-w-md w-full bg-background-light dark:bg-card-dark border border-[#283539] rounded-2xl p-8 text-center">
            <div className="size-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-red-400 text-3xl">
                error
              </span>
            </div>
            <h1 className="text-xl font-bold text-text-primary dark:text-slate-100 mb-2">
              Something went wrong
            </h1>
            <p className="text-text-secondary text-sm mb-6">
              An unexpected error occurred. Please try again or go back to home.
            </p>
            {this.props.showDetails && this.state.error && (
              <div className="mb-6 p-3 bg-[#1c2e35] rounded-lg text-left overflow-auto max-h-32">
                <p className="text-red-400 text-xs font-mono">
                  {this.state.error.toString()}
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-[#283539] text-text-primary dark:text-slate-100 rounded-lg hover:bg-[#3b4e54] transition-colors text-sm font-medium"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-primary text-background-dark rounded-lg hover:bg-primary/90 transition-colors text-sm font-bold"
              >
                Go to Home
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
