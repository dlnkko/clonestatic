-- Add uses_remaining to free_trial_ips to support multi-use free trials.
-- We default new rows to 2 uses, but set existing rows to 0 so past IPs
-- that already consumed the old 1-use trial do NOT get extra free uses.

alter table public.free_trial_ips
  add column if not exists uses_remaining int not null default 2 check (uses_remaining >= 0);

-- Existing entries represented "free trial already used" in the previous version,
-- so we set uses_remaining to 0 for them.
update public.free_trial_ips
set uses_remaining = 0
where uses_remaining is distinct from 0;

comment on column public.free_trial_ips.uses_remaining is
  'Number of free-trial generations remaining for this IP.';

