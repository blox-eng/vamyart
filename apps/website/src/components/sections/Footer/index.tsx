import * as React from 'react';
import classNames from 'classnames';
import { useRouter } from 'next/router';

import { mapStylesToClassNames as mapStyles } from '../../../utils/map-styles-to-class-names';
import { Social, Action, Link } from '../../atoms';
import ImageBlock from '../../blocks/ImageBlock';
import { trpc } from '../../../lib/trpc';
import { Turnstile } from '../../atoms/Turnstile';

export default function Footer(props) {
    const {
        colors = 'bg-light-fg-dark',
        logo,
        socialLinks = [],
        legalLinks = [],
        copyrightText,
        legalNotice,
        styles = {},
        enableAnnotations
    } = props;

    return (
        <footer
            className={classNames(
                'sb-component',
                'sb-component-footer',
                colors,
                styles?.self?.margin ? mapStyles({ padding: styles?.self?.margin }) : undefined,
                styles?.self?.padding ? mapStyles({ padding: styles?.self?.padding }) : 'px-4 py-16'
            )}
            {...(enableAnnotations && { 'data-sb-object-id': props?.__metadata?.id })}
        >
            <div className="mx-auto max-w-7xl">
                {/* Row 1: Logo + Newsletter + Social */}
                <div className="flex flex-col md:flex-row gap-12 md:gap-16">
                    {/* Left: Logo + name */}
                    <div className="shrink-0">
                        <Link href="/" className="flex items-center gap-3">
                            {logo && (
                                <ImageBlock
                                    {...logo}
                                    className="inline-block w-auto"
                                    {...(enableAnnotations && { 'data-sb-field-path': 'logo' })}
                                />
                            )}
                            <span className="text-lg tracking-wide">Maeve Vamy</span>
                        </Link>
                    </div>

                    {/* Right: Newsletter + social */}
                    <div className="flex-1 max-w-md">
                        <NewsletterSignup />
                        <div className="mt-6 text-sm">
                            <Link href="/get-a-piece/" className="underline underline-offset-4 hover:no-underline">
                                Inquire about a piece
                            </Link>
                        </div>
                        {socialLinks.length > 0 && (
                            <ul
                                className="flex items-center gap-6 mt-4"
                                {...(enableAnnotations && { 'data-sb-field-path': 'socialLinks' })}
                            >
                                {socialLinks.map((link, index) => (
                                    <li key={index} className="text-xl">
                                        <Social
                                            {...link}
                                            {...(enableAnnotations && { 'data-sb-field-path': `.${index}` })}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Row 2: Bottom bar */}
                <div className="border-t pt-6 mt-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                    <p>&copy; {new Date().getFullYear()} Maeve Vamy</p>
                    {legalLinks.length > 0 && (
                        <ul
                            className="flex items-center gap-1"
                            {...(enableAnnotations && { 'data-sb-field-path': 'legalLinks' })}
                        >
                            {legalLinks.map((link, index) => (
                                <React.Fragment key={index}>
                                    {index > 0 && <li aria-hidden="true">&middot;</li>}
                                    <li>
                                        <Action
                                            {...link}
                                            className="text-sm"
                                            {...(enableAnnotations && { 'data-sb-field-path': `.${index}` })}
                                        />
                                    </li>
                                </React.Fragment>
                            ))}
                        </ul>
                    )}
                    {legalNotice && <p className="text-xs text-faint">{legalNotice}</p>}
                </div>
            </div>
        </footer>
    );
}

const NOT_READY = "Still checking you're not a bot. Try again in a moment.";

function NewsletterSignup() {
    const router = useRouter();
    const [email, setEmail] = React.useState('');
    const [status, setStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
    const [error, setError] = React.useState('');
    const [token, setToken] = React.useState('');
    const [attempt, setAttempt] = React.useState(0);
    const subscribe = trpc.newsletter.subscribe.useMutation();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!token) {
            setStatus('error');
            setError(NOT_READY);
            return;
        }
        try {
            await subscribe.mutateAsync({
                email,
                locale: router.locale ?? 'en',
                turnstileToken: token,
            });
            setStatus('success');
            setEmail('');
        } catch (err) {
            setStatus('error');
            setError(err instanceof Error ? err.message : 'Something went wrong.');
            setToken('');
            setAttempt((n) => n + 1);
        }
    }

    return (
        <div>
            <h2 className="font-serif text-2xl mb-3">the letter</h2>
            <p className="text-sm leading-relaxed mb-5 max-w-sm">
                Sometimes from the studio. About paint, mostly. About what&rsquo;s on the wall, sometimes. About what&rsquo;s gone, occasionally.
            </p>
            {status === 'success' ? (
                <p className="text-sm font-serif italic">Check your inbox.</p>
            ) : (
                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 sm:gap-2 max-w-sm">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        className="flex-1 min-w-0 px-0 py-2 text-sm border-b border-current bg-transparent outline-none"
                    />
                    <button
                        type="submit"
                        disabled={subscribe.isPending}
                        className="shrink-0 px-4 py-2 text-sm border border-current transition-opacity hover:opacity-60"
                    >
                        {subscribe.isPending ? '...' : 'Subscribe'}
                    </button>
                    <Turnstile key={attempt} onToken={setToken} />
                </form>
            )}
            {status === 'error' && <p className="text-sm text-neg mt-2">{error}</p>}
        </div>
    );
}
