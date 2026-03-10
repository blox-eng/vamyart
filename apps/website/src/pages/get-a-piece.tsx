import * as React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Header from '../components/sections/Header';
import Footer from '../components/sections/Footer';
import { trpc } from '../lib/trpc';

const STEPS = [
    { n: '01', label: 'Send your inquiry', text: 'Fill in the form — takes under a minute.' },
    { n: '02', label: 'Maeve gets back to you', text: 'Personally, within 2 working days.' },
    { n: '03', label: 'Discuss the details', text: 'Shipping, insurance, payment — all sorted together.' },
    { n: '04', label: 'Secure payment', text: 'Via Stripe link — card, Apple Pay, Google Pay.' },
];

export default function GetAPiece({ site }: { site: any }) {
    const router = useRouter();
    const pieceSlug = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('piece') ?? ''
        : (router.query.piece as string) ?? '';

    const { data: product } = trpc.products.getByArtworkSlug.useQuery(
        { slug: pieceSlug },
        { enabled: !!pieceSlug, staleTime: 60_000 }
    );

    const artwork = product?.artwork ?? null;
    const variant = product?.variants?.[0] ?? null;
    const attrs = (variant?.attributes ?? {}) as Record<string, string>;
    const medium = artwork?.medium || attrs.medium || '';
    const dimensions = artwork?.dimensions || attrs.dimensions || '';
    const price = variant?.price ? `€${Number(variant.price).toLocaleString()}` : null;

    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [piece, setPiece] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [terms, setTerms] = React.useState(false);
    const [status, setStatus] = React.useState<'idle' | 'success' | 'error'>('idle');

    // Pre-fill piece field with artwork title when data arrives
    React.useEffect(() => {
        if (artwork?.title && !piece) setPiece(artwork.title);
    }, [artwork?.title]);

    const createInquiry = trpc.inquiries.create.useMutation();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setStatus('idle');
        try {
            await createInquiry.mutateAsync({ name, email, pieceInterest: piece, message: message || undefined });
            setStatus('success');
        } catch {
            setStatus('error');
        }
    }

    return (
        <>
            <Head>
                <title>Inquire about a piece — vamy</title>
                <meta name="description" content="Interested in owning an original? Get in touch and Maeve will get back to you personally." />
            </Head>

            <div className="sb-page">
                <div className="sb-base sb-default-base-layout">
                    {site?.header && <Header {...site.header} />}

                    <main className="min-h-screen bg-white">
                        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24 lg:grid lg:grid-cols-5 lg:gap-16">

                            {/* ── Left panel: context ───────────────────────── */}
                            <aside className="lg:col-span-2 mb-12 lg:mb-0">
                                {artwork ? (
                                    <div className="mb-10">
                                        <img
                                            src={`/images/${artwork.slug}.jpg`}
                                            alt={artwork.title}
                                            className="w-full aspect-[3/4] object-cover rounded-sm mb-6 shadow-sm"
                                        />
                                        <h2 className="text-xl font-light mb-1">{artwork.title}</h2>
                                        {medium && <p className="text-sm text-gray-500">{medium}</p>}
                                        {dimensions && <p className="text-sm text-gray-500">{dimensions}</p>}
                                        <p className="text-sm text-gray-400 mt-1">
                                            {price ? `Original — ${price}` : 'Original — price on request'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="mb-10">
                                        <p className="text-xs uppercase tracking-widest text-gray-400 mb-3">Original paintings</p>
                                        <h2 className="text-2xl font-light mb-4 leading-snug">
                                            Interested in owning a piece?
                                        </h2>
                                        <p className="text-gray-500 text-sm leading-relaxed">
                                            Each original is one of a kind. Fill in the form and Maeve will get back to you personally.
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-6">
                                    <p className="text-xs uppercase tracking-widest text-gray-400">What happens next</p>
                                    {STEPS.map((s) => (
                                        <div key={s.n} className="flex gap-4">
                                            <span className="text-xs text-gray-300 font-light pt-0.5 shrink-0 w-6">{s.n}</span>
                                            <div>
                                                <p className="text-sm font-medium mb-0.5">{s.label}</p>
                                                <p className="text-sm text-gray-500">{s.text}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </aside>

                            {/* ── Right panel: form ─────────────────────────── */}
                            <div className="lg:col-span-3">
                                {status === 'success' ? (
                                    <div className="h-full flex flex-col justify-center py-16 text-center">
                                        <p className="text-4xl mb-6">✓</p>
                                        <h2 className="text-2xl font-light mb-3">Inquiry sent</h2>
                                        <p className="text-gray-500 mb-2">
                                            Thank you, {name}. Maeve will be in touch soon.
                                        </p>
                                        <p className="text-gray-400 text-sm">Check your inbox — including spam just in case.</p>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
                                        <div>
                                            <h1 className="text-2xl font-light mb-1">Get a piece</h1>
                                            <p className="text-gray-500 text-sm">
                                                {artwork
                                                    ? `You're inquiring about "${artwork.title}". Tell Maeve a bit about yourself.`
                                                    : 'Tell Maeve which piece you\'re interested in and a bit about yourself.'}
                                            </p>
                                        </div>

                                        {/* About you */}
                                        <fieldset className="space-y-4">
                                            <legend className="text-xs uppercase tracking-widest text-gray-400 mb-3 block">About you</legend>
                                            <div>
                                                <label className="block text-sm font-medium mb-1.5" htmlFor="inq-name">Your name</label>
                                                <input
                                                    id="inq-name"
                                                    type="text"
                                                    value={name}
                                                    onChange={e => setName(e.target.value)}
                                                    required
                                                    autoComplete="name"
                                                    placeholder="First and last name"
                                                    className="w-full border border-gray-200 px-4 py-3 rounded text-sm focus:outline-none focus:border-black transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1.5" htmlFor="inq-email">Your email</label>
                                                <input
                                                    id="inq-email"
                                                    type="email"
                                                    value={email}
                                                    onChange={e => setEmail(e.target.value)}
                                                    required
                                                    autoComplete="email"
                                                    placeholder="you@example.com"
                                                    className="w-full border border-gray-200 px-4 py-3 rounded text-sm focus:outline-none focus:border-black transition-colors"
                                                />
                                            </div>
                                        </fieldset>

                                        {/* Your interest */}
                                        <fieldset className="space-y-4">
                                            <legend className="text-xs uppercase tracking-widest text-gray-400 mb-3 block">Your interest</legend>
                                            <div>
                                                <label className="block text-sm font-medium mb-1.5" htmlFor="inq-piece">
                                                    Which piece?
                                                </label>
                                                <input
                                                    id="inq-piece"
                                                    type="text"
                                                    value={piece}
                                                    onChange={e => setPiece(e.target.value)}
                                                    required
                                                    placeholder="Title of the artwork — e.g. Whispers"
                                                    readOnly={!!artwork}
                                                    className={`w-full border border-gray-200 px-4 py-3 rounded text-sm focus:outline-none focus:border-black transition-colors ${artwork ? 'bg-gray-50 text-gray-600' : ''}`}
                                                />
                                                {artwork && (
                                                    <p className="text-xs text-gray-400 mt-1.5">
                                                        Pre-filled from the artwork page.{' '}
                                                        <button type="button" onClick={() => setPiece('')} className="underline hover:no-underline">
                                                            Change
                                                        </button>
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1.5" htmlFor="inq-message">
                                                    Anything you'd like to say?
                                                    <span className="text-gray-400 font-normal ml-1">(optional)</span>
                                                </label>
                                                <textarea
                                                    id="inq-message"
                                                    value={message}
                                                    onChange={e => setMessage(e.target.value)}
                                                    rows={4}
                                                    placeholder="e.g. where you plan to hang it, questions about shipping, whether you'd like to visit the studio…"
                                                    className="w-full border border-gray-200 px-4 py-3 rounded text-sm focus:outline-none focus:border-black transition-colors resize-none"
                                                />
                                            </div>
                                        </fieldset>

                                        {/* Terms */}
                                        <label className="flex items-start gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={terms}
                                                onChange={e => setTerms(e.target.checked)}
                                                required
                                                className="mt-0.5 shrink-0"
                                            />
                                            <span className="text-sm text-gray-500">
                                                I have read and accept the{' '}
                                                <a href="/terms" className="underline hover:no-underline" target="_blank">legal terms</a>
                                            </span>
                                        </label>

                                        {status === 'error' && (
                                            <p className="text-sm text-red-600">Something went wrong — please try again.</p>
                                        )}

                                        <div>
                                            <button
                                                type="submit"
                                                disabled={createInquiry.isPending || !terms}
                                                className="bg-black text-white px-8 py-3 rounded text-sm tracking-wide hover:bg-gray-800 transition-colors disabled:opacity-40"
                                            >
                                                {createInquiry.isPending ? 'Sending…' : 'Send inquiry'}
                                            </button>
                                            <p className="text-xs text-gray-400 mt-3">
                                                Maeve will reply personally — no bots, no templates.
                                            </p>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </div>
                    </main>

                    {site?.footer && <Footer {...site.footer} />}
                </div>
            </div>
        </>
    );
}

export async function getStaticProps() {
    const { allContent } = await import('../utils/local-content');
    const data = allContent();
    return { props: { site: data.props.site } };
}
