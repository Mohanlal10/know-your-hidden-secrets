create table if not exists public.public_conversations (
  id uuid primary key default gen_random_uuid(),
  visitor_name text not null check (char_length(trim(visitor_name)) between 3 and 120),
  phone text not null check (char_length(trim(phone)) between 7 and 30),
  email text not null check (char_length(trim(email)) between 5 and 200),
  status text not null default 'open' check (status in ('open','waiting','replied','closed')),
  session_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.public_conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.public_conversations(id) on delete cascade,
  sender text not null check (sender in ('visitor','admin')),
  message text not null check (char_length(trim(message)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists public_conversations_created_at_idx on public.public_conversations(created_at desc);
create index if not exists public_conversation_messages_conversation_id_idx on public.public_conversation_messages(conversation_id, created_at);
alter table public.public_conversations enable row level security;
alter table public.public_conversation_messages enable row level security;
drop policy if exists "Admins can view public conversations" on public.public_conversations;
create policy "Admins can view public conversations" on public.public_conversations for select to authenticated using (public.is_admin());
drop policy if exists "Admins can update public conversations" on public.public_conversations;
create policy "Admins can update public conversations" on public.public_conversations for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins can view public conversation messages" on public.public_conversation_messages;
create policy "Admins can view public conversation messages" on public.public_conversation_messages for select to authenticated using (public.is_admin());
drop policy if exists "Admins can create public conversation messages" on public.public_conversation_messages;
create policy "Admins can create public conversation messages" on public.public_conversation_messages for insert to authenticated with check (public.is_admin());
