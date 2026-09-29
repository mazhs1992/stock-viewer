-- Profiles and invites tables + RLS

create type user_role as enum ('admin', 'member');

-- Invites: invite-only registration
create table invites (
  email       text primary key,
  role        user_role not null default 'member',
  invited_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);

alter table invites enable row level security;

-- Profiles: one per authenticated user
create table profiles (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  email    text not null,
  role     user_role not null default 'member',
  active   boolean not null default true
);

alter table profiles enable row level security;

-- RLS policies: any active user can read
create policy "Active users can read invites"
  on invites for select
  using (
    exists (
      select 1 from profiles
      where profiles.user_id = auth.uid() and profiles.active = true
    )
  );

create policy "Admins can manage invites"
  on invites for all
  using (
    exists (
      select 1 from profiles
      where profiles.user_id = auth.uid() and profiles.role = 'admin' and profiles.active = true
    )
  );

create policy "Active users can read profiles"
  on profiles for select
  using (
    exists (
      select 1 from profiles
      where profiles.user_id = auth.uid() and profiles.active = true
    )
  );

create policy "Admins can manage profiles"
  on profiles for all
  using (
    exists (
      select 1 from profiles
      where profiles.user_id = auth.uid() and profiles.role = 'admin' and profiles.active = true
    )
  );

-- Invite-only enforcement trigger
-- On auth.users insert: check invites, create profile or reject
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _invite record;
begin
  select * into _invite
  from public.invites
  where email = new.email;

  if not found then
    raise exception 'Δεν έχετε πρόσκληση. Επικοινωνήστε με τον διαχειριστή.'
      using errcode = 'P0001';
  end if;

  insert into public.profiles (user_id, email, role, active)
  values (new.id, new.email, _invite.role, true);

  update public.invites
  set accepted_at = now()
  where email = new.email;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
