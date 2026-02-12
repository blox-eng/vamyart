# Architecture

**Analysis Date:** 2026-02-12

## Pattern Overview

**Overall:** Static Site Generation (SSG) with Content-Driven Component Composition

**Key Characteristics:**
- Content-first architecture: All content (pages, data) stored as flat-file Markdown and JSON
- Model-driven rendering: Components selected at runtime based on content model types
- Next.js static generation with build-time content resolution
- Stackbit CMS integration for headless content management
- Dynamic component loading with Next.js `dynamic()` for code splitting

## Layers

**Content & Data Layer:**
- Purpose: Manages all content files, data models, and content relationships
- Location: `content/pages/`, `content/data/`, `sources/local/models/`
- Contains: Markdown pages with frontmatter, JSON data files, TypeScript model definitions
- Depends on: File system, frontmatter parser, glob patterns
- Used by: Static props resolver, indexer, component registry

**Utilities & Data Resolution:**
- Purpose: Processes raw content, resolves references, generates static paths/props
- Location: `src/utils/`
- Contains: `local-content.ts` (file reading and parsing), `data-utils.js` (post filtering/sorting), `static-props-resolvers.js` (page-specific resolution), `seo-utils.js` (metadata generation)
- Depends on: Content layer, models
- Used by: Page generation, API routes

**Component Registry & Dynamic Loading:**
- Purpose: Maps model names to React components, enables runtime component selection
- Location: `src/components/components-registry.ts`
- Contains: Central mapping of model types to dynamic-imported components
- Depends on: React, Next.js dynamic
- Used by: All layouts and sections for polymorphic rendering

**Component Layer (Hierarchical):**
- Atoms: Smallest reusable components (`src/components/atoms/`) - Action, Link, Badge, Social, BackgroundImage
- Blocks: Form and media blocks (`src/components/blocks/`) - FormBlock, ImageBlock, VideoBlock, TitleBlock and form controls
- Sections: Page sections (`src/components/sections/`) - GenericSection, CarouselSection, FeaturedPostsSection, ImageGallerySection, Footer, Header
- Layouts: Page and post layouts (`src/components/layouts/`) - PageLayout, PostLayout, PostFeedLayout, BaseLayouts (DefaultBaseLayout, BlankBaseLayout)

**Page Entry Point:**
- Purpose: Catch-all dynamic routing and page rendering
- Location: `src/pages/[[...slug]].js`
- Contains: Page component, static path/props generation
- Depends on: Component registry, utilities
- Used by: Next.js router

**API Layer:**
- Purpose: Server-side endpoints for indexing and external integrations
- Location: `src/pages/api/`
- Contains: `reindex.js` for Algolia search indexing, form handlers integrate with HubSpot CRM
- Depends on: Utilities, external services
- Used by: Frontend, external services

**App Shell:**
- Purpose: Global app configuration and wrapping
- Location: `src/pages/_app.js`
- Contains: CSS imports, component wrapper
- Depends on: React, CSS
- Used by: All pages

## Data Flow

**Static Generation Flow (Build Time):**

1. `next build` triggers `getStaticPaths()` in `src/pages/[[...slug]].js`
2. `allContent()` from `src/utils/local-content.ts` reads all `.md` and `.json` files
3. Frontmatter parsed from markdown, JSON loaded directly
4. References resolved: field values that match file IDs are replaced with actual objects
5. URL paths generated for each page using `getPageUrl()`
6. Paths returned to Next.js for static page generation

**Page Rendering Flow (Build Time):**

1. `getStaticProps({ params })` called for each path
2. URL matched to page in content
3. `resolveStaticProps()` applies model-specific resolution from `StaticPropsResolvers`
4. Deep async resolution handles nested references (e.g., post author, category)
5. SEO metadata generated using `seoGenerateTitle()`, `seoGenerateMetaTags()`, `seoGenerateMetaDescription()`
6. Props passed to Page component

**Component Rendering Flow (Runtime):**

1. Page component receives page props with model metadata
2. Retrieves `PageLayout` component using `getComponent(modelName)`
3. PageLayout gets BaseLayout (DefaultBaseLayout or BlankBaseLayout)
4. PageLayout renders sections array by calling `getComponent(section.__metadata.modelName)`
5. Each section renders its children (blocks, nested sections) via recursive component lookup
6. Atoms and blocks render leaf content using styles and field data

