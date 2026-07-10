/**
 * DYD-Clothes Utilities
 * Helper functions for formatting, notifications, and DOM manipulation.
 */

const Utils = {
    /**
     * Format number as Indian Rupee (INR)
     * @param {number} amount 
     * @returns {string}
     */
    formatINR: (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount || 0);
    },

    /**
     * Escape HTML special characters to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} - Escaped HTML string
     */
    escapeHtml: (text) => {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Set HTML content of an element by ID
     * @param {string} id - Element ID
     * @param {string} content - HTML content
     */
    setHTML: (id, content) => {
        const element = document.getElementById(id);
        if (element) element.innerHTML = content;
    },

    /**
     * Get element by ID with error handling
     * @param {string} id 
     * @returns {HTMLElement|null}
     */
    getElement: (id) => {
        const element = document.getElementById(id);
        if (!element) console.warn(`Element not found: ${id}`);
        return element;
    },

    /**
     * Show a toast notification
     * @param {string} message 
     * @param {string} type - 'success' | 'error' | 'warning' | 'info'
     */
    showToast: (message, type = 'info') => {
        const toastContainer = document.getElementById('toast-container') || Utils.createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas ${Utils.getToastIcon(type)}"></i>
                <span>${Utils.escapeHtml(message)}</span>
            </div>
            <button class="toast-close">&times;</button>
        `;

        toastContainer.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto remove (reduced duration for faster UI)
        const timeout = setTimeout(() => Utils.removeToast(toast), 1500);

        // Manual close
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.onclick = () => {
                clearTimeout(timeout);
                Utils.removeToast(toast);
            };
        }
    },

    createToastContainer: () => {
        const container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
        return container;
    },

    removeToast: (toast) => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    },

    getToastIcon: (type) => {
        switch (type) {
            case 'success': return 'fa-check-circle';
            case 'error': return 'fa-exclamation-circle';
            case 'warning': return 'fa-exclamation-triangle';
            default: return 'fa-info-circle';
        }
    },

    /**
     * Get URL parameters
     * @returns {Object}
     */
    getQueryParams: () => {
        const params = {};
        new URLSearchParams(window.location.search).forEach((value, key) => {
            params[key] = value;
        });
        return params;
    },

    /**
     * Debounce function
     */
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Format date to readable string
     */
    formatDate: (date) => {
        return new Date(date).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    /**
     * Truncate text with ellipsis
     */
    truncate: (text, maxLength = 50) => {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
};

// Export to window
window.Utils = Utils;