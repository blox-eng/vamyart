import * as React from 'react';
import type { GalleryPiece } from '@vamy/db';
import { aspectOf } from '@vamy/db/gallery';
import { netlifyImage, netlifyImageSrcSet } from '../../utils/netlify-image';
import { LANDING_WIDTHS, centerScroll, landingImageSizes, planMove, shouldLoop } from '../../utils/slider-loop';

type Props = { pieces: GalleryPiece[]; contactEmail: string };

const WIDE = '(min-width: 640px)';
const NUDGE = 0.6;
const IDLE_MS = 120;

export default function LandingSlider({ pieces = [], contactEmail }: Props) {
    const shown = pieces.filter((p) => p.image);
    const stripRef = React.useRef<HTMLDivElement>(null);
    const beforeRef = React.useRef<HTMLDivElement>(null);
    const trackRef = React.useRef<HTMLDivElement>(null);
    const [looping, setLooping] = React.useState(false);

    React.useEffect(() => {
        const strip = stripRef.current;
        const track = trackRef.current;
        if (!strip || !track || shown.length === 0) return;
        const wide = window.matchMedia(WIDE);
        const update = () => setLooping(wide.matches && shouldLoop(track.offsetWidth, strip.clientWidth));
        update();
        const observer = new ResizeObserver(update);
        observer.observe(strip);
        observer.observe(track);
        wide.addEventListener('change', update);
        return () => {
            observer.disconnect();
            wide.removeEventListener('change', update);
        };
    }, [shown.length]);

    // The real track sits between two clones; `loop` is the distance between copies.
    const geometry = () => {
        const strip = stripRef.current;
        const before = beforeRef.current;
        const track = trackRef.current;
        if (!strip || !before || !track) return null;
        return { strip, loop: track.offsetLeft - before.offsetLeft, max: strip.scrollWidth - strip.clientWidth };
    };

    const recenter = () => {
        const g = geometry();
        if (g && g.loop > 0) g.strip.scrollLeft = centerScroll(g.strip.scrollLeft, g.loop, g.max);
    };

    // Clones were inserted before the real track: show the same pieces from the middle copy.
    React.useLayoutEffect(() => {
        if (looping) recenter();
    }, [looping]);

    const move = (delta: number, smooth: boolean) => {
        const g = geometry();
        if (!g || g.loop <= 0) return;
        const { start, target } = planMove(g.strip.scrollLeft, delta, g.loop, g.max);
        g.strip.scrollLeft = smooth ? start : target;
        if (smooth) g.strip.scrollTo({ left: target, behavior: 'smooth' });
    };

    const nudge = (dir: 1 | -1) => {
        const strip = stripRef.current;
        if (!strip) return;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        move(dir * NUDGE * strip.clientWidth, !reduced);
    };

    React.useEffect(() => {
        const strip = stripRef.current;
        if (!strip || !looping) return;
        let idle: ReturnType<typeof setTimeout> | undefined;
        const onWheel = (e: WheelEvent) => {
            if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
            e.preventDefault();
            const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? strip.clientWidth : 1;
            move(e.deltaY * unit, false);
        };
        // Native swipes can reach an edge; once scrolling settles, jump back to the
        // middle copy. Never mid-scroll, which would cancel a smooth move.
        const onScroll = () => {
            clearTimeout(idle);
            idle = setTimeout(recenter, IDLE_MS);
        };
        strip.addEventListener('wheel', onWheel, { passive: false });
        strip.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            clearTimeout(idle);
            strip.removeEventListener('wheel', onWheel);
            strip.removeEventListener('scroll', onScroll);
        };
    }, [looping]);

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (!looping || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
        e.preventDefault();
        nudge(e.key === 'ArrowRight' ? 1 : -1);
    };

    return (
        <section aria-label="Selected work" className={shown.length ? 'landing' : 'landing landing--empty'}>
            <h1 className="sr-only">Maeve Vamy</h1>
            <div
                ref={stripRef}
                className="landing-strip"
                onKeyDown={onKeyDown}
                {...(looping && { tabIndex: 0, role: 'group', 'aria-label': 'Pieces, use the arrow keys to move' })}
            >
                <div className="landing-rail">
                    {looping && <Track ref={beforeRef} pieces={shown} contactEmail={contactEmail} clone />}
                    <Track ref={trackRef} pieces={shown} contactEmail={contactEmail} />
                    {looping && <Track pieces={shown} contactEmail={contactEmail} clone />}
                </div>
            </div>
            {looping && (
                <div className="landing-arrows">
                    <button type="button" aria-label="Previous pieces" onClick={() => nudge(-1)}>
                        ←
                    </button>
                    <button type="button" aria-label="Next pieces" onClick={() => nudge(1)}>
                        →
                    </button>
                </div>
            )}
        </section>
    );
}

type TrackProps = { pieces: GalleryPiece[]; contactEmail: string; clone?: boolean };

const Track = React.forwardRef<HTMLDivElement, TrackProps>(function Track({ pieces, contactEmail, clone = false }, ref) {
    const tabIndex = clone ? -1 : undefined;
    return (
        <div ref={ref} className="landing-track" aria-hidden={clone || undefined}>
            {pieces.map((piece, i) => (
                <Piece key={piece.slug} piece={piece} first={!clone && i === 0} tabIndex={tabIndex} />
            ))}
            <div className="landing-end">
                <p>Write to me.</p>
                <a href={`mailto:${contactEmail}`} tabIndex={tabIndex}>
                    {contactEmail}
                </a>
            </div>
        </div>
    );
});

function Piece({ piece, first, tabIndex }: { piece: GalleryPiece; first: boolean; tabIndex?: number }) {
    const image = piece.image!;
    const aspect = aspectOf(image);
    const known = image.width != null && image.height != null;
    const srcSet = netlifyImageSrcSet(image.url, LANDING_WIDTHS);
    const excerpt = piece.excerpt?.trim();
    return (
        <a href={`/gallery/${piece.slug}/`} className="landing-piece" tabIndex={tabIndex}>
            <img
                src={netlifyImage(image.url, { width: LANDING_WIDTHS[LANDING_WIDTHS.length - 1] })}
                srcSet={srcSet || undefined}
                sizes={srcSet ? landingImageSizes(aspect) : undefined}
                alt={image.alt}
                width={image.width ?? undefined}
                height={image.height ?? undefined}
                loading={first ? 'eager' : 'lazy'}
                fetchPriority={first ? 'high' : undefined}
                style={{ aspectRatio: aspect, objectFit: known ? undefined : 'contain' }}
            />
            <span className="landing-title">{piece.title}</span>
            {excerpt && <span className="landing-excerpt">{excerpt}</span>}
        </a>
    );
}
