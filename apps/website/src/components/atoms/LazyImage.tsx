import * as React from 'react';
import classNames from 'classnames';
import { netlifyImage, netlifyImageSrcSet, DEFAULT_WIDTHS } from '../../utils/netlify-image';

const FALLBACK_SRC = '/images/img-placeholder.svg';

type LazyImageProps = {
    src: string;
    alt: string;
    className?: string;
    imgClassName?: string;
    loading?: 'lazy' | 'eager';
    fetchPriority?: 'high' | 'low' | 'auto';
    widths?: number[];
    sizes?: string;
    // Intrinsic pixel size: lets the browser reserve the box before the image loads.
    width?: number | null;
    height?: number | null;
    onLoad?: () => void;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'className' | 'onLoad'>;

export default function LazyImage({ src, alt, className, imgClassName, loading = 'lazy', fetchPriority, widths = DEFAULT_WIDTHS, sizes = '100vw', width, height, onLoad, ...rest }: LazyImageProps) {
    const imgRef = React.useRef<HTMLImageElement>(null);
    const [loaded, setLoaded] = React.useState(false);
    const [errored, setErrored] = React.useState(false);

    React.useEffect(() => {
        setLoaded(false);
        setErrored(false);
        // If the browser already has the image (cached / SSR), onLoad won't fire — sync state manually.
        const img = imgRef.current;
        if (img?.complete && img.naturalWidth > 0) {
            setLoaded(true);
            onLoad?.();
        }
    }, [src, onLoad]);

    const resolvedSrc = errored ? FALLBACK_SRC : src;
    const optimizedSrc = netlifyImage(resolvedSrc, { width: widths[widths.length - 1] });
    const srcSet = netlifyImageSrcSet(resolvedSrc, widths) || undefined;

    return (
        <div className={classNames('relative overflow-hidden', className)} {...rest}>
            <img
                ref={imgRef}
                src={optimizedSrc}
                srcSet={srcSet}
                sizes={srcSet ? sizes : undefined}
                alt={alt}
                width={width ?? undefined}
                height={height ?? undefined}
                loading={loading}
                fetchPriority={fetchPriority}
                onLoad={() => { setLoaded(true); onLoad?.(); }}
                onError={() => { if (!errored) setErrored(true); }}
                className={classNames(
                    'w-full h-full transition-opacity duration-deliberate',
                    loaded ? 'opacity-100' : 'opacity-0',
                    imgClassName,
                )}
            />
        </div>
    );
}
