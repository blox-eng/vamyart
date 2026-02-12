# Codebase Concerns

**Analysis Date:** 2026-02-12

## Tech Debt

**Missing TypeScript Strict Mode:**
- Issue: TypeScript compiler has `"strict": false` in `tsconfig.json`, disabling type safety features like strict null checks, strict function types, and strict bind/call/apply checks
- Files: `tsconfig.json`
- Impact: Type errors pass silently at compile time, increasing risk of runtime errors. Refactoring becomes more dangerous as type changes aren't caught. Makes codebase harder to maintain as it grows.
- Fix approach: Enable `"strict": true` incrementally, fixing type errors by adding proper types and null checks throughout the codebase. Start with high-risk areas like form submission and external API calls.

**Extensive Use of `any` Types:**
- Issue: Multiple files use `any` type annotations instead of proper TypeScript types
- Files:
  - `src/components/blocks/VideoBlock/index.tsx` (lines 74, 95, 132)
  - `src/components/layouts/PostFeedLayout/index.tsx`
  - `src/components/sections/GenericSection/index.tsx`
  - `src/utils/get-data-attrs.ts`
  - `src/utils/local-content.ts`
- Impact: Loses all TypeScript type safety benefits. Makes refactoring risky and creates silent bugs. Props typing is completely bypassed.
- Fix approach: Create proper TypeScript interfaces for all component props and utilities. Use unions and generics instead of `any`.

**Untyped Content References System:**
- Issue: `src/utils/local-content.ts` has a comment "TODO use types?" indicating the content resolution system lacks proper type definitions
- Files: `src/utils/local-content.ts` (line 9)
- Impact: The core content loading system works with untyped data, making it fragile. Content references can break silently if file names or model names change.
- Fix approach: Create proper TypeScript types for `Content`, `Page`, `DataItem` objects. Add type guards for reference resolution. Create a validation schema for content files.

**Tailwind Class Generation Without Validation:**
- Issue: `src/utils/map-styles-to-class-names.ts` generates Tailwind classes dynamically without validating against available classes
- Files: `src/utils/map-styles-to-class-names.ts` (line 168)
- Impact: Invalid Tailwind class names are silently generated when mappings are incomplete. This can cause styling to silently fail without any console warning. The fallback on line 168 returns unmapped values as-is, which creates arbitrary strings as class names.
- Fix approach: Create a strict mapping validation function that throws on unmapped values during development. Log warnings for unmapped CSS values that make it to production.

## Known Bugs

**React createRef in FormBlock Component:**
- Symptoms: Form pre-filling from URL parameters may not work reliably because `createRef()` creates a new ref on every render
- Files: `src/components/blocks/FormBlock/index.tsx` (line 46)
- Trigger: Submitting form multiple times or fast page navigation after form initial load
- Workaround: Function currently works because refs are accessed immediately in useEffect, but this is fragile and violates React best practices
- Fix approach: Replace `React.createRef()` with `React.useRef()` for proper ref persistence across renders

**Router Events Dependency Array Issue:**
- Symptoms: Route change cleanup may fail intermittently, leaving document.body.style.overflow not reset
- Files: `src/components/sections/Header/index.tsx` (lines 201-211, 270-280)
- Trigger: Rapid page navigation while mobile menu is open, or navigating away with menu open
- Workaround: Menu closes on next route change attempt
- Fix approach: Include `router` directly in dependency array instead of `router.events`, or create stable callback wrapper using useCallback

## Security Considerations

**Missing Environment Variable Validation:**
- Risk: HubSpot credentials are checked at runtime but no validation that they exist before form submission. Missing credentials result in form errors shown to users without clear messaging.
- Files: `src/components/blocks/FormBlock/index.tsx` (lines 79-82)
- Current mitigation: Form submission fails and shows generic error message to user
- Recommendations:
  - Validate environment variables at build time or app initialization
  - Show clear error messaging that credits are misconfigured (for development only)
  - Prevent form display entirely if credentials are missing in production

**Cross-Site Data from URL Parameters:**
- Risk: Form pre-filling uses `URLSearchParams(window.location.search)` without sanitization. If malicious `piece` parameter is injected, it directly populates form input value
- Files: `src/components/blocks/FormBlock/index.tsx` (lines 54-60)
- Current mitigation: Input is decoded but not validated. HTML escaping from React prevents XSS in this case.
- Recommendations: Validate piece parameter against known piece IDs. Whitelist allowed characters or implement a validation function before setting input value.

