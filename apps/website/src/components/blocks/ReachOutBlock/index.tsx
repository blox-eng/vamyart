import * as React from 'react';
import Link from 'next/link';
import { trpc } from '../../../lib/trpc';

const ARTWORKS = [
    { value: 'whispers', label: 'Whispers' },
    { value: 'first-contact', label: 'First Contact' },
    { value: 'on-the-horizon', label: 'On the Horizon' },
];

export default function ReachOutBlock() {
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [interest, setInterest] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [status, setStatus] = React.useState<'idle' | 'success' | 'error'>('idle');

    const createInquiry = trpc.inquiries.create.useMutation();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
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

    if (status === 'success') {
        return (
            <div className="py-10 text-center">
                <p className="text-lg font-light mb-2">Thank you, {name}.</p>
                <p className="text-gray-500 text-sm">Maeve will get back to you personally — usually within 2 days.</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {status === 'error' && (
                <p className="text-sm text-red-600 bg-red-50 px-4 py-3">
                    Something went wrong. Please try again or email directly.
                </p>
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
                        className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-600"
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
                        className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-600"
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                    I'm interested in&hellip;
                </label>
                <select
                    value={interest}
                    onChange={(e) => setInterest(e.target.value)}
                    className="w-full border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-gray-600"
                >
                    <option value="">— pick a piece or just say hello</option>
                    {ARTWORKS.map((a) => (
                        <option key={a.value} value={a.label}>{a.label}</option>
                    ))}
                    <option value="commission">A commission</option>
                    <option value="general">Something else</option>
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
                    className="w-full border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:border-gray-600"
                />
            </div>

            <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-gray-400">
                    Maeve replies personally — no bots, no templates.
                </p>
                <button
                    type="submit"
                    disabled={createInquiry.isPending}
                    className="bg-black text-white text-sm px-6 py-2 hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                    {createInquiry.isPending ? 'Sending…' : 'Send'}
                </button>
            </div>
        </form>
    );
}
