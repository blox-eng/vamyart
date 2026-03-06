import Head from 'next/head';
import Link from 'next/link';

export default function OrderSuccess() {
    return (
        <>
            <Head>
                <title>Order confirmed — vamy</title>
                <meta name="robots" content="noindex" />
            </Head>
            <main className="min-h-screen flex items-center justify-center px-4 bg-white">
                <div className="max-w-md text-center">
                    <p className="text-4xl mb-6">✓</p>
                    <h1 className="text-2xl font-light mb-4 tracking-wide">Order confirmed</h1>
                    <p className="text-gray-600 mb-2">
                        Thank you for your purchase. You&apos;ll receive a confirmation email shortly.
                    </p>
                    <p className="text-gray-500 text-sm mb-10">
                        Once your print is prepared and shipped, you&apos;ll get a tracking number by email.
                    </p>
                    <Link
                        href="/gallery"
                        className="text-sm uppercase tracking-widest border-b border-current pb-0.5 hover:opacity-60 transition-opacity"
                    >
                        Back to gallery
                    </Link>
                </div>
            </main>
        </>
    );
}
