#!/usr/bin/env node
// Usage: node scripts/seo-check.mjs <baseUrl> <pieceSlug> [collectionSlug]
const [baseArg, pieceSlug, collectionSlug] = process.argv.slice(2);
if (!baseArg || !pieceSlug) {
    console.error('Usage: seo-check.mjs <baseUrl> <pieceSlug> [collectionSlug]');
    process.exit(2);
}
const base = baseArg.replace(/\/+$/, '');
let failed = false;

const report = (ok, label, detail = '') => {
    if (!ok) failed = true;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` (${detail})` : ''}`);
};

const count = (html, re) => (html.match(re) || []).length;

async function checkPage(path) {
    const res = await fetch(base + path, { redirect: 'manual' });
    report(res.status === 200, `${path} responds 200`, `got ${res.status}`);
    if (res.status !== 200) return;
    const html = await res.text();

    const h1s = count(html, /<h1[\s>]/g);
    report(h1s === 1, `${path} has exactly one h1`, `found ${h1s}`);

    const titles = count(html, /<title[\s>]/g);
    report(titles === 1, `${path} has exactly one title`, `found ${titles}`);
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] ?? '';
    const titleRe = path === '/' ? /^Maeve Vamy( — .+)?$/ : /^(Maeve Vamy|.+ — Maeve Vamy)$/;
    const titleOk = titleRe.test(title) && !/ {2}/.test(title);
    report(titleOk, `${path} title format`, JSON.stringify(title));

    const canonicals = html.match(/<link[^>]*rel="canonical"[^>]*>/g) || [];
    report(canonicals.length === 1, `${path} has exactly one canonical`, `found ${canonicals.length}`);
    const href = (canonicals[0]?.match(/href="([^"]*)"/) || [])[1] ?? '';
    report(/^https?:\/\/.+\/$/.test(href), `${path} canonical is absolute and ends with /`, href);

    const ogTag = (html.match(/<meta[^>]*property="og:image"[^>]*>/) || [])[0] ?? '';
    const og = (ogTag.match(/content="([^"]*)"/) || [])[1] ?? '';
    report(/^https?:\/\//.test(og), `${path} og:image is absolute`, og);

    const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
    const bad = blocks.filter(([, json]) => {
        try { JSON.parse(json); return false; } catch { return true; }
    });
    report(bad.length === 0, `${path} ld+json blocks parse`, `${blocks.length} block(s)`);

    report(html.includes('href="/gallery/'), `${path} links into /gallery/`);
}

const paths = ['/', '/gallery/'];
if (collectionSlug) paths.push(`/gallery/collections/${collectionSlug}/`);
else console.log('skip /gallery/collections/<slug>/ (no collectionSlug given)');
paths.push(`/gallery/${pieceSlug}/`);
for (const p of paths) await checkPage(p);

const idx = await fetch(`${base}/gallery/collections/`, { redirect: 'manual' });
report([301, 308].includes(idx.status), '/gallery/collections/ redirects', `got ${idx.status}`);

process.exit(failed ? 1 : 0);
