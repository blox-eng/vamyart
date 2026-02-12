# Codebase Structure

**Analysis Date:** 2026-02-12

## Directory Layout

```
vamy.art/
├── src/                           # Application source code
│   ├── pages/                     # Next.js pages and API routes
│   │   ├── [[...slug]].js        # Catch-all dynamic routing
│   │   ├── _app.js               # App wrapper and CSS imports
│   │   └── api/
│   │       └── reindex.js         # API endpoint for search indexing
│   ├── components/                # React components (atomic design)
│   │   ├── atoms/                 # Reusable basic components
│   │   ├── blocks/                # Compound components (FormBlock, ImageBlock, etc)
│   │   ├── sections/              # Page sections (GenericSection, Footer, etc)
│   │   ├── layouts/               # Page and base layouts
│   │   ├── svgs/                  # SVG icon components
│   │   └── components-registry.ts # Dynamic component mapping
│   ├── utils/                     # Utility functions and data processing
│   │   ├── local-content.ts       # File reading and content loading
│   │   ├── static-props-resolvers.js    # Build-time prop resolution per model
│   │   ├── data-utils.js          # Post filtering, sorting, pagination
│   │   ├── seo-utils.js           # SEO metadata generation
│   │   ├── page-utils.js          # Page URL routing logic
│   │   ├── base-layout.ts         # Layout selection logic
│   │   ├── map-styles-to-class-names.ts # Tailwind class generation
│   │   ├── get-data-attrs.ts      # Stackbit annotation attributes
│   │   └── indexer/               # Algolia search indexing
│   └── css/                       # Global styles
│       └── main.css               # Tailwind imports and overrides
├── content/                       # Flat-file content storage
│   ├── pages/                     # Page files (markdown with frontmatter)
│   │   ├── index.md               # Homepage
│   │   ├── gallery/               # Gallery pages
│   │   ├── get-a-piece.md         # Purchase form page
│   │   └── terms.md               # Terms of service
│   └── data/                      # JSON data files (config, people, etc)
│       ├── site.json              # Global site configuration
│       ├── header.json            # Header section data
│       ├── footer.json            # Footer section data
│       ├── style.json             # Theme colors and styles
│       └── person*.json           # Team/person data
├── sources/local/                 # Stackbit model definitions
│   ├── models/                    # TypeScript model definitions
│   │   ├── index.ts               # Centralized export of all models
│   │   ├── Config.ts              # Site config model
│   │   ├── PageLayout.ts          # Page layout model
│   │   ├── PostLayout.ts          # Post/blog layout model
│   │   ├── GenericSection.ts      # Generic section model
│   │   └── *.ts                   # Other component models
│   └── presets/                   # Stackbit UI preset configurations
├── public/                        # Static assets
├── .planning/codebase/            # GSD planning documents
├── .github/workflows/             # GitHub Actions CI/CD
├── .claude/                       # Claude interaction metadata
├── .vscode/                       # VS Code settings
├── .stackbit/                     # Stackbit CMS configuration
│   └── presets/                   # CMS UI presets and imagery
├── next.config.js                 # Next.js configuration
├── tailwind.config.js             # Tailwind CSS theme
├── tsconfig.json                  # TypeScript configuration
├── package.json                   # Dependencies and scripts
├── netlify.toml                   # Netlify deployment config
├── stackbit.config.ts             # Stackbit CMS configuration
├── postcss.config.js              # PostCSS (Tailwind) config
└── .prettierrc                    # Code formatting rules
```

## Directory Purposes

**`src/`:**
- Purpose: All application code and components
- Contains: Pages, components, utilities, styles
- Key files: `pages/[[...slug]].js` (main entry), `pages/_app.js` (app shell)

**`src/pages/`:**
- Purpose: Next.js page and API route files
- Contains: Page components and API handlers
- Key files: `[[...slug]].js` (dynamic catch-all routing), `_app.js` (app wrapper)

**`src/pages/api/`:**
- Purpose: Backend API endpoints
- Contains: Server-side request handlers
- Key files: `reindex.js` (search indexing trigger)

**`src/components/`:**
- Purpose: All React components organized by type
- Contains: Reusable UI components following atomic design
- Key directories: `atoms/` (smallest), `blocks/` (larger), `sections/` (page-level), `layouts/` (page wrappers)

