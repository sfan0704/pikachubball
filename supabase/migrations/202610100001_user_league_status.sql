-- A league's status: preseason (not drafted or not started), active or
-- finished. is_finished stays, kept consistent with status, until no running
-- code reads it; the running app sends only is_finished, newer code sends
-- status, and replace_user_leagues accepts either.

alter table public.user_leagues add column if not exists status text;

update public.user_leagues
set status = case when is_finished then 'finished' else 'active' end
where status is null;

alter table public.user_leagues
  alter column status set not null,
  add constraint user_leagues_status_known
    check (status in ('preseason', 'active', 'finished')),
  add constraint user_leagues_status_matches_finished
    check ((status = 'finished') = is_finished);

create or replace function public.replace_user_leagues(p_leagues jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null or jsonb_typeof(p_leagues) <> 'array' then
    raise exception 'invalid league replacement' using errcode = '42501';
  end if;

  delete from public.user_leagues where owner_id = auth.uid();
  insert into public.user_leagues (owner_id, league_key, team_key, season, name, status, is_finished)
  select
    auth.uid(),
    item->>'league_key',
    item->>'team_key',
    (item->>'season')::integer,
    item->>'name',
    league.status,
    league.status = 'finished'
  from jsonb_array_elements(p_leagues) item
  cross join lateral (
    select coalesce(
      item->>'status',
      case when coalesce((item->>'is_finished')::boolean, false) then 'finished' else 'active' end
    ) as status
  ) league;
end;
$$;

revoke all on function public.replace_user_leagues(jsonb) from public, anon;
grant execute on function public.replace_user_leagues(jsonb) to authenticated;
