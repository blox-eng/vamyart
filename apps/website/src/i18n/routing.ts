import { defineRouting } from 'next-intl/routing';
import { locales, defaultLocale } from '@vamy/i18n';

export const routing = defineRouting({
    locales,
    defaultLocale,
});
