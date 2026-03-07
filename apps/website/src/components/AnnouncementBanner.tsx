import { useRouter } from 'next/router';
import { trpc } from '../lib/trpc';

export function AnnouncementBanner() {
    const router = useRouter();
    const slug = (router.query.slug as string[] | undefined)?.join('/') ?? router.pathname.replace(/^\//, '');
    const { data: banner } = trpc.banners.getActive.useQuery({ slug }, {
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    if (!banner) return null;

    return (
        <div className="bg-black text-white text-center text-sm py-2 px-4">
            {banner.text}
        </div>
    );
}
