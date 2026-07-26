import { useState, useEffect, type FormEvent } from 'react';
import { trpc } from '../../../lib/trpc';
import { isVariantSold } from '../../../utils/variant-sold';

export function ProductSelector({ artworkSlug }: { artworkSlug: string }) {
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [notifyForVariantId, setNotifyForVariantId] = useState<string | null>(null);
    const [notifyEmail, setNotifyEmail] = useState('');
    const [notifySubmitted, setNotifySubmitted] = useState<string | null>(null);

    useEffect(() => {
        function onPageShow(e: PageTransitionEvent) {
            if (e.persisted) {
                setIsRedirecting(false);
                setCheckoutError(null);
            }
        }
        window.addEventListener('pageshow', onPageShow);
        return () => window.removeEventListener('pageshow', onPageShow);
    }, []);

    const productsQuery = trpc.products.listByArtworkSlug.useQuery(
        { slug: artworkSlug },
        {
            retry: false,
            staleTime: 10_000,
            refetchOnWindowFocus: true,
            refetchOnMount: true,
        },
    );
    const { data: productList, isLoading: productsLoading, isError: productsError } = productsQuery;
    const createSession = trpc.checkout.createSession.useMutation();
    const waitlistSubscribe = trpc.waitlist.subscribe.useMutation();

    if (productsLoading) {
        return (
            <div className="border border-black p-6 mt-4 space-y-3 animate-pulse" aria-busy="true" aria-label="Loading available pieces">
                <div className="h-3 w-32 bg-gray-200" />
                <div className="h-12 bg-gray-100" />
                <div className="h-12 bg-gray-100" />
                <div className="h-12 bg-gray-100" />
                <div className="h-10 w-full bg-gray-200 mt-3" />
            </div>
        );
    }
    if (productsError) {
        return (
            <div role="alert" aria-live="polite" className="border border-black p-6 mt-4">
                <h3 className="text-xs uppercase tracking-widest mb-2">Available pieces</h3>
                <p className="text-sm text-gray-600 mb-3">We couldn&rsquo;t load availability right now.</p>
                <button
                    type="button"
                    onClick={() => productsQuery.refetch()}
                    className="text-sm underline underline-offset-2 hover:no-underline"
                >
                    Try again
                </button>
                <p className="text-xs text-gray-500 mt-3">
                    Or{' '}
                    <a href="/get-a-piece" className="underline hover:no-underline">send an inquiry</a>
                    {' '}and Maeve will follow up personally.
                </p>
            </div>
        );
    }
    if (!productList || productList.length === 0) return null;

    const variants = productList.flatMap(p =>
        p.variants.map(v => ({ ...v, productName: p.name }))
    );
    if (variants.length === 0) return null;

    // Every buyable variant is gone → show a graceful sold state instead of an empty picker.
    if (variants.every(isVariantSold)) {
        return (
            <div className="border border-black p-6 mt-4">
                <h3 className="text-xs uppercase tracking-widest mb-2">This piece has sold</h3>
                <p className="text-sm text-gray-600 mb-3">
                    This original has found its home. Maeve can create something in the same spirit for you.
                </p>
                <a href="/get-a-piece" className="text-sm underline underline-offset-2 hover:no-underline">
                    Inquire about a commission or a similar piece
                </a>
            </div>
        );
    }

    const selectedVariant = variants.find(v => v.id === selectedVariantId) ?? null;
    const priceLabel = selectedVariant ? `€${Number(selectedVariant.price).toLocaleString()}` : '';

    const shippingMethod = productList?.[0]?.shippingMethod;
    const shippingDisplay = shippingMethod?.displayText ?? null;
    const shippingClass = shippingMethod?.type === 'free' ? 'text-green-600' : 'text-gray-500';

    async function handleBuy() {
        if (!selectedVariantId) return;
        setIsRedirecting(true);
        setCheckoutError(null);
        try {
            const { url } = await createSession.mutateAsync({ variantId: selectedVariantId });
            window.location.href = url;
        } catch (err) {
            const code = (err as { data?: { code?: string } })?.data?.code;
            const message = err instanceof Error ? err.message : '';
            if (code === 'PRECONDITION_FAILED' && message === 'OUT_OF_STOCK') {
                await productsQuery.refetch();
                setNotifyForVariantId(selectedVariantId);
                setCheckoutError("This piece just sold. Leave your email below and we’ll notify you once, when it’s available again.");
            } else {
                setCheckoutError(message || 'Something went wrong. Please try again.');
            }
            setIsRedirecting(false);
        }
    }

    async function handleNotifySubmit(e: FormEvent) {
        e.preventDefault();
        if (!notifyForVariantId || !notifyEmail) return;
        try {
            await waitlistSubscribe.mutateAsync({ variantId: notifyForVariantId, email: notifyEmail });
            setNotifySubmitted(notifyForVariantId);
            setNotifyEmail('');
        } catch {
            // error surfaced via waitlistSubscribe.error below
        }
    }

    return (
        <div className="border border-black p-6 mt-4">
            <h3 className="text-xs uppercase tracking-widest mb-4">Available pieces</h3>
            <div className="space-y-2 mb-6">
                {variants.map(v => {
                    const sold = isVariantSold(v);
                    const isOut = !sold && (!v.available || v.stockQuantity <= 0);
                    const disabled = sold || isOut;
                    const showNotify = isOut && notifyForVariantId === v.id;
                    const submitted = notifySubmitted === v.id;
                    return (
                        <div key={v.id}>
                            <label
                                className={`flex items-center justify-between p-3 border transition-colors ${
                                    disabled
                                        ? 'border-neutral opacity-70 cursor-default'
                                        : selectedVariantId === v.id
                                            ? 'border-black bg-gray-50 cursor-pointer'
                                            : 'border-neutral hover:border-dark cursor-pointer'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <input
                                        type="radio"
                                        name="variant"
                                        value={v.id}
                                        disabled={disabled}
                                        checked={selectedVariantId === v.id}
                                        onChange={() => { setSelectedVariantId(v.id); setCheckoutError(null); }}
                                        className="sr-only"
                                    />
                                    <div>
                                        <p className="text-sm font-medium">{v.name}</p>
                                    </div>
                                </div>
                                <div className="text-right flex items-center gap-3">
                                    {sold ? (
                                        <div>
                                            <p className="text-sm text-gray-500">Sold</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="text-sm">€{Number(v.price).toLocaleString()}</p>
                                            <p className={`text-xs ${v.stockQuantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                {v.stockQuantity > 0 ? 'In stock' : 'Out of stock'}
                                            </p>
                                        </div>
                                    )}
                                    {isOut && !showNotify && !submitted && (
                                        <button
                                            type="button"
                                            onClick={() => { setNotifyForVariantId(v.id); setNotifySubmitted(null); }}
                                            className="text-xs underline hover:no-underline"
                                        >
                                            Notify me
                                        </button>
                                    )}
                                </div>
                            </label>
                            {showNotify && !submitted && (
                                <form onSubmit={handleNotifySubmit} className="flex flex-col gap-1 mt-2">
                                    <div className="flex gap-2 items-start">
                                        <input
                                            type="email"
                                            required
                                            placeholder="you@example.com"
                                            value={notifyEmail}
                                            onChange={(e) => setNotifyEmail(e.target.value)}
                                            className="flex-1 border border-neutral px-3 py-2 text-sm"
                                            aria-label={`Email to be notified when ${v.name} is available`}
                                        />
                                        <button
                                            type="submit"
                                            disabled={waitlistSubscribe.isPending}
                                            className="bg-black text-white px-4 py-2 text-xs tracking-wide disabled:opacity-60"
                                        >
                                            {waitlistSubscribe.isPending ? 'Sending…' : 'Notify me'}
                                        </button>
                                    </div>
                                    {waitlistSubscribe.isError && (
                                        <p className="text-xs text-red-500">Something went wrong — please try again.</p>
                                    )}
                                </form>
                            )}
                            {submitted && (
                                <p className="text-xs text-green-700 mt-2">
                                    ✓ We&rsquo;ll email you once, the next time this piece is available.
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
            {shippingDisplay && (
                <p className={`text-xs mb-3 ${shippingClass}`}>
                    {shippingDisplay}
                </p>
            )}
            {checkoutError && (
                <p className="text-sm text-red-600 mb-3">{checkoutError}</p>
            )}
            <label className="flex items-start gap-3 cursor-pointer mt-4 mb-3">
                <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 shrink-0 focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2"
                />
                <span className="text-xs text-gray-600">
                    I have read and accept the{' '}
                    <a href="/terms" target="_blank" rel="noreferrer" className="underline hover:no-underline">Terms</a>
                    {' '}and{' '}
                    <a href="/privacy" target="_blank" rel="noreferrer" className="underline hover:no-underline">Privacy Policy</a>.
                </span>
            </label>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                Prices include VAT where applicable. You have a 14-day right of withdrawal after delivery —{' '}
                <a href="/terms#withdrawal" className="underline hover:no-underline" target="_blank" rel="noreferrer">
                    details
                </a>.
            </p>
            <button
                onClick={handleBuy}
                disabled={!selectedVariantId || !termsAccepted || isRedirecting}
                className="w-full bg-black text-white py-3 text-sm tracking-wide hover:bg-gray-800 transition-colors disabled:opacity-60"
            >
                {isRedirecting
                    ? 'Redirecting to payment…'
                    : !selectedVariantId
                        ? 'Select a piece to buy'
                        : !termsAccepted
                            ? 'Accept terms to continue'
                            : `Buy — pay ${priceLabel}`}
            </button>
            <p className="text-xs text-gray-500 mt-3 text-center">
                Secure checkout via Stripe. Card, Apple Pay, Google Pay.
            </p>
        </div>
    );
}
