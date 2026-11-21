-- Server-authoritative decisions and task completion attestations.
-- Client snapshots may propose changes, but cannot authoritatively approve or complete work.
create table if not exists proposal_decisions (
  user_id text not null,
  proposal_id text not null,
  action text not null check (action in ('approved', 'rejected')),
  payload_hash text not null,
  staff_id text not null,
  to_rank text not null,
  title text not null,
  actor_user_id text not null,
  nonce text not null unique,
  created_at timestamptz not null default now(),
  primary key (user_id, proposal_id)
);

create index if not exists proposal_decisions_actor_idx
  on proposal_decisions (actor_user_id, created_at desc);

create table if not exists task_completion_attestations (
  user_id text not null,
  task_id text not null,
  task_hash text not null,
  result_hash text not null,
  actor_user_id text not null,
  nonce text not null unique,
  created_at timestamptz not null default now(),
  primary key (user_id, task_id, task_hash)
);

create index if not exists task_completion_actor_idx
  on task_completion_attestations (actor_user_id, created_at desc);
