import React from 'react';

export default class ErrorBoundary extends React.Component {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch(error) { console.error('Page failed to render:', error); }
    render() {
        if (this.state.failed) return <div className="container" role="alert" style={{ padding: '80px 24px', textAlign: 'center' }}>
            <h1>This page could not load</h1><p>Your saved account and cart are still available. Reload to try again.</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload page</button>
            <a className="btn btn-outline" href="/">Go home</a>
        </div>;
        return this.props.children;
    }
}