**`src/components/atoms/`:**
- Purpose: Basic reusable components (building blocks)
- Contains: Action, Link, Badge, Social, BackgroundImage
- Pattern: Simple, single responsibility, accept props and render

**`src/components/blocks/`:**
- Purpose: Larger components combining atoms
- Contains: FormBlock (with sub-controls), ImageBlock, VideoBlock, TitleBlock, SearchBlock
- Pattern: Medium complexity, often contain layout logic

**`src/components/sections/`:**
- Purpose: Full-width page sections combining blocks and atoms
- Contains: GenericSection, CarouselSection, FeaturedItemsSection, ImageGallerySection, Header, Footer, PostFeedSection
- Pattern: High-level layout components, often map over arrays of items

**`src/components/layouts/`:**
- Purpose: Page-level wrapper layouts
- Contains: PageLayout (main pages), PostLayout (blog posts), PostFeedLayout (post listings), PostFeedCategoryLayout (category pages), BaseLayouts (DefaultBaseLayout, BlankBaseLayout, PostLayout)
- Pattern: Accept page and site props, render nested sections

**`src/components/svgs/`:**
- Purpose: SVG icon components
- Contains: Individual SVG files as React components (facebook.tsx, chevron-left.tsx, etc.)
- Pattern: Each SVG is a simple functional component

**`src/utils/`:**
- Purpose: Utility functions for data processing, routing, styling
- Key files:
  - `local-content.ts`: Reads .md and .json files, parses frontmatter, resolves references
  - `static-props-resolvers.js`: Model-specific static prop resolution (PostLayout, PostFeedLayout, etc.)
  - `data-utils.js`: Post filtering (featured, published), sorting, pagination
  - `seo-utils.js`: SEO metadata generation
  - `page-utils.js`: URL path generation from page structure
  - `base-layout.ts`: Selects correct BaseLayout component
  - `map-styles-to-class-names.ts`: Converts style objects to Tailwind classes

**`src/utils/indexer/`:**
- Purpose: Algolia search index building
- Contains: Index building logic, markdown-to-plaintext conversion
- Key files: `index.js` (main indexer), `markdown-plaintext.js` (text extraction)

**`src/css/`:**
- Purpose: Global stylesheets
- Contains: `main.css` with Tailwind directives and custom overrides

**`content/pages/`:**
- Purpose: Markdown page files
- Contains: `.md` files with frontmatter defining page structure, type, title, sections
- Pattern: File path becomes URL path; frontmatter is page metadata; markdown_content is optional body text
- Examples: `content/pages/index.md` (homepage), `content/pages/gallery/first-contact.md` (gallery piece)

**`content/data/`:**
- Purpose: JSON data files for site-wide content
- Contains: Configuration, team members, style definitions, header/footer
- Key files: `site.json` (global config), `header.json` (header structure), `footer.json` (footer structure), `style.json` (theme colors), `person*.json` (team members)

**`sources/local/models/`:**
- Purpose: Stackbit model definitions (TypeScript)
- Contains: One file per model, defines field schema and metadata
- Pattern: Each model file exports a model object with name, label, type, fields, and Stackbit UI hints

**`public/`:**
- Purpose: Static assets served by Next.js
- Contains: Images, fonts, favicons, PDFs
- Committed: Yes

**`.planning/codebase/`:**
- Purpose: GSD planning documents
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md
- Generated: No, manually maintained
- Committed: Yes

## Key File Locations

**Entry Points:**
- `src/pages/[[...slug]].js`: Main page component handling all URLs
- `src/pages/_app.js`: App wrapper importing global CSS
- `next.config.js`: Next.js build configuration
- `src/pages/api/reindex.js`: Search indexing API endpoint

**Configuration:**
- `stackbit.config.ts`: Stackbit CMS configuration
- `tailwind.config.js`: Tailwind theme (colors, fonts, spacing)
- `next.config.js`: Next.js options (trailing slash, strict mode)
- `tsconfig.json`: TypeScript compiler options
- `.prettierrc`: Code formatter settings

