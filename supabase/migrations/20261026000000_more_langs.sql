-- Portuguese, Italian and German join French and Spanish.
alter table public.user_stats drop constraint user_stats_lang_check;
alter table public.user_stats
  add constraint user_stats_lang_check check (lang in ('fr', 'es', 'pt', 'it', 'de'));
