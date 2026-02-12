# External Integrations

**Analysis Date:** 2026-02-12

## APIs & External Services

**Search Engine:**
- Algolia - Search and autocomplete functionality for gallery content
  - SDK/Client: `algoliasearch` (admin) and `@algolia/autocomplete-js` (client)
  - Environment vars:
    - `NEXT_PUBLIC_ALGOLIA_APP_ID` - Algolia application ID (public)
    - `NEXT_PUBLIC_ALGOLIA_INDEX_NAME` - Index name suffix (public)
    - `NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY` - Search-only API key (public)
    - `ALGOLIA_ADMIN_API_KEY` - Admin API key for indexing (server-side only)
  - Implementation: `src/utils/indexer/index.js` handles content indexing to Algolia
  - Trigger: API route `/api/reindex` triggers index updates

**CRM & Form Submissions:**
- HubSpot - Customer relationship management and form data capture
  - SDK/Client: Native fetch API calls to HubSpot Forms API
  - Environment vars:
    - `NEXT_PUBLIC_HUBSPOT_PORTAL_ID` - HubSpot workspace portal ID (public)
    - `NEXT_PUBLIC_HUBSPOT_FORM_GUID` - Specific form GUID (public)
  - Endpoint: `https://api.hsforms.com/submissions/v3/integration/submit/{portalId}/{formGuid}`
  - Implementation: `src/components/blocks/FormBlock/index.tsx` submits form data via POST
  - Form field mapping: name, email, piece_interest (from Piece dropdown), message

## Data Storage

**Databases:**
- Not applicable - This is a static site generator without server-side database
- Content stored as Git-based Markdown files in `content/pages/` directory
- Data files in JSON format: `content/data/*.json` (header, footer, site config, team members)

**File Storage:**
- Static assets served from `public/` directory
- Images uploaded via Stackbit CMS go to `public/images/` (configured in `stackbit.config.ts`)
- Generated Next.js build output: `.next/` directory

**Caching:**
- Client-side browser caching via Next.js default settings
- No Redis or server-side caching layer

## Authentication & Identity

**Auth Provider:**
- Not applicable - Public website with no user authentication
- Form submission does not require login
- Algolia search is public (read-only)

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, LogRocket, or similar error tracking configured

**Logs:**
- Console logging only: `console.log()` and `console.error()` in:
  - `src/utils/indexer/index.js` - Indexing progress
  - `src/components/blocks/FormBlock/index.tsx` - Form submission errors
  - `src/pages/api/reindex.js` - Reindex API errors
- Netlify server logs available via hosting dashboard

## CI/CD & Deployment

**Hosting:**
- Netlify - Primary deployment target
- Build configuration: `netlify.toml`
  - Build command: `npm run build`
  - Publish directory: `.next` (Next.js default output)
  - Environment variables configured in Netlify dashboard

**CI Pipeline:**
- GitHub Actions - Automated semantic versioning and release
- Workflow: `.github/workflows/release.yml`
  - Triggers: Push to `main` branch or pull requests to `main`
  - Runs semantic-release for version bumping and GitHub releases
  - Node.js 20 with npm cache
  - Creates CHANGELOG.md automatically

**Version Management:**
- semantic-release 24.2.5 - Automatic semantic versioning
- Config in `package.json` release section:
  - Parse conventional commits
  - Generate release notes
  - Update changelog
  - Create GitHub release

## Environment Configuration

**Required env vars:**

**Public (NEXT_PUBLIC_*):**
- `NEXT_PUBLIC_ALGOLIA_APP_ID` - Algolia application ID
- `NEXT_PUBLIC_ALGOLIA_INDEX_NAME` - Algolia index name
- `NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY` - Algolia search API key
- `NEXT_PUBLIC_HUBSPOT_PORTAL_ID` - HubSpot portal ID
- `NEXT_PUBLIC_HUBSPOT_FORM_GUID` - HubSpot form GUID

**Private (server-side only):**
- `ALGOLIA_ADMIN_API_KEY` - Algolia admin key for indexing (used in `/api/reindex`)

**Optional:**
- `STACKBIT_PREVIEW` - Preview mode toggle for Stackbit CMS

**Secrets location:**
- Netlify environment variables (configured in Netlify dashboard)
- GitHub Actions secrets for CI/CD (if needed)
- `.env` file for local development (never committed to git)

## Webhooks & Callbacks

**Incoming:**
- `POST /api/reindex` - Triggers Algolia content reindexing
  - Called manually or via Stackbit CMS webhook after content changes
  - Returns: JSON with indexed URLs or error message

**Outgoing:**
- Form submissions → HubSpot API: `POST https://api.hsforms.com/submissions/v3/integration/submit/{portalId}/{formGuid}`
  - Payload includes: name, email, piece_interest, message, page context
  - Response handling: Success resets form and shows success message; failure shows error message
  - Honeypot field `bot-field` included for spam protection

## Content Management

**CMS:**
- Stackbit (Git-based CMS)
- Git source: `@stackbit/cms-git` configured in `stackbit.config.ts`
- Content directories: `content/pages/`, `content/data/`
- Models defined in: `sources/local/models/` (TypeScript definitions)
- Visual editor assets: `.stackbit/` presets and preview images
- Content is stored as YAML/Markdown in Git - Git becomes the source of truth

---

*Integration audit: 2026-02-12*
