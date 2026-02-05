
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Care Connect Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif', color: '#334155' }}>
          <h1 style={{ color: '#e11d48', fontSize: '1.5rem', marginBottom: '1rem' }}>Application Error</h1>
          <p>Care Connect encountered a problem during startup.</p>
          <pre style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '8px', overflow: 'auto', display: 'inline-block', textAlign: 'left', maxWidth: '100%', marginTop: '1rem', fontSize: '0.8rem' }}>
            {this.state.error?.message}
          </pre>
          <div style={{ marginTop: '2rem' }}>
            <button onClick={() => window.location.reload()} style={{ padding: '0.6rem 1.2rem', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              Reload Care Connect
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element with id 'root'");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
