// apps/website/src/lib/ogRotation.ts
const OG_POOL = [
    '/images/whispers.jpg',
    '/images/first-contact.jpg',
    '/images/on-the-horizon.jpg',
] as const;

export function pickOgImage(urlPath: string): string {
    if (!urlPath) return OG_POOL[0];
    let h = 0;
    for (let i = 0; i < urlPath.length; i++) {
        h = ((h << 5) - h + urlPath.charCodeAt(i)) | 0;
    }
    return OG_POOL[Math.abs(h) % OG_POOL.length];
}
