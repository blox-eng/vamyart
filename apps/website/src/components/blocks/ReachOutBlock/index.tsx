import * as React from 'react';
import { trpc } from '../../../lib/trpc';
import { ARTWORKS, COMMISSION_OPTION, OTHER_OPTION } from '../../../lib/artworks';

const INPUT_CLASS =
    'w-full border border-gray-200 px-4 py-3 rounded text-sm focus:outline-none focus:border-black focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 transition-colors';

export default function ReachOutBlock() {
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [interest, setInterest] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [terms, setTerms] = React.useState(false);
    const [status, setStatus] = React.useState<'idle' | 'success' | 'error'>('idle');

    const createInquiry = trpc.inquiries.create.useMutation();

    async function submit() {
        setStatus('idle');
        try {
            await createInquiry.mutateAsync({
                name,
                email,
                pieceInterest: interest || 'General inquiry',
                message: message || undefined,
            });
            setStatus('success');
        } catch {
            setStatus('error');
        }
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form = e.currentTarget;
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        await submit();
    }

    if (status === 'success') {
        return (
            <div className="py-10 text-center">
                <p className="text-lg font-light mb-2">Thank you, {name}.</p>
                <p className="text-gray-500 text-sm">Maeve will get back to you personally — within 2 working days.</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {status === 'error' && (
                <div className="text-sm text-red-600 bg-red-50 px-4 py-3 flex items-center justify-between gap-4">
                    <span>Something went wrong. Please try again or email directly.</span>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={createInquiry.isPending || !terms}
                        className="text-red-700 underline underline-offset-2 hover:no-underline disabled:opacity-50"
                    >
                        Try again
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Your name</label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jane Smith"
                        className={INPUT_CLASS}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email address</label>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="jane@example.com"
                        className={INPUT_CLASS}
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">I'm interested in&hellip;</label>
                <select
                    value={interest}
                    onChange={(e) => setInterest(e.target.value)}
                    className={`${INPUT_CLASS} bg-white`}
                >
                    <option value="">— pick a piece or just say hello</option>
                    {ARTWORKS.map((a) => (
                        <option key={a.slug} value={a.title}>{a.title}</option>
                    ))}
                    <option value={COMMISSION_OPTION.title}>{COMMISSION_OPTION.title}</option>
                    <option value={OTHER_OPTION.title}>{OTHER_OPTION.title}</option>
                </select>
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                    Message <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell Maeve what caught your eye, or ask anything you'd like to know."
                    className={`${INPUT_CLASS} resize-none`}
                />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
                <input
                    type="checkbox"
                    checked={terms}
                    onChange={(e) => setTerms(e.target.checked)}
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

            <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-gray-400">
                    A personal reply from Maeve — usually within 2 working days.
                </p>
                <button
                    type="submit"
                    disabled={createInquiry.isPending || !terms}
                    className="bg-black text-white text-sm px-6 py-2 hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                    {createInquiry.isPending ? 'Sending…' : 'Send'}
                </button>
            </div>
        </form>
    );
}
