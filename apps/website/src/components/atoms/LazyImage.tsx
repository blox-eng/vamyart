import * as React from 'react';
import classNames from 'classnames';

const FALLBACK_SRC = '/images/img-placeholder.svg';

type LazyImageProps = {
    src: string;
    alt: string;
    className?: string;
    imgClassName?: string;
    loading?: 'lazy' | 'eager';
    onLoad?: () => void;
};

export default function LazyImage({ src, alt, className, imgClassName, loading = 'lazy', onLoad }: LazyImageProps) {
    const [loaded, setLoaded] = React.useState(false);
    const [errored, setErrored] = React.useState(false);
    const resolvedSrc = errored ? FALLBACK_SRC : src;

    return (
        <div className={classNames('relative bg-gray-100 overflow-hidden', className)}>
            <img
                src={resolvedSrc}
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
