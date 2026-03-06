-- Enable RLS on every table.
-- All writes go through tRPC (server-side postgres connection) which bypasses RLS.
-- This blocks anyone who connects directly with the anon key.

ALTER TABLE artworks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE auctions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries              ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
