import { useState } from 'react';
import { trpc } from '../../../lib/trpc';

export function BidModal({
    auctionId,
    currentBid,
    minBid,
    minIncrement,
    onClose,
    onSuccess,
}: {
    auctionId: string;
    currentBid: number | null;
    minBid: number;
    minIncrement: number;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const minAmount = currentBid !== null ? currentBid + minIncrement : minBid;
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [amount, setAmount] = useState(minAmount);
    const [error, setError] = useState('');

    const placeBid = trpc.bids.place.useMutation();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        try {
            await placeBid.mutateAsync({ auctionId, bidderName: name, bidderEmail: email, amount });
            onSuccess();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-8 max-w-md w-full">
                <h2 className="text-xl font-medium mb-6">Place a Bid</h2>
                <p className="text-sm text-gray-600 mb-6">Minimum bid: €{minAmount.toLocaleString()}</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input className="w-full border px-3 py-2 rounded text-sm" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} required />
                    <input className="w-full border px-3 py-2 rounded text-sm" type="email" placeholder="Your email" value={email} onChange={e => setEmail(e.target.value)} required />
                    <input className="w-full border px-3 py-2 rounded text-sm" type="number" min={minAmount} step="50" value={amount} onChange={e => setAmount(Number(e.target.value))} required />
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 border px-4 py-2 rounded text-sm">Cancel</button>
                        <button type="submit" disabled={placeBid.isPending} className="flex-1 bg-black text-white px-4 py-2 rounded text-sm disabled:opacity-50">
                            {placeBid.isPending ? 'Submitting…' : 'Submit bid'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