**Form Submission Flow:**

1. User submits FormBlock form
2. Form data collected from FormControl components
3. Data sent to HubSpot API via `submitToHubSpot()` (NEXT_PUBLIC_HUBSPOT_PORTAL_ID, NEXT_PUBLIC_HUBSPOT_FORM_GUID)
4. URL parameters (e.g., `?piece=PieceID`) pre-fill Piece field via `useEffect` in FormBlock
5. Success/error messages shown to user

## State Management

**Build-time State:**
- Content objects, pages, and config loaded once and embedded in HTML
- No client-side state management needed for static content

**Runtime State:**
- FormBlock component uses React `useState` for form submission status and loading state
- Header/navigation uses `useState` for mobile menu toggling
- Carousel sections use Swiper.js for internal state
- No global state store (Redux, Zustand, Context)

## Key Abstractions

**Content as Code (CaC):**
- Purpose: Markdown/JSON files treated as data with frontmatter defining structure
- Examples: `content/pages/gallery/first-contact.md`, `content/data/site.json`
- Pattern: File path becomes ID, frontmatter/root keys map to model fields

**Model-Driven Components:**
- Purpose: React components selected by matching `__metadata.modelName` to component registry
- Examples: Section receives `{ __metadata: { modelName: 'GenericSection' }, ... }`, `getComponent('GenericSection')` returns component
- Pattern: Enables runtime polymorphism - same data structure renders different UI based on type

**Reference Resolution:**
- Purpose: Replace string IDs with actual object references for relationships
- Examples: `author: 'content/data/person1.json'` becomes `author: { name: 'John', ... }`
- Pattern: Two-pass traversal - first build fileToContent map, then recursively resolve references

**Stackbit Field Path Annotations:**
- Purpose: Embed content edit hints in rendered HTML for CMS integration
- Examples: `data-sb-field-path=".title"` on title element
- Pattern: Optional (controlled by site.enableAnnotations), used by Stackbit preview

## Entry Points

**Build Entry Point:**
- Location: `next.config.js`
- Triggers: `npm run build`
- Responsibilities: Configure Next.js build (trailing slash, strict mode, allowed dev origins)

**Page Entry Point:**
- Location: `src/pages/[[...slug]].js`
- Triggers: Browser navigation to any URL
- Responsibilities: Catch-all routing, static path/props resolution, page/SEO rendering

**API Entry Point:**
- Location: `src/pages/api/reindex.js`
- Triggers: POST to `/api/reindex`
- Responsibilities: Trigger Algolia search index rebuild

**App Entry Point:**
- Location: `src/pages/_app.js`
- Triggers: Next.js app initialization
- Responsibilities: Import global CSS, wrap all pages with App component

## Error Handling

**Strategy:** Build-time validation with helpful error messages; fail-fast approach

**Patterns:**
- Model mismatch: `throw new Error(\`no page layout matching the page model: ${modelName}\`)` in `src/pages/[[...slug]].js`
- Missing component: `throw new Error(\`no component matching the page section's model name: ${modelName}\`)` in PageLayout and GenericSection
- Unhandled file type: `throw Error(\`Unhandled file type: ${file}\`)` in content reader
- HubSpot config missing: Check for `NEXT_PUBLIC_HUBSPOT_PORTAL_ID` and `NEXT_PUBLIC_HUBSPOT_FORM_GUID` before submission
- Form submission: Try/catch with setSubmitStatus('error') for network failures

## Cross-Cutting Concerns

**Logging:**
- Console.error used in FormBlock for HubSpot and form submission errors
- Minimal console logging for development visibility

**Validation:**
- No formal validation framework; checks via conditionals and guards
- Form presence check: `fields.length === 0` returns null
- Published status filter: `isPublished()` checks `!page.isDraft`
- Reference field detection via model metadata

**Authentication:**
- No authentication layer; site is public
- HubSpot API key embedded in environment variables (frontend-safe portal ID, form GUID)

**Styling:**
- Tailwind CSS with custom theme from `content/data/style.json`
- Dynamic class mapping: `mapStylesToClassNames()` converts style objects to Tailwind classes
- Baselined with custom spacing, colors (light, dark, neutral, neutralAlt, primary), fonts (Inter, Roboto Slab)
- Component-level `className` prop composition with `classNames()` utility

---

*Architecture analysis: 2026-02-12*
