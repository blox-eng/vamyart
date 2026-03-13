interface Banner {
    text: string;
}

interface AnnouncementBannerProps {
    banner?: Banner | null;
}

export function AnnouncementBanner({ banner }: AnnouncementBannerProps) {
    if (!banner) return null;

    return (
        <div className="bg-black text-white text-center text-sm py-2 px-4">
            {banner.text}
        </div>
    );
}
