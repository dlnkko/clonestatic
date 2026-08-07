-- Persist active Kie job so we can recover the image after serverless timeout.
alter table public.creations
  add column if not exists kie_task_id text;

comment on column public.creations.kie_task_id is
  'Active Kie.ai task id while status=generating; used to attach the result after long jobs / serverless cutoffs.';

create index if not exists creations_kie_task_id_idx
  on public.creations (kie_task_id)
  where kie_task_id is not null;
