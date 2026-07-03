import * as React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Header from '../components/sections/Header';
import Footer from '../components/sections/Footer';
import { trpc } from '../lib/trpc';
import { COMMISSION_OPTION, OTHER_OPTION } from '../lib/artworks';
import LazyImage from '../components/atoms/LazyImage';
import { resolveSiteUrl } from '../utils/seo-utils';

const STEPS = [
    { n: '01', label: 'Send your inquiry', text: 'Fill in the form — takes under a minute.' },
    { n: '02', label: 'Maeve gets back to you', text: 'Personally, within 2 working days.' },
    { n: '03', label: 'Discuss the details', text: 'Shipping, insurance, payment — all sorted together.' },
    { n: '04', label: 'Secure payment', text: 'Via Stripe link — card, Apple Pay, Google Pay.' },
    { n: '05', label: 'Packed with care', text: 'Museum-grade packaging, fully insured, dispatched within 30 days.' },
    { n: '06', label: 'Tracked shipping', text: 'Maeve will email tracking details once your piece is on its way.' },
    { n: '07', label: 'Certificate included', text: 'Signed certificate of authenticity and provenance documentation.' },
    { n: '08', label: 'Aftercare', text: 'Care instructions included, and Maeve is reachable long after.' },
];

export default function GetAPiece({ site }: { site: any }) {
    const router = useRouter();
    const pieceSlug = typeof router.query.piece === 'string' ? router.query.piece : '';

    const { data: product, isLoading: isProductLoading } = trpc.products.getByArtworkSlug.useQuery(
        { slug: pieceSlug },
        { enabled: !!pieceSlug, staleTime: Infinity, retry: false }
    );

    const base = resolveSiteUrl(site);
    const artwork = product?.artwork ?? null;
    const variant = product?.variants?.[0] ?? null;
    const attrs = (variant?.attributes ?? {}) as Record<string, string>;
    const medium = artwork?.medium || attrs.medium || '';
    const dimensions = artwork?.dimensions || attrs.dimensions || '';

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
    // Published pieces drive the dropdown (DB-backed) — no hardcoded list.
    const piecesQuery = trpc.artworks.listPublic.useQuery(undefined, { staleTime: 60_000 });
    const pieces = piecesQuery.data ?? [];

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form = e.currentTarget;
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
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
                <title>Inquire about a piece — Maeve Vamy</title>
                {base && <link rel="canonical" href={`${base}/get-a-piece/`} />}
                <meta name="description" content="Interested in owning an original? Get in touch and Maeve will get back to you personally." />
                <meta property="og:title" content="Inquire about a piece — Maeve Vamy" />
                <meta property="og:description" content="Interested in owning an original? Get in touch and Maeve will get back to you personally." />
                <meta property="og:image" content="/images/whispers.jpg" />
                <meta property="og:image:alt" content="Whispers — oil painting by Maeve Vamy" />
                <meta property="og:image:width" content="1200" />
                <meta property="og:image:height" content="630" />
                <meta property="og:type" content="website" />
                <meta property="og:site_name" content="Maeve Vamy" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="Inquire about a piece — Maeve Vamy" />
                <meta name="twitter:description" content="Interested in owning an original? Get in touch and Maeve will get back to you personally." />
                <meta name="twitter:image" content="/images/whispers.jpg" />
            </Head>

            <div className="sb-page">
                <div className="sb-base sb-default-base-layout">
                    {site?.header && <Header {...site.header} />}

                    <main className="min-h-screen bg-white">
                        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24 lg:grid lg:grid-cols-5 lg:gap-16">

                            {/* ── Left panel: context ───────────────────────── */}
                            <aside className="lg:col-span-2 mb-12 lg:mb-0">
                                {pieceSlug && isProductLoading ? (
                                    <div className="mb-10 animate-pulse" aria-busy="true" aria-label="Loading artwork details">
                                        <div className="w-full aspect-[3/4] bg-gray-100 rounded-sm mb-6" />
                                        <div className="h-5 w-2/3 bg-gray-100 rounded mb-2" />
                                        <div className="h-3 w-1/3 bg-gray-100 rounded mb-1" />
                                        <div className="h-3 w-1/4 bg-gray-100 rounded mb-4" />
                                    </div>
                                ) : artwork ? (
                                    <div className="mb-10">
                                        <LazyImage
                                            src={`/images/${artwork.slug}.jpg`}
                                            alt={artwork.title}
                                            className="w-full shadow-sm mb-6"
                                            imgClassName="h-auto"
                                            loading="eager"
                                            fetchPriority="high"
                                            sizes="(min-width: 1024px) 40vw, 100vw"
                                        />
                                        <h2 className="text-xl font-light mb-1">{artwork.title}</h2>
                                        {medium && <p className="text-sm text-gray-500">{medium}</p>}
                                        {dimensions && <p className="text-sm text-gray-500">{dimensions}</p>}
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
                                                    className="w-full border border-gray-200 px-4 py-3 rounded text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 focus:border-black transition-colors"
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
                                                    className="w-full border border-gray-200 px-4 py-3 rounded text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 focus:border-black transition-colors"
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
                                                <select
                                                    id="inq-piece"
                                                    value={piece}
                                                    onChange={e => setPiece(e.target.value)}
                                                    required
                                                    className="w-full border border-gray-200 px-4 py-3 rounded text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 focus:border-black transition-colors"
                                                >
                                                    <option value="">— select a piece</option>
                                                    {pieces.map(a => (
                                                        <option key={a.slug} value={a.title}>{a.title}</option>
                                                    ))}
                                                    <option value={COMMISSION_OPTION.title}>{COMMISSION_OPTION.title}</option>
                                                    <option value={OTHER_OPTION.title}>{OTHER_OPTION.title}</option>
                                                </select>
                                                {artwork && (
                                                    <p className="text-xs text-gray-400 mt-1.5">
                                                        Pre-filled from the artwork page — tap to change.
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
                                                    className="w-full border border-gray-200 px-4 py-3 rounded text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 focus:border-black transition-colors resize-none"
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
                                                className="mt-0.5 shrink-0 focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2"
                                            />
                                            <span className="text-sm text-gray-500">
                                                I have read and accept the{' '}
                                                <a href="/terms" className="underline hover:no-underline" target="_blank" rel="noreferrer">Terms</a>
                                                {' '}and{' '}
                                                <a href="/privacy" className="underline hover:no-underline" target="_blank" rel="noreferrer">Privacy Policy</a>.
                                            </span>
                                        </label>

                                        {status === 'error' && (
                                            <div className="text-sm text-red-600 bg-red-50 px-4 py-3 flex items-center justify-between gap-4">
                                                <span>Something went wrong — please try again.</span>
                                                <button
                                                    type="submit"
                                                    disabled={createInquiry.isPending || !terms}
                                                    className="text-red-700 underline underline-offset-2 hover:no-underline disabled:opacity-50"
                                                >
                                                    Try again
                                                </button>
                                            </div>
                                        )}

                                        <div>
                                            <button
                                                type="submit"
                                                disabled={createInquiry.isPending || !terms}
                                                className="bg-black text-white px-8 py-3 rounded text-sm tracking-wide hover:bg-gray-800 transition-colors disabled:opacity-50"
                                            >
                                                {createInquiry.isPending ? 'Sending…' : 'Send inquiry'}
                                            </button>
                                            <p className="text-xs text-gray-400 mt-3">
                                                A personal reply from Maeve — usually within 2 working days.
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
