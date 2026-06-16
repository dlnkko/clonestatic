-- Team members: invited emails share the owner's subscription credit pool.

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  member_email text not null,
  created_at timestamptz not null default now(),
  constraint team_members_member_email_unique unique (member_email),
  constraint team_members_owner_member_unique unique (owner_email, member_email),
  constraint team_members_emails_distinct check (owner_email <> member_email)
);

create index if not exists team_members_owner_email_idx on public.team_members (owner_email);

alter table public.team_members enable row level security;

comment on table public.team_members is
  'Maps member emails to subscription owner; members use owner credits when signed in.';
