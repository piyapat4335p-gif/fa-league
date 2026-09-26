-- Run ONCE in Supabase SQL Editor.
-- Replace the email before running. This is only for making the first league administrator.
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'PUT_YOUR_SIGNED_IN_EMAIL_HERE');
