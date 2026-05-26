import * as React from 'react';
import classNames from 'classnames';
import { netlifyImage, netlifyImageSrcSet } from '../../utils/netlify-image';

const FALLBACK_SRC = '/images/img-placeholder.svg';

type LazyImageProps = {
    src: string;
    alt: string;
    className?: string;
    imgClassName?: string;
    loading?: 'lazy' | 'eager';
    widths?: number[];
    sizes?: string;
    onLoad?: () => void;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'className' | 'onLoad'>;

export default function LazyImage({ src, alt, className, imgClassName, loading = 'lazy', widths = [400, 800, 1200, 1600], sizes = '100vw', onLoad, ...rest }: LazyImageProps) {
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
        <div className={classNames('relative bg-gray-100 overflow-hidden', className)} {...rest}>
            <img
                ref={imgRef}
                src={optimizedSrc}
                srcSet={srcSet}
                sizes={srcSet ? sizes : undefined}
                alt={alt}
                loading={loading}
                onLoad={() => { setLoaded(true); onLoad?.(); }}
                onError={() => { if (!errored) setErrored(true); }}
                className={classNames(
                    'w-full h-full transition-opacity duration-300',
                    loaded ? 'opacity-100' : 'opacity-0',
                    imgClassName,
                )}
            />
        </div>
    );
}
