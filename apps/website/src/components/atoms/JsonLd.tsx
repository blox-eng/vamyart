import * as React from 'react';

export default function JsonLd({ data }: { data: object | object[] }) {
    return (
        <script
            type="application/ld+json"
            // Stable, server-serialized; not user input.
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
    );
}
