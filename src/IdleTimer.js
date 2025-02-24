import { useState, useEffect, useRef } from 'react';

export const IdleTimer = ({ timeout, onIdle }) => {
    const [idle, setIdle] = useState(false);
    const timeoutRef = useRef();

    const resetTimeout = () => {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setIdle(true);
            onIdle();
        }, timeout);
    };

    const handleEvent = () => {
        setIdle(false);
        resetTimeout();
    };

    useEffect(() => {
        const events = ['mousemove', 'keydown', 'wheel', 'DOMMouseScroll', 'mouseWheel', 'mousedown', 'touchstart', 'touchmove', 'MSPointerDown', 'MSPointerMove'];

        events.forEach(event => {
            window.addEventListener(event, handleEvent);
        });

        resetTimeout();

        return () => {
            events.forEach(event => {
                window.removeEventListener(event, handleEvent);
            });
            clearTimeout(timeoutRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onIdle, timeout]);

    return (
        <div>
        </div>
    );
}