**Core Logic:**
- `src/utils/local-content.ts`: Content loading and reference resolution
- `src/utils/static-props-resolvers.js`: Build-time prop resolution
- `src/components/components-registry.ts`: Dynamic component mapping
- `src/components/blocks/FormBlock/index.tsx`: Form submission with HubSpot integration

**Content:**
- `content/pages/`: All page content
- `content/data/`: Configuration and reusable data
- `sources/local/models/`: Model schema definitions

## Naming Conventions

**Files:**
- React components: PascalCase with `.tsx` extension (e.g., `GenericSection.tsx`)
- Utilities: camelCase with `.ts` or `.js` extension (e.g., `map-styles-to-class-names.ts`)
- SVG components: kebab-case (e.g., `chevron-left.tsx`)
- Pages: kebab-case directories with `.md` (e.g., `gallery/first-contact.md`)
- Data files: kebab-case or simple names with `.json` (e.g., `site.json`, `person1.json`)

**Directories:**
- Component directories: PascalCase matching component name (e.g., `GenericSection/`)
- Feature directories: kebab-case (e.g., `gallery/`, `contact/`)
- Utility directories: kebab-case (e.g., `indexer/`)

**React Components:**
- Functional components with default export
- Props interface typically unnamed, typed inline or in same file
- Use destructuring in function parameters

**Variables and Functions:**
- camelCase for variables and function names
- UPPERCASE_SNAKE_CASE for constants
- `__metadata` for special internal properties (Sourcebit-compatible)
- `data-sb-*` for Stackbit annotations (data-sb-field-path, data-sb-object-id)

**CSS Classes:**
- Tailwind class names (e.g., `flex`, `text-lg`, `mb-4`)
- Custom classes with `sb-` prefix for Stackbit styling (e.g., `sb-component`, `sb-component-button`)
- Convention: `sb-component-[type]` and `sb-component-[type]-[variant]`

## Where to Add New Code

**New Page:**
- Create `.md` file in `content/pages/[section]/[page-name].md`
- Add frontmatter: `type: PageLayout`, `title: "...", `sections: []`
- Build-time: Next.js automatically generates route and renders

**New Component:**
- Create directory in appropriate hierarchy: `src/components/[atoms|blocks|sections]/ComponentName/`
- Add `index.tsx` with component function
- Add model definition in `sources/local/models/ComponentName.ts`
- Register in `src/components/components-registry.ts` with dynamic import
- Use in content by adding section/block with matching type

**New Data File:**
- Create `.json` in `content/data/[file-name].json`
- Define structure matching Stackbit model
- Reference from pages or other data files via filename string in reference fields
- Automatically resolved at build time

**New Section Content:**
- Modify existing page `.md` file or create new page
- Add section object to `sections` array with `type: "SectionName"` and required fields
- Section component looks up via `getComponent(type)` and renders

**New Utility Function:**
- Create `.ts` or `.js` file in `src/utils/`
- Export function with clear input/output types
- Used by page resolvers, components, or API routes

**New Form Control:**
- Create component in `src/components/blocks/FormBlock/[ControlName]/`
- Create model in `sources/local/models/[ControlName]FormControl.ts`
- Register in `components-registry.ts`
- Add to form fields via page frontmatter

**New API Endpoint:**
- Create file in `src/pages/api/[endpoint-name].js`
- Export default function: `async function handler(req, res) { ... }`
- Accessible via `/api/[endpoint-name]`

## Special Directories

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes, by `npm run build`
- Committed: No, in `.gitignore`

**`node_modules/`:**
- Purpose: NPM dependency installations
- Generated: Yes, by `npm install`
- Committed: No, in `.gitignore`

**`.git/`:**
- Purpose: Git repository metadata
- Generated: No, initialized once
- Committed: N/A (git metadata)

**`.planning/`:**
- Purpose: GSD planning and analysis documents
- Generated: No, maintained by Claude agents
- Committed: Yes

**`.stackbit/`:**
- Purpose: Stackbit CMS UI presets and imagery
- Generated: No, configured by Stackbit
- Committed: Yes

**`sources/local/presets/images/`:**
- Purpose: Preview images for Stackbit components
- Generated: No, user-provided
- Committed: Yes

---

*Structure analysis: 2026-02-12*
