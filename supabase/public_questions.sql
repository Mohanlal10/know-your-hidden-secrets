-- 10-minute public Ask More question system
create table if not exists public.public_questions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  phone text not null check (char_length(trim(phone)) between 3 and 30),
  email text not null check (char_length(trim(email)) between 3 and 200),
  question text not null check (char_length(trim(question)) between 1 and 5000),
  status text not null default 'new' check (status in ('new','read','replied','closed')),
  session_expires_at timestamptz not null,
  whatsapp_sent boolean not null default false,
  email_sent boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists public_questions_created_at_idx on public.public_questions(created_at desc);
create index if not exists public_questions_status_idx on public.public_questions(status);
alter table public.public_questions enable row level security;
drop policy if exists "No public direct access to questions" on public.public_questions;
create policy "No public direct access to questions" on public.public_questions for all to anon, authenticated using (false) with check (false);
