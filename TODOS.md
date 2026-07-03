## Image performance (from 2026-07-03 CDN cache work — GH vamyart#21)

- [ ] Pre-warm Netlify Image CDN transforms after upload/publish so the first
      visitor after a change never eats the one-time ~2s cold transform.
      Deferred: low traffic, infrequent uploads. Needs an admin->website warming path.
- [ ] Resize source images to a web-master (~2560px, <1 MB) at upload. Biggest
      remaining cold-transform + Netlify-transform-cost reduction. Deferred:
      web-master-only is acceptable, full-res originals not required.
