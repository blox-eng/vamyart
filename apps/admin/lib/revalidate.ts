export async function revalidatePaths(paths: string[]): Promise<void> {
    try {
        // Same-origin call to the studio's own proxy route, which forwards to the
        // website server-to-server with the (server-only) revalidation secret.
        await fetch("/api/revalidate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ paths }),
        });
    } catch {
        // Non-critical — ISR fallback catches it within 1 hour
        console.warn("Revalidation failed for paths:", paths);
    }
}
