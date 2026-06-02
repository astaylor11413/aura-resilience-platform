import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("AURA_SYSTEM_CRITICAL_FAILURE:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-rose-500 p-6 text-center font-mono">
          <h2 className="text-2xl font-bold mb-2">SYSTEM CRITICAL ERROR</h2>
          <p className="text-sm text-slate-400">Command interface has encountered an unrecoverable state.</p>
          <button 
            className="mt-4 px-4 py-2 bg-rose-600 text-white text-xs tracking-wider rounded hover:bg-rose-500 transition-colors uppercase font-bold"
            onClick={() => {
              Object.keys(localStorage).forEach(key => {
                if (key.startsWith('aura_')) localStorage.removeItem(key);
              });
              window.location.reload();
            }}
          >
            REINITIALIZE_SYSTEM
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}