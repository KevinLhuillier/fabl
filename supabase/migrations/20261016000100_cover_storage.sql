-- Public bucket for story covers, uploaded from the admin app (service role).
-- Public: the app shows covers by URL, no policy needed for reading.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
