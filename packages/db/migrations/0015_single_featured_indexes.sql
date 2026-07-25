-- DB-level single-featured invariant for collections and artworks.
-- Application setFeatured() clears other rows then sets the target inside one
-- transaction; this partial unique index makes the invariant impossible to
-- violate under concurrent writers. Raw + un-journaled like 0001/0014 — Drizzle
-- does not model partial indexes in this schema, so it is NOT in schema.ts.

CREATE UNIQUE INDEX IF NOT EXISTS collections_single_featured
  ON collections (featured) WHERE featured = true;

CREATE UNIQUE INDEX IF NOT EXISTS artworks_single_featured
  ON artworks (featured) WHERE featured = true;
