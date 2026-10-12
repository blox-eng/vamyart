import Head from 'next/head';
import Link from 'next/link';

export default function Farewell() {
    return (
        <>
            <Head>
                <title>Farewell — vamy</title>
                <meta name="robots" content="noindex" />
            </Head>

            <main className="min-h-screen bg-paper text-ink flex items-center justify-center px-6 py-24">
                <div className="max-w-[520px] w-full text-center font-serif">
                    <h1
                        className="text-4xl font-light mb-12 opacity-0"
                        style={{ animation: 'letters-fade-dim 1600ms 200ms forwards' }}
                    >
                        The door&rsquo;s closed.
                    </h1>

                    <p
                        className="text-lg leading-relaxed text-ink mb-8 opacity-0"
                        style={{ animation: 'letters-fade-dim 1600ms 1000ms forwards' }}
                    >
                        You won&rsquo;t hear from the studio again. No hard feelings &mdash;
                        the work keeps happening either way.
                    </p>

                    <p
                        className="text-base text-muted mb-16 opacity-0"
                        style={{ animation: 'letters-fade-dim 1600ms 1800ms forwards' }}
                    >
                        If it was an accident, you can sign back up at vamy.art.
                    </p>

                    <p
                        className="text-base text-muted mb-16 opacity-0"
                        style={{ animation: 'letters-fade-dim 1600ms 2600ms forwards' }}
                    >
                        &mdash; Maeve
                    </p>

                    <div
                        className="text-sm text-muted opacity-0"
                        style={{ animation: 'letters-fade-in 1600ms 3400ms forwards' }}
                    >
                        <Link href="/" className="hover:text-ink transition-colors">
                            &rarr; back to vamy.art
                        </Link>
                    </div>
                </div>

                <style jsx>{`
                    @keyframes letters-fade-dim {
                        from { opacity: 0; transform: translateY(8px); }
                        to   { opacity: 0.55; transform: translateY(0); }
                    }
                    @keyframes letters-fade-in {
                        from { opacity: 0; transform: translateY(8px); }
                        to   { opacity: 1; transform: translateY(0); }
                    }
                    @media (prefers-reduced-motion: reduce) {
                        h1, p { opacity: 0.55 !important; animation: none !important; transform: none !important; }
                        div { opacity: 1 !important; animation: none !important; transform: none !important; }
                    }
                `}</style>
            </main>
        </>
    );
}
