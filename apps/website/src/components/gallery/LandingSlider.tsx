import * as React from 'react';
import type { GalleryPiece } from '@vamy/db';
import { aspectOf } from '@vamy/db/gallery';
import { netlifyImage, netlifyImageSrcSet } from '../../utils/netlify-image';
import { LANDING_WIDTHS, landingImageSizes, shouldLoop, wrapScroll } from '../../utils/slider-loop';

type Props = { pieces: GalleryPiece[]; contactEmail: string };

const WIDE = '(min-width: 640px)';
const NUDGE = 0.6;

export default function LandingSlider({ pieces = [], contactEmail }: Props) {
    const shown = pieces.filter((p) => p.image);
    const stripRef = React.useRef<HTMLDivElement>(null);
    const trackRef = React.useRef<HTMLDivElement>(null);
    const cloneRef = React.useRef<HTMLDivElement>(null);
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

    const loopWidth = () => {
        const track = trackRef.current;
        const clone = cloneRef.current;
        return track && clone ? clone.offsetLeft - track.offsetLeft : 0;
    };

    // Before moving by `delta`, jump one loop so the move never runs off either
    // end: the clone is identical, so the jump is invisible.
    const scrollByLooped = (delta: number, behavior: ScrollBehavior) => {
        const strip = stripRef.current;
        const loop = loopWidth();
        if (!strip || !loop) return;
        if (strip.scrollLeft + delta < 0) strip.scrollLeft += loop;
        else if (strip.scrollLeft + delta >= loop) strip.scrollLeft -= loop;
        if (behavior === 'auto') strip.scrollLeft += delta;
        else strip.scrollBy({ left: delta, behavior });
    };

    const nudge = (dir: 1 | -1) => {
        const strip = stripRef.current;
        if (!strip) return;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        scrollByLooped(dir * NUDGE * strip.clientWidth, reduced ? 'auto' : 'smooth');
    };

    React.useEffect(() => {
        const strip = stripRef.current;
        if (!strip || !looping) return;
        const onWheel = (e: WheelEvent) => {
            if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
            e.preventDefault();
            const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? strip.clientWidth : 1;
            scrollByLooped(e.deltaY * unit, 'auto');
        };
        const onScroll = () => {
            const loop = loopWidth();
            if (loop) {
                const next = wrapScroll(strip.scrollLeft, loop);
                if (next !== strip.scrollLeft) strip.scrollLeft = next;
            }
        };
        strip.addEventListener('wheel', onWheel, { passive: false });
        strip.addEventListener('scroll', onScroll, { passive: true });
        return () => {
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
            <div ref={stripRef} className="landing-strip" tabIndex={looping ? 0 : undefined} onKeyDown={onKeyDown}>
                <div className="landing-rail">
                    <Track ref={trackRef} pieces={shown} contactEmail={contactEmail} />
                    {looping && <Track ref={cloneRef} pieces={shown} contactEmail={contactEmail} clone />}
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
