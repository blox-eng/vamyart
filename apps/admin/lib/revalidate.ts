const WEBSITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL ?? "http://localhost:3000";
const SECRET = process.env.REVALIDATION_SECRET ?? "";

export async function revalidatePaths(paths: string[]): Promise<void> {
    try {
        await fetch(
            `${WEBSITE_URL}/api/revalidate?paths=${encodeURIComponent(paths.join(","))}`,
            {
                method: "POST",
                headers: { "x-revalidate-secret": SECRET },
            }
        );
    } catch {
        // Non-critical — ISR fallback catches it within 1 hour
        console.warn("Revalidation failed for paths:", paths);
    }
}
