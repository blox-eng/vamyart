import * as React from 'react';
import { escapeJsonLd } from '../../utils/structured-data';

export default function JsonLd({ data }: { data: object | object[] }) {
    return (
        <script
            type="application/ld+json"
            // Stable, server-serialized; not user input.
            dangerouslySetInnerHTML={{ __html: escapeJsonLd(JSON.stringify(data)) }}
        />
    );
}
