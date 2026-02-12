# Technology Stack

**Analysis Date:** 2026-02-12

## Languages

**Primary:**
- TypeScript 5.6.2 - Type system for React components and configuration; strict mode disabled
- JavaScript (ES2018) - API routes and utility scripts
- CSS - Tailwind-based styling via PostCSS

**Secondary:**
- Markdown - Content stored in `content/pages/*.md` with front-matter

## Runtime

**Environment:**
- Node.js 20 (specified in GitHub Actions workflow)

**Package Manager:**
- npm 10+ (inferred from package-lock.json presence)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 15.3.8 - Full-stack React framework for pages, API routes, and SSG
- React 19.1.0 - UI library for components
- React DOM 19.1.0 - React rendering engine

**Styling:**
- Tailwind CSS 3.4.3 - Utility-first CSS framework configured in `tailwind.config.js`
- PostCSS 8+ (inferred) - CSS transformation with autoprefixer and Tailwind nesting

**Content & Markdown:**
- Marked 14.1.2 - Markdown parsing with GitHub Flavored Markdown (GFM) support
- markdown-to-jsx 7.7.3 - Convert markdown to React components
- front-matter 4.0.2 - Parse YAML front-matter from markdown files

**Search & Index:**
- Algolia Search 4.24.0 - Search backend service
- @algolia/autocomplete-js 1.17.1 - Client-side search UI component
- @algolia/autocomplete-theme-classic 1.17.1 - Algolia autocomplete styling

**UI Components:**
- Swiper 11.1.4 - Image carousel/gallery slider
- classnames 2.5.1 - Conditional CSS class composition

**Utilities:**
- dayjs 1.11.11 - Date/time parsing and formatting
- glob 10.4.2 - File pattern matching for content discovery

## Key Dependencies

**Critical:**
- @stackbit/cms-git 1.0.32 - Git-based CMS integration for content management
- @stackbit/types 2.1.10 - Type definitions for Stackbit CMS models
- algoliasearch 4.24.0 - Algolia admin SDK for indexing content

**Infrastructure:**
- @semantic-release/commit-analyzer 13.0.1 - Parse conventional commits
- @semantic-release/release-notes-generator 14.0.3 - Auto-generate release notes
- @semantic-release/changelog 6.0.3 - Maintain changelog file
- @semantic-release/github 11.0.3 - Create GitHub releases
- semantic-release 24.2.5 - Automated versioning and publishing
- autoprefixer 10.4.19 - CSS vendor prefix automation
- prettier 3.3.2 - Code formatting

## Configuration

**Environment:**
- Configuration via environment variables (`.env` file expected)
- Example provided in `.env-example`
- Next.js config in `next.config.js` with trailing slash enabled and strict mode enabled

**Build:**
- TypeScript config: `tsconfig.json` with JSX preservation for Next.js
- Tailwind config: `tailwind.config.js` with custom theme colors and spacing
- PostCSS config: `postcss.config.js` with Tailwind and autoprefixer plugins
- Next.js config: `next.config.js` enables Stackbit preview environment variable

## Platform Requirements

**Development:**
- Node.js 20
- npm or compatible package manager
- Git for content source control

**Production:**
- Netlify (deployment target specified in `netlify.toml`)
- Build command: `npm run build`
- Publish directory: `.next` (Next.js static export)
- Environment variables required for Algolia and HubSpot integrations

---

*Stack analysis: 2026-02-12*
