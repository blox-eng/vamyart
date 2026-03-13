import { useState, useEffect } from 'react';

export function Countdown({ deadline }: { deadline: Date }) {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        function update() {
            const diff = deadline.getTime() - Date.now();
            if (diff <= 0) { setTimeLeft('Ended'); return; }
            const d = Math.floor(diff / 86400000);
            const h = Math.floor((diff % 86400000) / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setTimeLeft(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`);
        }
        update();
        const id = setInterval(update, 1000);
        return () => clearInterval(id);
    }, [deadline]);

    return <span>{timeLeft}</span>;
}
