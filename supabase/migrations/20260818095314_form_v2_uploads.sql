create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  form_id bigint not null references public.forms(id) on delete cascade,
  form_version_id bigint references public.form_versions(id) on delete restrict,
  field_name text not null check (length(trim(field_name)) between 1 and 120),
  object_path text not null unique check (length(trim(object_path)) between 1 and 500),
  original_name text not null check (length(trim(original_name)) between 1 and 255),
  content_type text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  owner_key_hash text not null check (length(trim(owner_key_hash)) = 64),
  status text not null default 'pending' check (status in ('pending', 'ready', 'attached', 'expired', 'rejected')),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  completed_at timestamptz,
  attached_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.submission_uploads (
  submission_id bigint not null references public.submissions(id) on delete cascade,
  upload_id uuid not null references public.uploads(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (submission_id, upload_id)
);

create index if not exists uploads_form_id_idx on public.uploads(form_id);
create index if not exists uploads_owner_key_hash_idx on public.uploads(owner_key_hash);
create index if not exists uploads_status_expires_at_idx on public.uploads(status, expires_at);
create index if not exists submission_uploads_upload_id_idx on public.submission_uploads(upload_id);

alter table public.uploads enable row level security;
alter table public.submission_uploads enable row level security;

revoke all on table public.uploads, public.submission_uploads from anon, authenticated;
grant select, insert, update, delete on table public.uploads, public.submission_uploads to service_role;
