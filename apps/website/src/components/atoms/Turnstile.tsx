import * as React from 'react';

declare global {
    interface Window {
        turnstile?: {
            render: (el: HTMLElement, opts: Record<string, unknown>) => string;
            remove: (id: string) => void;
        };
    }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptLoad: Promise<void> | null = null;

function loadScript(): Promise<void> {
    if (window.turnstile) return Promise.resolve();
    scriptLoad ??= new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = SCRIPT_SRC;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => {
            scriptLoad = null;
            reject(new Error('turnstile script failed to load'));
        };
        document.head.appendChild(s);
    });
    return scriptLoad;
}

/**
 * Cloudflare's bot check. Invisible unless Cloudflare wants the visitor to click.
 * A token works once: remount (change `key`) after each submit to get a fresh one.
 */
export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
    const ref = React.useRef<HTMLDivElement>(null);
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    React.useEffect(() => {
        if (!siteKey) {
            console.error('[turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set; forms will be refused');
            return;
        }
        let widgetId: string | undefined;
        let cancelled = false;
        loadScript()
            .then(() => {
                if (cancelled || !ref.current || !window.turnstile) return;
                widgetId = window.turnstile.render(ref.current, {
                    sitekey: siteKey,
                    appearance: 'interaction-only',
                    callback: onToken,
                    'expired-callback': () => onToken(''),
                    'error-callback': () => onToken(''),
                });
            })
            .catch((err) => console.error('[turnstile]', err));
        return () => {
            cancelled = true;
            if (widgetId) window.turnstile?.remove(widgetId);
        };
    }, [siteKey, onToken]);

    return <div ref={ref} />;
}
