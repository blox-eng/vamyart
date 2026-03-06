import { useState } from 'react';
import { trpc } from '../../../lib/trpc';

export function ProductSelector({ artworkSlug }: { artworkSlug: string }) {
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);

    const { data: productList } = trpc.products.listByArtworkSlug.useQuery({ slug: artworkSlug });
    const createSession = trpc.checkout.createSession.useMutation();

    if (!productList || productList.length === 0) return null;

    // Flatten all variants across products
    const variants = productList.flatMap(p =>
        p.variants.map(v => ({ ...v, productName: p.name }))
    );

    if (variants.length === 0) return null;

    async function handleBuy() {
        if (!selectedVariantId) return;
        setIsRedirecting(true);
        setCheckoutError(null);
        try {
            const { url } = await createSession.mutateAsync({ variantId: selectedVariantId });
            window.location.href = url;
        } catch (err) {
            setCheckoutError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
            setIsRedirecting(false);
        }
    }

    return (
        <div className="border border-black rounded-lg p-6 mt-4">
            <h3 className="text-xs uppercase tracking-widest mb-4">Available Prints</h3>
            <div className="space-y-2 mb-6">
                {variants.map(v => (
                    <label
                        key={v.id}
                        className={`flex items-center justify-between p-3 border rounded cursor-pointer transition-colors ${selectedVariantId === v.id ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-400'}`}
                    >
                        <div className="flex items-center gap-3">
                            <input
                                type="radio"
                                name="variant"
                                value={v.id}
                                checked={selectedVariantId === v.id}
                                onChange={() => setSelectedVariantId(v.id)}
                                className="sr-only"
                            />
                            <div>
                                <p className="text-sm font-medium">{v.name}</p>
                                <p className="text-xs text-gray-500">{v.productName}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm">€{Number(v.price).toLocaleString()}</p>
                            <p className={`text-xs ${v.stockQuantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {v.stockQuantity > 0 ? 'In stock' : 'Out of stock'}
                            </p>
                        </div>
                    </label>
                ))}
            </div>
            {checkoutError && (
                <p className="text-sm text-red-600 mb-3">{checkoutError}</p>
            )}
            <button
                onClick={handleBuy}
                disabled={!selectedVariantId || isRedirecting}
                className="w-full bg-black text-white py-3 rounded text-sm tracking-wide hover:bg-gray-800 transition-colors disabled:opacity-40"
            >
                {isRedirecting ? 'Redirecting to payment…' : 'Buy'}
            </button>
        </div>
    );
}
