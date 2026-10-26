import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Search parameters update filters in place; only page navigation resets scroll.
export default function RouteScroll() {
    const { pathname, hash } = useLocation();
    useEffect(() => {
        if (!hash) {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            return;
        }
        let id;
        try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
        const scrollToAnchor = () => {
            const target = document.getElementById(id);
            if (!target) return false;
            target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
            return true;
        };
        if (scrollToAnchor()) return;
        // Lazy routes can mount after the location changes.
        const observer = new MutationObserver(() => {
            if (scrollToAnchor()) observer.disconnect();
        });
        observer.observe(document.getElementById('root'), { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [pathname, hash]);
    return null;
}
