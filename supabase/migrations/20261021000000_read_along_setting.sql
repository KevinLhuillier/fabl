-- Profile setting: highlight the text while the voice-over plays (read-along).
alter table public.user_stats add column read_along boolean not null default true;