**Unvalidated JSON Parsing:**
- Risk: `src/utils/local-content.ts` calls `JSON.parse()` without try-catch, so malformed JSON in content files causes build-time crash
- Files: `src/utils/local-content.ts` (line 45)
- Current mitigation: Crashes at build time, preventing deployment of invalid content
- Recommendations: Wrap in try-catch with descriptive error message showing which file failed. Add schema validation for content structure using zod or similar.

**Next.js Dev Origins Hardcoded IP:**
- Risk: `next.config.js` includes hardcoded dev IP address (192.168.1.84) in allowedDevOrigins
- Files: `next.config.js` (lines 10-12)
- Current mitigation: This is dev-only configuration that doesn't affect production builds
- Recommendations: Move dev IPs to environment variables. Remove before shipping or document why it's needed.

## Performance Bottlenecks

**Recursive Reference Resolution in Content Loading:**
- Problem: `src/utils/local-content.ts` uses recursive traversal of all content objects to resolve references. This runs at build time for every page.
- Files: `src/utils/local-content.ts` (function `resolveReferences`, lines 60-91)
- Cause: No index of reference fields, so every field of every content object is checked. Nested objects are traversed deeply.
- Improvement path: Build an index of reference fields at startup. Only traverse fields known to contain references. Consider memoizing resolved references.

**No Pagination/Lazy Loading in Post Feed:**
- Problem: All posts are loaded and rendered at once, which will cause performance issues as gallery grows
- Files: `src/components/sections/PostFeedSection/index.tsx`, `src/components/layouts/PostFeedLayout/index.tsx`
- Cause: Posts are passed as props and directly mapped to components without pagination
- Improvement path: Implement pagination or infinite scroll. Add `pageSize` configuration. Use React lazy loading for post feed items.

**Header with Multiple Menu Variants:**
- Problem: Header component renders all five variants in the switch statement but only shows one. Each variant instance has its own state.
- Files: `src/components/sections/Header/index.tsx` (multiple state instances across variants)
- Cause: Variant logic doesn't reduce re-renders when props change
- Improvement path: Memoize variant components. Extract shared state logic. Consider extracting variant logic to separate hook.

## Fragile Areas

**Component Registry Pattern Without Validation:**
- Files: `src/components/components-registry.ts`, used throughout component tree
- Why fragile: Components are registered by string model name. If a model name changes in content, the component lookup fails with cryptic "no component matching" error thrown at render time.
- Safe modification: Add warning logs when getComponent returns undefined. Create a dev mode that validates all referenced model names exist at startup. Add fallback UI for missing components.
- Test coverage: No test files exist for component registry or component lookup. Missing components won't be caught until runtime in production.

**FormBlock Tight Coupling to HubSpot:**
- Files: `src/components/blocks/FormBlock/index.tsx` (lines 8-42)
- Why fragile: Form submission logic is tightly coupled to HubSpot API. Field mapping is hardcoded. Any change to HubSpot field names or form fields breaks submission silently.
- Safe modification: Extract HubSpot submission into separate service file. Create field mapping configuration. Add validation that mapped fields match form fields.
- Test coverage: No tests exist for form submission or HubSpot integration. The 404 fix in recent commits (9b5147f) suggests form submission had errors before.

**Markdown to JSX in GenericSection:**
- Files: `src/components/sections/GenericSection/index.tsx` (line 67)
- Why fragile: Uses `markdown-to-jsx` library to render untrusted content from data files. Library configuration is minimal (`forceBlock` and `forceWrapper` options only).
- Safe modification: Add allowlist of permitted HTML tags and components. Sanitize markdown input before passing to library. Test with various markdown edge cases.
- Test coverage: No tests for markdown rendering. Markdown injection vulnerabilities not checked.

**Video URL Parsing Regex Pattern:**
- Files: `src/components/blocks/VideoBlock/index.tsx` (lines 137-164)
- Why fragile: Uses regex patterns to detect video service type and extract video IDs. Patterns don't validate extracted IDs are valid. Falls back to custom video type for .mp4 files but loses file extension validation.
- Safe modification: Add validation that extracted IDs match expected format (YouTube: 11 alphanumeric, Vimeo: numeric). Create whitelist of allowed video domains. Add error boundary for malformed URLs.
- Test coverage: No tests for video URL parsing or component rendering with invalid URLs.

