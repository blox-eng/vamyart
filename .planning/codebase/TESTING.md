# Testing Patterns

**Analysis Date:** 2026-02-12

## Test Framework

**Runner:**
- Not detected - No test runner configured

**Assertion Library:**
- Not detected

**Run Commands:**
- No test scripts in package.json
- Test infrastructure not set up

## Test File Organization

**Location:**
- Not applicable - No test files present

**Naming:**
- Not applicable - No test files found

**Structure:**
- Not applicable - No test files found

## Test Structure

**Suite Organization:**
- Not applicable - No tests implemented

**Patterns:**
- Not applicable - No testing patterns established

## Mocking

**Framework:**
- Not detected

**Patterns:**
- Not applicable

**What to Mock:**
- Not applicable

**What NOT to Mock:**
- Not applicable

## Fixtures and Factories

**Test Data:**
- Not applicable - No test fixtures implemented

**Location:**
- Not applicable

## Coverage

**Requirements:**
- No coverage requirements enforced
- No coverage reporting configured

**View Coverage:**
- Not applicable

## Test Types

**Unit Tests:**
- Not implemented

**Integration Tests:**
- Not implemented

**E2E Tests:**
- Not applicable

## Manual Testing Patterns Observed

While no automated tests exist, the codebase demonstrates testable patterns:

**Component Props Validation:**
- Components throw errors when required metadata is missing:
  ```typescript
  // src/components/blocks/FormBlock/index.tsx
  const modelName = field.__metadata.modelName;
  if (!modelName) {
      throw new Error(`form field does not have the 'modelName' property`);
  }
  ```

**Component Registry Validation:**
- Components validated against registry before rendering:
  ```typescript
  // src/pages/[[...slug]].js
  const PageLayout = getComponent(modelName);
  if (!PageLayout) {
      throw new Error(`no page layout matching the page model: ${modelName}`);
  }
  ```

**Form State Testing:**
- Form submission includes try-catch and status states for testing outcomes:
  ```typescript
  // src/components/blocks/FormBlock/index.tsx
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitStatus, setSubmitStatus] = React.useState<'idle' | 'success' | 'error'>('idle');

  try {
      const hubspotResponse = await submitToHubSpot(data, HUBSPOT_PORTAL_ID, HUBSPOT_FORM_GUID);
      if (hubspotResponse.ok) {
          setSubmitStatus('success');
          formRef.current?.reset();
      } else {
          console.error('HubSpot submission failed:', await hubspotResponse.text());
          setSubmitStatus('error');
      }
  } catch (error) {
      console.error('Form submission error:', error);
      setSubmitStatus('error');
  }
  ```

**Utility Function Testing:**
- Utility functions have clear inputs/outputs suitable for unit testing:
  ```typescript
  // src/utils/map-styles-to-class-names.ts
  export function mapStylesToClassNames(styles: Record<string, any>) {
      return Object.entries(styles)
          .map(([prop, value]) => {
              if (prop in TAILWIND_MAP) {
                  if (typeof TAILWIND_MAP[prop] === 'function') {
                      return TAILWIND_MAP[prop](value);
                  } else if (value in TAILWIND_MAP[prop]) {
                      return TAILWIND_MAP[prop][value];
                  }
              }
          })
          .join(' ');
  }
  ```

**Error Boundary Candidates:**
- Component registry system (`src/components/components-registry.ts`) uses dynamic imports suitable for error boundaries
- Form submission includes all error cases with user-facing feedback

## Known Testing Gaps

**Areas Lacking Test Coverage:**
1. **Component Rendering** (`src/components/**/*.tsx`)
   - No tests for component output or props handling
   - SVG component rendering untested
   - Form controls (TextFormControl, EmailFormControl, etc.) have no validation tests

2. **Utility Functions** (`src/utils/**/*.ts`, `src/utils/**/*.js`)
   - `mapStylesToClassNames()` with various input types untested
   - `getDataAttrs()` filter logic untested
   - `resolveReferences()` recursive resolution logic untested
   - `getAllPostsSorted()`, `sortPosts()`, `isPublished()` lack coverage

3. **Content Processing** (`src/utils/local-content.ts`)
   - File reading and parsing (markdown vs JSON) untested
   - Front matter parsing untested
   - Reference resolution edge cases uncovered
   - Model validation logic uncovered

4. **Static Generation** (`src/pages/[[...slug]].js`)
   - `getStaticProps()` and `getStaticPaths()` untested
   - SEO title/meta tag generation untested
   - Data loading and page layout resolution untested

5. **API Routes** (`src/pages/api/reindex.js`)
   - Reindexing logic completely untested
   - HubSpot integration logic untested (only console errors logged)

6. **External Integrations**
   - HubSpot form submission (`submitToHubSpot()`) has no tests
   - Form field mapping untested
   - Network error handling untested
   - Response parsing untested

## Recommended Testing Setup

**To implement testing, add:**
1. Test runner: Jest or Vitest
2. React Testing Library for component tests
3. MSW (Mock Service Worker) for API mocking
4. Test configuration files in root
5. Test directories: `__tests__` or `.test.ts` colocation
6. Initial coverage targets for critical paths: form submission, content loading, component rendering

---

*Testing analysis: 2026-02-12*
