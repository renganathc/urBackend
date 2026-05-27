import { useState, useEffect } from 'react';

function BackToTop() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 300) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        window.addEventListener('scroll', handleScroll);

        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    const handleClick = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    if (!isVisible) {
        return null;
    }

    return (
        <button
            onClick={handleClick}
            title="Back to Top"
            aria-label="Back to Top"
            style={{
                position: 'fixed',
                bottom: '2rem',
                right: '2rem',
                zIndex: 1000,
                backgroundColor: '#00f5d4',
                color: '#000',
                border: 'none',
                borderRadius: '50%',
                width: '45px',
                height: '45px',
                fontSize: '1.2rem',
                cursor: 'pointer',
                boxShadow: '0 0 15px rgba(0, 245, 212, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            ↑
        </button>
    );
}

export default BackToTop;