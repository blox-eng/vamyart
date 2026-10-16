import * as React from 'react';
import type { GalleryPiece } from '@vamy/db';
import { aspectOf } from '@vamy/db/gallery';
import { netlifyImage, netlifyImageSrcSet } from '../../utils/netlify-image';
import { LANDING_WIDTHS, centerScroll, landingImageSizes, planMove, shouldLoop } from '../../utils/slider-loop';
import { SoldTag } from './SoldDot';

type Props = { pieces: GalleryPiece[]; contactEmail: string };

const NUDGE = 0.6;
const IDLE_MS = 120;

export default function LandingSlider({ pieces = [], contactEmail }: Props) {
    const shown = pieces.filter((p) => p.image);
    const sectionRef = React.useRef<HTMLElement>(null);
    const stripRef = React.useRef<HTMLDivElement>(null);
    const beforeRef = React.useRef<HTMLDivElement>(null);
    const trackRef = React.useRef<HTMLDivElement>(null);
    const [looping, setLooping] = React.useState(false);

    // The images fill the screen below everything above the slider: the slim header
    // (the CSS default) plus the announcement banner when one is showing.
    React.useLayoutEffect(() => {
        const section = sectionRef.current;
        if (!section) return;
        const measure = () => section.style.setProperty('--landing-top', `${section.getBoundingClientRect().top + window.scrollY}px`);
        measure();
        // Measure a frame later: writing from inside the observer would re-trigger it.
        let frame = 0;
        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(measure);
        });
        observer.observe(document.body);
        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
        };
    }, []);

    React.useEffect(() => {
        const strip = stripRef.current;
        const track = trackRef.current;
        if (!strip || !track || shown.length === 0) return;
        const update = () => setLooping(shouldLoop(track.offsetWidth, strip.clientWidth));
        update();
        const observer = new ResizeObserver(update);
        observer.observe(strip);
        observer.observe(track);
        return () => observer.disconnect();
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

    React.useEffect(() => {
        const strip = stripRef.current;
        if (!strip || !looping) return;
        let idle: ReturnType<typeof setTimeout> | undefined;
        let touching = false;
        const onWheel = (e: WheelEvent) => {
            if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
            e.preventDefault();
            const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? strip.clientWidth : 1;
            move(e.deltaY * unit, false);
        };
        // Swipes and trackpads can reach an edge; once scrolling settles, jump back to
        // the middle copy. Never mid-scroll or under a finger: that would cancel a smooth
        // move or kill the swipe's momentum. Momentum keeps firing scroll, so the idle
        // timer only runs out after it ends.
        const settle = () => {
            clearTimeout(idle);
            idle = setTimeout(() => {
                if (!touching) recenter();
            }, IDLE_MS);
        };
        const onTouchStart = () => {
            touching = true;
            clearTimeout(idle);
        };
        const onTouchEnd = (e: TouchEvent) => {
            touching = e.touches.length > 0;
            settle();
        };
        strip.addEventListener('wheel', onWheel, { passive: false });
        strip.addEventListener('scroll', settle, { passive: true });
        strip.addEventListener('touchstart', onTouchStart, { passive: true });
        strip.addEventListener('touchend', onTouchEnd, { passive: true });
        strip.addEventListener('touchcancel', onTouchEnd, { passive: true });
        return () => {
            clearTimeout(idle);
            strip.removeEventListener('wheel', onWheel);
            strip.removeEventListener('scroll', settle);
            strip.removeEventListener('touchstart', onTouchStart);
            strip.removeEventListener('touchend', onTouchEnd);
            strip.removeEventListener('touchcancel', onTouchEnd);
        };
    }, [looping]);

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!looping || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
        e.preventDefault();
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        move((e.key === 'ArrowRight' ? 1 : -1) * NUDGE * e.currentTarget.clientWidth, !reduced);
    };

    return (
        <section ref={sectionRef} aria-label="Selected work" className={shown.length ? 'landing' : 'landing landing--empty'}>
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
        <a
            href={`/gallery/${piece.slug}/`}
            className={piece.sold ? 'landing-piece landing-piece--sold' : 'landing-piece'}
            tabIndex={tabIndex}
        >
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
            {piece.sold && <SoldTag soldAt={piece.soldAt} />}
            {excerpt && <span className="landing-excerpt">{excerpt}</span>}
        </a>
    );
}
