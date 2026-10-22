-- Expressions (phrasal verbs like "pick it up", fixed phrases like "of course"): lemmas
-- with pos 'PHRASE', translated like any word. Each token of an occurrence points to the
-- expression and to the position of its first token, which tells occurrences apart.
alter table public.tokens
  add column phrase_lemma_id bigint references public.lemmas (id) on delete set null,
  add column phrase_start integer;

create index tokens_phrase_lemma_idx on public.tokens (phrase_lemma_id);
