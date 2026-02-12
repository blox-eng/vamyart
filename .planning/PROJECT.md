# Vamy.art — Artist Portfolio & Business Website

## What This Is

A portfolio website for visual artist Vamy, built on Next.js with a content-driven markdown/JSON architecture. The site showcases art pieces in a gallery, captures purchase inquiries via HubSpot forms, and is deployed on Netlify free tier. Content is managed through Stackbit CMS.

## Core Value

Visitors can discover art pieces and easily express interest in purchasing them — the site converts attention into inquiries.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Gallery with art piece detail pages — existing (4 pieces: First Contact, Balloony, Doughnut Hole, Blue)
- ✓ Homepage with hero and featured content — existing
- ✓ Purchase inquiry form with HubSpot integration — existing
- ✓ Form pre-filling from piece pages (piece interest field) — existing
- ✓ Algolia search across gallery content — existing
- ✓ Responsive, minimalistic design with Tailwind CSS — existing
- ✓ Stackbit CMS for content management — existing
- ✓ Netlify deployment with GitHub Actions CI — existing
- ✓ Terms page — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Add new art pieces to the gallery via Stackbit CMS
- [ ] HubSpot email marketing integration (newsletter signup, new piece announcements)
- [ ] About page / artist statement page
- [ ] Polished content pages (consistent quality across all pages)
- [ ] Reliable end-to-end form → HubSpot pipeline

### Out of Scope

- PostHog analytics — Google Analytics already covers analytics needs
- E-commerce / payment processing — inquiries-first model, no direct sales
- User authentication — public site, no login needed
- Real-time features — static site, no WebSocket/SSE
- Anything requiring Netlify paid tier — must stay within free tier limits

## Context

- **Existing site:** Live at vamy.art, deployed on Netlify, content managed via Stackbit CMS
- **Architecture:** Next.js 15 SSG with markdown/JSON content, model-driven component registry
- **Current gallery:** 4 pieces with individual detail pages and inquiry forms
- **Integrations:** HubSpot (forms), Algolia (search), Google Analytics (analytics)
- **Content workflow:** Artist uses Stackbit CMS visual editor to add/edit content
- **Brownfield:** All infrastructure is in place — this is about expanding content and tightening integrations

## Constraints

- **Hosting:** Netlify free tier — no server-side functions beyond what's available, build time limits
- **Architecture:** Must work within existing Next.js SSG + markdown content model
- **CMS:** Content additions should be doable through Stackbit CMS
- **Complexity:** Minimalistic approach — no over-engineering, keep the site simple and fast

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep static site architecture | Works well, fast, free hosting, no backend needed | — Pending |
| HubSpot for CRM + email marketing | Already integrated for forms, natural extension to email | — Pending |
| Skip PostHog | Google Analytics sufficient for current needs | — Pending |
| Stackbit CMS for content | Already in use, artist is familiar with it | — Pending |

---
*Last updated: 2026-02-12 after initialization*
