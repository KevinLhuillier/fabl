-- Review exercises built on the story (fill in the blank, listen to the narrator, find the
-- conjugated form) need the occurrence where the user met the word: its page and the
-- position of the tapped token (first token of an expression). Set by the reader when a
-- word is added; null for words added before this migration.
alter table public.user_vocabulary
  add column passage_id uuid references public.passages (id) on delete set null,
  add column token_position integer;

-- One occurrence per word of the user's list among `p_lemma_ids`: the saved one while the
-- page still has the word there, else a page of the word's story containing the saved
-- context sentence, else its first occurrence in the story, else anywhere.
-- `positions` lists the occurrence's tokens (several for an expression: "picked it up").
create function public.vocabulary_occurrences(p_lemma_ids bigint[])
returns table (lemma_id bigint, passage_id uuid, audio_url text, positions integer[])
language sql
stable
set search_path = public
as $$
  with candidates as (
    select
      v.lemma_id,
      v.story_id,
      v.context_sentence,
      v.passage_id as saved_passage,
      v.token_position as saved_position,
      t.passage_id,
      case when t.phrase_lemma_id = v.lemma_id then t.phrase_start else t.position end as start,
      t.position,
      p.audio_url,
      p.page_index,
      c.story_id as page_story,
      c.position as chapter_position
    from user_vocabulary v
    join tokens t on t.lemma_id = v.lemma_id or t.phrase_lemma_id = v.lemma_id
    join passages p on p.id = t.passage_id
    join chapters c on c.id = p.chapter_id
    where v.user_id = auth.uid() and v.lemma_id = any (p_lemma_ids)
  ),
  picked as (
    select distinct on (k.lemma_id) k.lemma_id, k.passage_id, k.audio_url, k.start
    from candidates k
    order by
      k.lemma_id,
      (k.passage_id = k.saved_passage and k.start = k.saved_position) desc nulls last,
      (k.page_story = k.story_id) desc nulls last,
      (
        k.context_sentence is not null
        and strpos(
          (
            select string_agg(t2.text || t2.whitespace, '' order by t2.position)
            from tokens t2
            where t2.passage_id = k.passage_id
          ),
          k.context_sentence
        ) > 0
      ) desc,
      k.chapter_position,
      k.page_index,
      k.position
  )
  select
    pk.lemma_id,
    pk.passage_id,
    pk.audio_url,
    array(
      select t.position
      from tokens t
      where t.passage_id = pk.passage_id
        and (
          (t.phrase_lemma_id = pk.lemma_id and t.phrase_start = pk.start)
          or (t.position = pk.start and t.lemma_id = pk.lemma_id)
        )
      order by t.position
    )
  from picked pk;
$$;

grant execute on function public.vocabulary_occurrences(bigint[]) to authenticated;
