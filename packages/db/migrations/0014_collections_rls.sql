-- Enable RLS on the collections tables (added in 0013).
-- All access goes through tRPC (server-side postgres connection) which bypasses RLS.
-- This blocks anyone who connects directly with the anon key, matching 0001_enable_rls.sql.

ALTER TABLE collections         ENABLE ROW LEVEL SECURITY;
ALTER TABLE artwork_collections ENABLE ROW LEVEL SECURITY;
