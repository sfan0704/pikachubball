-- Disconnecting Yahoo removes the user's stored tokens and leagues in one
-- transaction. Deleting the account removes the Supabase user, and the
-- cascading foreign keys remove every row they own. Both act only on the
-- signed-in user; the server never needs the admin key for either.

create or replace function public.disconnect_yahoo()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  delete from public.yahoo_connections where owner_id = auth.uid();
  delete from public.fantasy_memberships where owner_id = auth.uid();
  delete from public.user_leagues where owner_id = auth.uid();
end;
$$;

-- Runs with the owner's rights because ordinary users cannot touch auth.users,
-- but only ever for the caller's own id.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.disconnect_yahoo() from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.disconnect_yahoo() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
