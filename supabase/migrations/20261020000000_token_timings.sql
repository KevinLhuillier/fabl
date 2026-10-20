-- Read-along: when each word is spoken in its page's voice-over (milliseconds),
-- from content/alignments/<slug>.json. Null: no alignment (no highlighting).
alter table public.tokens add column start_ms integer, add column end_ms integer;
