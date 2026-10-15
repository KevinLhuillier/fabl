-- Fewest passages left before an ending, computed by the publish script from the
-- story graph. The in-story progress bar uses visited / (visited + steps_to_end),
-- which reaches 100% at any ending whatever branch the reader took.
alter table public.passages
  add column steps_to_end integer check (steps_to_end >= 0);
