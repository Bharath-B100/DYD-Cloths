// src/components/SplashScreen.jsx
import React, { useEffect, useState } from 'react';

/**
 * Full-screen splash that shows the DYD logo blinking on initial load.
 * On mount it hides the pre-React HTML splash (#pre-splash) for a seamless handoff.
 * Fades out after `duration` ms, then calls `onDone` to unmount itself.
 */
export default function SplashScreen({ duration = 2200, onDone }) {
    const [hiding, setHiding] = useState(false);

    // Seamlessly hide the pre-React HTML splash as soon as this component mounts
    useEffect(() => {
        const preSplash = document.getElementById('pre-splash');
        if (preSplash) {
            preSplash.style.display = 'none';
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setHiding(true);
        }, duration);
        return () => clearTimeout(timer);
    }, [duration]);

    const handleTransitionEnd = () => {
        if (hiding) onDone?.();
    };

    return (
        <div
            className={`splash-screen${hiding ? ' splash-screen--hide' : ''}`}
            onTransitionEnd={handleTransitionEnd}
            aria-hidden="true"
        >
            <div className="splash-logo-wrap">
                <img
                    src="/images/LOGO_DYD.png"
                    alt="DYD Clothes"
                    className="splash-logo"
                />
            </div>
        </div>
    );
}
