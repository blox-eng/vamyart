import * as React from 'react';
import classNames from 'classnames';

import { mapStylesToClassNames as mapStyles } from '../../../utils/map-styles-to-class-names';
import { Social, Action, Link } from '../../atoms';
import ImageBlock from '../../blocks/ImageBlock';
import { trpc } from '../../../lib/trpc';

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
                    <p>&copy; {new Date().getFullYear()} Vamy</p>
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
                    {legalNotice && <p className="text-xs text-gray-400">{legalNotice}</p>}
                </div>
            </div>
        </footer>
    );
}

function NewsletterSignup() {
    const [email, setEmail] = React.useState('');
    const [status, setStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
    const subscribe = trpc.newsletter.subscribe.useMutation();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            await subscribe.mutateAsync({ email });
            setStatus('success');
            setEmail('');
        } catch {
            setStatus('error');
        }
    }

    return (
        <div>
            <h2 className="uppercase text-base tracking-wide mb-2">Stay in the loop</h2>
            <p className="text-sm mb-4">New works, exhibitions, and studio updates.</p>
            {status === 'success' ? (
                <p className="text-sm text-green-600">You&apos;re on the list.</p>
            ) : (
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        className="flex-1 px-0 py-2 text-sm border-b border-current bg-transparent outline-none"
                    />
                    <button
                        type="submit"
                        disabled={subscribe.isPending}
                        className="px-4 py-2 text-sm border border-current transition-opacity hover:opacity-60"
                    >
                        {subscribe.isPending ? '...' : 'Subscribe'}
                    </button>
                </form>
            )}
            {status === 'error' && <p className="text-sm text-red-600 mt-2">Something went wrong.</p>}
        </div>
    );
}
