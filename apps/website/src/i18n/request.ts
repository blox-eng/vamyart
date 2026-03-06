import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import en from '@vamy/i18n/messages/en.json';
import de from '@vamy/i18n/messages/de.json';
import bg from '@vamy/i18n/messages/bg.json';

const messages = { en, de, bg } as const;

export default getRequestConfig(async ({ requestLocale }) => {
    const locale = (await requestLocale) ?? routing.defaultLocale;
    return {
        locale,
        messages: messages[locale as keyof typeof messages] ?? messages.en,
    };
});
