# @vamy/i18n

next-intl message files for EN / DE / BG.

## Structure

```
messages/
  en.json
  de.json
  bg.json
```

## Adding a translation key

1. Add the key and English value to `messages/en.json`
2. Add the translated value to `messages/de.json` and `messages/bg.json`
3. Use via `useTranslations()` hook in any component

Missing keys fall back to the key string — they don't throw, but they look bad in production. Always add all three languages.
