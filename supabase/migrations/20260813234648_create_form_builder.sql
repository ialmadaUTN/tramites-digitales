create extension if not exists pgcrypto;

create table if not exists public.forms (
  id bigint generated always as identity primary key,
  public_id uuid not null default gen_random_uuid() unique,
  name text not null check (length(trim(name)) between 1 and 120),
  draft_definition jsonb not null default '{}'::jsonb,
  published_version_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.form_versions (
  id bigint generated always as identity primary key,
  form_id bigint not null references public.forms(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  definition jsonb not null,
  created_at timestamptz not null default now(),
  unique (form_id, version_number)
);

alter table public.forms
  add constraint forms_published_version_fk
  foreign key (published_version_id) references public.form_versions(id)
  on delete set null;

create table if not exists public.submissions (
  id bigint generated always as identity primary key,
  public_id uuid not null default gen_random_uuid() unique,
  form_id bigint not null references public.forms(id) on delete restrict,
  form_version_id bigint references public.form_versions(id) on delete restrict,
  idempotency_key text not null check (length(trim(idempotency_key)) between 1 and 200),
  payload jsonb not null,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'delivered', 'failed')),
  delivery_attempts integer not null default 0 check (delivery_attempts >= 0),
  last_delivery_error text,
  external_response jsonb,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (form_id, idempotency_key)
);

create index if not exists form_versions_form_id_idx on public.form_versions(form_id);
create index if not exists submissions_form_id_idx on public.submissions(form_id);
create index if not exists submissions_form_version_id_idx on public.submissions(form_version_id);
create index if not exists submissions_delivery_status_idx on public.submissions(delivery_status);

alter table public.forms enable row level security;
alter table public.form_versions enable row level security;
alter table public.submissions enable row level security;

revoke all on table public.forms, public.form_versions, public.submissions from anon, authenticated;
grant select, insert, update, delete on table public.forms, public.form_versions, public.submissions to service_role;
grant usage, select on all sequences in schema public to service_role;


