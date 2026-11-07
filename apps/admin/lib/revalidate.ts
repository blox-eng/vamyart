const failureListeners = new Set<() => void>();

// The ToastProvider subscribes so a failed website refresh is never silent.
export function onRevalidateFailed(listener: () => void): () => void {
    failureListeners.add(listener);
    return () => {
        failureListeners.delete(listener);
    };
}

export async function revalidatePaths(paths: string[]): Promise<void> {
    try {
        // Same-origin call to the studio's own proxy route, which forwards to the
        // website server-to-server with the (server-only) revalidation secret.
        const res = await fetch("/api/revalidate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ paths }),
        });
        if (res.ok) return;
    } catch {
        // Network failure: reported below like a refused refresh.
    }
    // Non-critical for the save itself: ISR picks the change up within the hour.
    console.warn("Revalidation failed for paths:", paths);
    failureListeners.forEach((listener) => listener());
}
