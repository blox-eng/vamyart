# Coding Conventions

**Analysis Date:** 2026-02-12

## Naming Patterns

**Files:**
- Components use `index.tsx` pattern: `src/components/atoms/Action/index.tsx`, `src/components/blocks/FormBlock/index.tsx`
- Utility files use descriptive kebab-case: `map-styles-to-class-names.ts`, `get-data-attrs.ts`, `local-content.ts`
- SVG components are kebab-case files but used with camelCase in exports: `arrow-down.tsx` exported as `ArrowDown`
- API routes use `.js` extension: `src/pages/api/reindex.js`
- Page files use `.js` extension: `src/pages/[[...slug]].js`, `src/pages/_app.js`

**Functions:**
- Use camelCase for all functions: `submitToHubSpot()`, `handleSubmit()`, `mapStylesToClassNames()`, `getComponent()`
- Higher-order/specialized functions may use PascalCase when they return components: `HeaderVariants()`, `HeaderLogoLeftPrimaryLeft()`
- Utility functions are lowercase camelCase: `getAllPostsSorted()`, `isPublished()`, `resolveReferences()`

**Variables:**
- Use camelCase: `HUBSPOT_PORTAL_ID`, `elementId`, `submitStatus`, `isSubmitting`, `fieldPath`
- Constants use SCREAMING_SNAKE_CASE: `HUBSPOT_PORTAL_ID`, `HUBSPOT_FORM_GUID`, `TAILWIND_MAP`
- State variables use camelCase: `isSubmitting`, `submitStatus`, `fieldValue`

**Types:**
- Component props use untyped `props` parameter pattern in most cases (no TypeScript props interface enforced)
- React type utilities used explicitly: `React.FormEvent<HTMLFormElement>`, `React.InputHTMLAttributes<HTMLInputElement>`, `ComponentType`
- Untyped objects are common: `record: Record<string, any>`, `styles: any`, `props: any`

## Code Style

**Formatting:**
- Prettier configured with 160 character line width (very long lines allowed)
- Single quotes for JavaScript: `'react'`, `'classnames'`
- 4 spaces for tab width in JavaScript/TypeScript
- 2 spaces for YAML and Markdown files
- Trailing commas disabled (`trailingComma: "none"`)

**Linting:**
- No ESLint config detected
- Prettier is the only code formatter enforced

**Import Statements:**
- Uses CommonJS and ES6 mixed approach (older components may use CommonJS)
- Wildcard imports common for React: `import * as React from 'react'`
- Named imports for utilities: `import { mapStylesToClassNames } from '../../../utils/map-styles-to-class-names'`
- Default exports for components and utilities

## Import Organization

**Order:**
1. React imports: `import * as React from 'react'`
2. External libraries: `import classNames from 'classnames'`
3. Relative utility/style imports: `import { mapStylesToClassNames as mapStyles } from '../../../utils/map-styles-to-class-names'`
4. Component imports: `import Link from '../Link'`
5. SVG/asset imports: `import ChevronDownIcon from '../../svgs/chevron-down'`

**Path Aliases:**
- No path aliases configured in `tsconfig.json` (baseUrl is set to "." but no paths mapping)
- Relative imports use `../` extensively throughout codebase

## Error Handling

**Patterns:**
- Errors thrown with descriptive messages: `throw new Error('page has no type, page...')`
- Console error logging for runtime issues: `console.error('HubSpot configuration missing...')`
- Try-catch blocks used in async functions:
  ```typescript
  try {
      const hubspotResponse = await submitToHubSpot(data, ...);
      if (hubspotResponse.ok) {
          setSubmitStatus('success');
      } else {
          setSubmitStatus('error');
      }
  } catch (error) {
      console.error('Form submission error:', error);
      setSubmitStatus('error');
  }
  ```
- Status enums for form states: `'idle' | 'success' | 'error'`
- Debug context objects for tracing: `debugContext = { keyPath: [], stack: [] }`

## Logging

**Framework:** Native `console` object

**Patterns:**
- `console.error()` for error conditions: `src/components/blocks/FormBlock/index.tsx` line 80, 91, 95
- `console.warn()` for warnings: `src/utils/map-styles-to-class-names.ts` lines 114, 140
- `console.log()` for informational output in build/indexing scripts: `src/utils/indexer/index.js`
- Minimal logging - only used for actual errors and warnings, not debug info

## Comments

**When to Comment:**
- Comments provided for non-obvious logic and configuration sections
- JSDoc-style comments used for exported utility functions
- Inline comments for complex conditions and field mappings

**JSDoc/TSDoc:**
- Full JSDoc blocks on exported functions: `src/components/components-registry.ts` lines 4-31 show detailed comments about component registry patterns
- Markdown-formatted documentation in comments explaining Next.js dynamic imports and component mapping
- Limited use in regular components (most lack comments)

**Examples:**
```typescript
/**
 * The getComponent() function loads a component using dynamic import.
 * Dynamic imports are useful when you wish to load a module conditionally...
 */
export function getComponent(key: string): ComponentType { ... }

// Helper function to submit form data to HubSpot
async function submitToHubSpot(formData: FormData, portalId: string, formGuid: string) { ... }

// Map form fields to HubSpot field names
const fields = [ ... ];

// HubSpot free plan uses Deals in the default Sales Pipeline
```

## Function Design

**Size:** Functions tend to be medium-to-large (30-100+ lines for complex components like Header variants)

**Parameters:**
- Props pattern: Functions accept destructured or whole props object
- Optional destructuring with defaults: `const { elementId, className, label, altText, url, showIcon, icon, iconPosition = 'right', style = 'primary' } = props`
- Rest parameters: `function Link({ children, href, ...other })` to spread remaining props

**Return Values:**
- Components return JSX.Element
- Utilities return mapped/transformed data or React components
- Handlers use void or implicit returns
- Fallback returns for conditional logic: `if (internal) return <NextLink>` else `return <a>`

## Module Design

**Exports:**
- Default exports for components: `export default function Action(props) { ... }`
- Named exports for utilities: `export function mapStylesToClassNames(styles) { ... }`
- Component registries use named exports: `export const iconMap = { ... }`

**Barrel Files:**
- Used in atoms and layouts directories: `src/components/atoms/index.ts`, `src/components/layouts/index.ts`
- Re-export multiple components: `export { default as Action } from './Action'`

**File Structure:**
- Single component per file + index.tsx wrapper pattern
- Utility files contain single or closely-related utility functions
- Mapping/configuration objects in their own files (e.g., `map-styles-to-class-names.ts`)

## Tailwind & Styling

**CSS Framework:** Tailwind CSS

**Pattern:**
- All styling via Tailwind utility classes passed to `classNames()` helper
- `mapStylesToClassNames()` converts design system style values to Tailwind classes
- Conditional Tailwind classes using object notation: `{ 'order-first': iconPosition === 'left' }`
- Responsive prefixes used: `hidden`, `lg:flex`, `sm:w-formField`

**Utility Mapping:**
- Central mapping file `src/utils/map-styles-to-class-names.ts` handles style property to class conversion
- Supports margins, padding, borders, fonts, flexbox, backgrounds
- Custom spacing calculation: `styleValue === 1 ? 'px' : String(Number(styleValue) / 4)`

## Data Attributes

**Stackbit CMS Integration:**
- `data-sb-field-path` attributes on components for CMS annotations
- Pattern: `data-sb-field-path={fieldPath}` for component tracking
- Nested field paths: `.label`, `.icon`, `.fields` for child elements
- Format: `[fieldPath, ...subpaths].join(' ')` for multiple paths on single element

---

*Convention analysis: 2026-02-12*
