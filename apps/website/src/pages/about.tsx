import Head from 'next/head';
import Header from '../components/sections/Header';
import Footer from '../components/sections/Footer';

export default function About({ site }: { site: any }) {
    return (
        <>
            <Head>
                <title>About — Maeve Vamy</title>
                <meta name="description" content="Bulgarian oil painter working between realism and abstraction, painting from her studio in Stara Zagora." />
            </Head>

            <div className="sb-page">
                <div className="sb-base sb-default-base-layout">
                    {site?.header && <Header {...site.header} />}

                    <main className="min-h-screen bg-white">
                        <div className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
                            {/* Bio */}
                            <section className="mb-16">
                                <h1 className="text-3xl font-light mb-8">Maeve Vamy</h1>

                                <div className="space-y-5 text-gray-600 leading-relaxed">
                                    <p>
                                        Maeve Vamy is a Bulgarian oil painter. She works between realism and
                                        abstraction, painting from direct observation in her studio in Stara
                                        Zagora.
                                    </p>
                                    <p>
                                        Each piece is finished slowly — built up in layers of oil on linen,
                                        then varnished and signed only when it's truly done.
                                    </p>
                                </div>
                            </section>

                            {/* Artist statement */}
                            <section>
                                <h2 className="text-xs uppercase tracking-widest text-gray-400 mb-6">Artist statement</h2>
                                <blockquote className="border-l-2 border-gray-300 pl-6">
                                    <p className="italic text-gray-600 leading-relaxed">
                                        "I paint because looking isn't enough. A painting captures what a
                                        moment felt like — the mess, the slowness, the refusal to be rushed.
                                        That's the point."
                                    </p>
                                    <footer className="mt-4 text-sm text-gray-400">— Maeve Vamy</footer>
                                </blockquote>
                            </section>
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
