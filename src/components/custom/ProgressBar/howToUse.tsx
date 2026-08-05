import { useState } from 'react';

import { ProgressBar } from '@/components/custom/ProgressBar/ProgressBar';
import Toast from '@/components/custom/Toast/Toast';


export function TestProgressComponent() {
    const [progress, setProgress] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const total = 100;

    const startTest = async () => {
        setIsVisible(true);
        setProgress(0);

        for (let i = 1; i <= 10; i++) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            setProgress(i * 10);
        }

        setTimeout(() => setIsVisible(false), 1000);
    };

    return (
        <>
            <button
                onClick={startTest}
                style={{
                    position: 'fixed', top: 40, right: 16, zIndex: 9998,
                    padding: '6px 14px', background: '#7c6afb', color: '#fff',
                    border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                    fontWeight: 600, opacity: 0.85
                }}
            >
                🧪 Test Progress Toast
            </button>

            {isVisible && (
                <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999 }}>
                    <Toast
                        type="info"
                        onClose={() => setIsVisible(false)}
                        duration={999999} // Prevents auto-close during long progress
                        message={
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '220px', paddingTop: '2px' }}>
                                <div style={{ fontWeight: 500 }}>Processing data...</div>
                                <ProgressBar current={progress} total={total} />
                            </div>
                        }
                    />
                </div>
            )}
        </>
    );
}
