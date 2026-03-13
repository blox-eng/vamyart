// next-intl server config — used when App Router routes need getTranslations().
// The withNextIntl plugin is intentionally NOT used in next.config.js because this
// site uses Pages Router for pages (which uses the built-in next.config i18n config).
// This file is a no-op until App Router pages are added.
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import en from '../../../node_modules/@vamy/i18n/messages/en.json';
import de from '../../../node_modules/@vamy/i18n/messages/de.json';
import bg from '../../../node_modules/@vamy/i18n/messages/bg.json';

const messages = { en, de, bg } as const;

export default getRequestConfig(async ({ requestLocale }) => {
    const locale = (await requestLocale) ?? routing.defaultLocale;
    return {
        locale,
        messages: messages[locale as keyof typeof messages] ?? messages.en,
    };
});
