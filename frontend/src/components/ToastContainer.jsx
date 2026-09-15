// src/components/ToastContainer.jsx - Shared Global Toast Notifications
import React, { useState, useEffect, useCallback } from 'react';
import '../styles/main.css';

const getToastIcon = (type) => {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        case 'info':
        default: return 'fa-info-circle';
    }
};

const ToastContainer = () => {
    const [toasts, setToasts] = useState([]);

    const removeToast = useCallback((id) => {
        setToasts(prevToasts => prevToasts.filter(t => t.id !== id));
    }, []);

    useEffect(() => {
        const handleShowToast = (event) => {
            const { message, type } = event.detail;
            const id = Math.random().toString(36).substring(2, 9);
            
            setToasts(prev => [...prev, { id, message, type }]);

            // Auto-remove after 4 seconds
            setTimeout(() => {
                removeToast(id);
            }, 4000);
        };

        window.addEventListener('show-toast', handleShowToast);

        // Expose helper on window.Utils for backward compatibility and non-React files
        if (!window.Utils) window.Utils = {};
        window.Utils.showToast = (message, type = 'info') => {
            window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type } }));
        };

        return () => {
            window.removeEventListener('show-toast', handleShowToast);
        };
    }, [removeToast]);

    return (
        <div id="toast-container">
            {toasts.map(toast => (
                <div key={toast.id} className={`toast toast-${toast.type}`}>
                    <div className="toast-content">
                        <i className={`fas ${getToastIcon(toast.type)}`}></i>
                        <span>{toast.message}</span>
                    </div>
                    <button className="toast-close" onClick={() => removeToast(toast.id)}>&times;</button>
                </div>
            ))}
        </div>
    );
};

export default ToastContainer;

