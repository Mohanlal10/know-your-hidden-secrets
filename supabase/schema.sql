-- Know Your Hidden Secrets and Future
-- Run this entire file in the Supabase SQL Editor.
-- Then create your first admin user in Supabase Authentication and insert/update
-- their profile row with role='admin'.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  role text not null default 'customer' check (role in ('admin','customer')),
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  service text not null,
  appointment_date date not null,
  appointment_time time not null,
  status text not null default 'pending' check (status in ('pending','confirmed','completed','cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.readings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  service text not null,
  title text not null,
  status text not null default 'pending' check (status in ('pending','in_progress','completed','cancelled')),
  reading_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  channel text not null check (channel in ('email','sms','whatsapp','portal')),
  subject text,
  message text not null,
  status text not null default 'queued' check (status in ('queued','sent','failed','read')),
  created_at timestamptz not null default now()
);

create index if not exists appointments_customer_idx on public.appointments(customer_id);
create index if not exists readings_customer_idx on public.readings(customer_id);
create index if not exists messages_customer_idx on public.messages(customer_id);
create index if not exists messages_created_idx on public.messages(created_at desc);

-- Automatically create a customer profile after signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Customer'),
    new.email,
    new.phone
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.appointments enable row level security;
alter table public.readings enable row level security;
alter table public.messages enable row level security;

drop policy if exists "profiles own or admin read" on public.profiles;
create policy "profiles own or admin read" on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles
for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "admin manage profiles" on public.profiles;
create policy "admin manage profiles" on public.profiles
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "customer or admin appointments" on public.appointments;
create policy "customer or admin appointments" on public.appointments
for all to authenticated
using (customer_id = auth.uid() or public.is_admin())
with check (customer_id = auth.uid() or public.is_admin());

drop policy if exists "customer or admin readings" on public.readings;
create policy "customer or admin readings" on public.readings
for all to authenticated
using (customer_id = auth.uid() or public.is_admin())
with check (customer_id = auth.uid() or public.is_admin());

drop policy if exists "customer or admin messages" on public.messages;
create policy "customer or admin messages" on public.messages
for all to authenticated
using (customer_id = auth.uid() or public.is_admin())
with check (customer_id = auth.uid() or public.is_admin());

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.appointments to authenticated;
grant select, insert, update, delete on public.readings to authenticated;
grant select, insert, update, delete on public.messages to authenticated;

-- IMPORTANT: never expose a Supabase secret/service_role key in browser code.
