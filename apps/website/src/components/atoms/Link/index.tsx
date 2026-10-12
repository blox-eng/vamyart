import * as React from 'react';
import NextLink from 'next/link';

export default function Link({ children, href, ...other }) {
    // Pass Any internal link to Next.js Link, for anything else, use <a> tag
    const internal = /^\/(?!\/)/.test(href);
    if (internal) {
        return (
            <NextLink href={href} {...other}>
                {children}
            </NextLink>
        );
    }

    const external = /^https?:\/\//.test(href);
    return (
        <a href={href} {...(external && { target: '_blank', rel: 'noopener noreferrer' })} {...other}>
            {children}
        </a>
    );
}
