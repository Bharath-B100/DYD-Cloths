import React from 'react';
import '../styles/main.css';
import '../styles/product.css';

export default function ConfirmDialog({ title = 'Please confirm', message, onCancel, onConfirm, confirmLabel = 'Confirm' }) {
    return (
        <div className="modal active" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
            <div className="modal-content">
                <h3 id="confirm-dialog-title">{title}</h3>
                <p style={{ margin: '16px 0 24px' }}>{message}</p>
                <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
                    <button type="button" className="btn btn-primary" onClick={onConfirm}>{confirmLabel}</button>
                </div>
            </div>
        </div>
    );
}

