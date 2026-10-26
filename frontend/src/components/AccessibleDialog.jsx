import React, { useEffect, useRef } from 'react';

const openDialogs = [];
let originalOverflow;
export default function AccessibleDialog({ children, onClose, ...props }) {
    const ref = useRef(null);
    const close = useRef(onClose);
    close.current = onClose;
    useEffect(() => {
        const node = ref.current;
        const opener = document.activeElement;
        if (!openDialogs.length) { originalOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
        openDialogs.push(node);
        const focusable = () => [...node.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')].filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
        const focusFirst = () => (focusable()[0] || node).focus();
        focusFirst();
        const keydown = event => {
            if (openDialogs.at(-1) !== node) return;
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current?.(); }
            if (event.key === 'Tab') {
                const items = focusable();
                const index = items.indexOf(document.activeElement);
                if (!items.length) { event.preventDefault(); node.focus(); }
                else if (event.shiftKey && index <= 0) { event.preventDefault(); items.at(-1).focus(); }
                else if (!event.shiftKey && (index === items.length - 1 || index < 0)) { event.preventDefault(); items[0].focus(); }
            }
        };
        const focusin = event => { if (openDialogs.at(-1) === node && !node.contains(event.target)) focusFirst(); };
        document.addEventListener('keydown', keydown, true);
        document.addEventListener('focusin', focusin);
        return () => {
            document.removeEventListener('keydown', keydown, true);
            document.removeEventListener('focusin', focusin);
            openDialogs.splice(openDialogs.indexOf(node), 1);
            if (!openDialogs.length) document.body.style.overflow = originalOverflow;
            if (opener?.isConnected) opener.focus();
        };
    }, []);
    return <div {...props} ref={ref} role="dialog" aria-modal="true" tabIndex={-1}>{children}</div>;
}
