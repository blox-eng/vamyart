import Head from 'next/head';
import Link from 'next/link';

const TEASER = "Next letter goes out when the paint is dry. You'll see it first.";

export default function Welcome() {
    return (
        <>
            <Head>
                <title>You're in — vamy</title>
                <meta name="robots" content="noindex" />
            </Head>

            <main className="min-h-screen bg-white text-gray-900 flex items-center justify-center px-6 py-24">
                <div className="max-w-[520px] w-full text-center font-serif">
                    <h1
                        className="text-4xl font-light mb-12 opacity-0"
                        style={{ animation: 'letters-fade-in 1200ms ease-out 200ms forwards' }}
                    >
                        You&rsquo;re in.
                    </h1>

                    <p
                        className="text-lg leading-relaxed text-gray-700 mb-16 opacity-0"
                        style={{ animation: 'letters-fade-in 1200ms ease-out 1000ms forwards' }}
                    >
                        {TEASER}
                    </p>

                    <p
                        className="text-base text-gray-600 mb-2 opacity-0"
                        style={{ animation: 'letters-fade-in 1200ms ease-out 1800ms forwards' }}
                    >
                        &mdash; Maeve
                    </p>

                    <p
                        className="text-sm text-gray-500 mb-16 opacity-0"
                        style={{ animation: 'letters-fade-in 1200ms ease-out 2400ms forwards' }}
                    >
                        vamy.art
                    </p>

                    <div
                        className="flex flex-col gap-3 text-sm text-gray-500 opacity-0"
                        style={{ animation: 'letters-fade-in 1200ms ease-out 3200ms forwards' }}
                    >
                        <Link href="/gallery" className="hover:text-gray-900 transition-colors">
                            &rarr; see the gallery
                        </Link>
                        <Link href="/" className="hover:text-gray-900 transition-colors">
                            &rarr; back to vamy.art
                        </Link>
                    </div>
                </div>

                <style jsx>{`
                    @keyframes letters-fade-in {
                        from { opacity: 0; transform: translateY(8px); }
                        to   { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
            </main>
        </>
    );
}