**Static DevOrigins Configuration:**
- Files: `next.config.js` (lines 10-12)
- Why fragile: Hardcoded IP address blocks development on different machines or in CI/CD environments
- Safe modification: Use environment variables for dev origins. Document expected development setup.

## Scaling Limits

**Single-file Content Index:**
- Current capacity: Works well for galleries under ~100 pieces, but recursive reference resolution will slow as content grows
- Limit: When gallery reaches 500+ pieces, build time will noticeably increase due to O(n²) reference resolution
- Scaling path: Implement incremental builds using git changed files. Pre-build reference index. Consider moving to a proper CMS backend for large galleries.

**No Caching Layer for Content:**
- Current capacity: Content files are read from disk on every build. No caching between builds.
- Limit: Large galleries with 100+ high-res images will cause slow builds even though content hasn't changed
- Scaling path: Add caching layer. Implement incremental builds. Use CDN for image assets.

## Dependencies at Risk

**Deprecated Router.events API:**
- Risk: Code uses `router.events` which is deprecated in Next.js 13+. Current version is 15.3.8.
- Files: `src/components/sections/Header/index.tsx` (lines 206, 276)
- Impact: Will break when Next.js removes this API (likely in v16+). Functionality for route-based menu closing will fail.
- Migration plan: Switch to Next.js App Router and use `useRouter()` from `next/navigation` instead of pages router. Or use `useEffect` with path detection via `router.pathname` watching.

**Markdown-to-JSX HTML Injection Risk:**
- Risk: Library `markdown-to-jsx` is used without input sanitization. User-provided markdown could inject malicious HTML
- Files: `src/components/sections/GenericSection/index.tsx`
- Impact: If content comes from untrusted source, XSS attacks possible
- Migration plan: Add HTML sanitization library (DOMPurify) before passing markdown to component. Or switch to react-markdown with stricter plugin configuration.

**Swiper Carousel Version 11:**
- Risk: Swiper is on v11.1.4. Major version jumps can bring breaking changes to CSS and API
- Files: CarouselSection uses swiper but dependency version is floating `^11.1.4`
- Impact: Minor version updates could break carousel styling or functionality
- Migration plan: Pin exact version `"swiper": "11.1.4"`. Monitor for critical fixes and test upgrades thoroughly.

## Missing Critical Features

**No Form Validation:**
- Problem: FormBlock has no client-side validation. Users can submit empty fields, invalid emails, etc.
- Blocks: Can't ensure data quality before sending to HubSpot. User experience is poor when HubSpot returns validation errors.
- Fix: Add validation schema (using zod or similar). Validate on change. Show field errors before submission.

**No Loading/Success State Persistence:**
- Problem: Form success/error state resets on page navigation or refresh, so users don't see confirmation
- Blocks: Can't provide feedback after successful submission
- Fix: Persist submission state using localStorage or URL query params. Show success page or toast notification.

**No Error Boundary Component:**
- Problem: Missing React Error Boundary. If any component crashes, entire page breaks
- Blocks: Production errors can take down entire site
- Fix: Implement Error Boundary at page and section levels. Log errors to monitoring service. Show fallback UI.

## Test Coverage Gaps

**No Test Files in Entire Codebase:**
- What's not tested: All components, utilities, and hooks lack test coverage
- Files: No `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx` files found in src/
- Risk: Refactoring without tests is high risk. Regressions can't be caught before deployment. Component changes may break other components silently.
- Priority: **High** - Add unit tests for utilities and core components first (local-content.ts, map-styles-to-class-names.ts, FormBlock). Add integration tests for page renders. Consider adding E2E tests for form submission flow.

**No Snapshot Tests for Components:**
- What's not tested: Component output is not validated against baselines
- Risk: CSS or rendering changes could break layout without detection
- Priority: **Medium** - Add snapshot tests for Section and Layout components after unit tests established.

**No Integration Tests for Content Loading:**
- What's not tested: `allContent()` function with realistic content files
- Risk: Content structure changes could break build process
- Priority: **High** - Test content loading with sample gallery pieces, posts, data files.

**No Visual Regression Tests:**
- What's not tested: Responsive design, CSS classes, styling changes
- Risk: Tailwind class changes may break styling silently
- Priority: **Medium** - Consider visual regression testing using Percy or similar.

---

*Concerns audit: 2026-02-12*
