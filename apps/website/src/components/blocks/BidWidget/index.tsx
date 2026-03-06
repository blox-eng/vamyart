import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { trpc } from '../../../lib/trpc';
import { Countdown } from './Countdown';
import { BidModal } from './BidModal';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function BidWidget({ artworkSlug }: { artworkSlug: string }) {
    const [showModal, setShowModal] = useState(false);
    const [bidSuccess, setBidSuccess] = useState(false);

    const { data: auction, refetch } = trpc.auctions.getByArtworkSlug.useQuery(
        { slug: artworkSlug },
        { refetchInterval: 30_000 } // 30s polling fallback
    );

    // Supabase Realtime — live bid updates
    useEffect(() => {
        if (!auction?.id) return;
        const channel = supabase
            .channel(`auction-${auction.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'bids', filter: `auction_id=eq.${auction.id}` },
                () => refetch()
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [auction?.id, refetch]);

    if (!auction || auction.status !== 'active') return null;

    const deadline = new Date(auction.deadline);
    const isEnded = deadline < new Date();
    const currentBid = auction.currentBid ? Number(auction.currentBid) : null;

    return (
        <div className="border border-black rounded-lg p-6 mt-8">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">
                        {currentBid ? 'Current bid' : 'Starting bid'}
                    </p>
                    <p className="text-3xl font-light">
                        €{(currentBid ?? Number(auction.minBid)).toLocaleString()}
                    </p>
                    {auction.bidCount > 0 && (
                        <p className="text-xs text-gray-500 mt-1">{auction.bidCount} bid{auction.bidCount !== 1 ? 's' : ''}</p>
                    )}
                </div>
                <div className="text-right">
                    <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">
                        {isEnded ? 'Ended' : 'Ends in'}
                    </p>
                    <p className="text-lg font-light">
                        {isEnded ? '—' : <Countdown deadline={deadline} />}
                    </p>
                </div>
            </div>
            {!isEnded && !bidSuccess && (
                <button
                    onClick={() => setShowModal(true)}
                    className="w-full bg-black text-white py-3 rounded text-sm tracking-wide hover:bg-gray-800 transition-colors"
                >
                    Place a Bid
                </button>
            )}
            {bidSuccess && (
                <p className="text-center text-sm text-green-700 py-2">Your bid has been placed. Watch your inbox.</p>
            )}
            {showModal && (
                <BidModal
                    auctionId={auction.id}
                    currentBid={currentBid}
                    minBid={Number(auction.minBid)}
                    minIncrement={Number(auction.minIncrement)}
                    onClose={() => setShowModal(false)}
                    onSuccess={() => { setShowModal(false); setBidSuccess(true); refetch(); }}
                />
            )}
        </div>
    );
}
