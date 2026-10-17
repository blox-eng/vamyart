import Head from 'next/head';
import Header from '../components/sections/Header';
import Footer from '../components/sections/Footer';

export default function NotFound({ site }: { site: any }) {
    return (
        <>
            <Head>
                <title>Not found — Maeve Vamy</title>
            </Head>
            <div className="sb-page">
                <div className="sb-base sb-default-base-layout">
                    {site?.header && <Header {...site.header} />}
                    <main className="min-h-[60vh] bg-paper">
                        <div className="mx-auto max-w-5xl px-4 py-24 sm:py-32 text-center space-y-8">
                            <h1 className="text-3xl font-light">This page isn&rsquo;t on the wall.</h1>
                            <p className="flex justify-center gap-8 text-sm">
                                <a href="/gallery/" className="underline underline-offset-4 hover:text-muted">See the gallery</a>
                                <a href="/get-a-piece/" className="underline underline-offset-4 hover:text-muted">Commission a piece</a>
                            </p>
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
    return { props: { site: allContent().props.site } };
}
