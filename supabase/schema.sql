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


-- Service catalog and customer reading requests
create table if not exists public.service_catalog (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  enabled boolean not null default true,
  pricing_mode text not null default 'free' check (pricing_mode in ('free','paid')),
  price numeric(10,2) not null default 0 check (price >= 0),
  ai_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid references public.service_catalog(id) on delete set null,
  service_name text not null,
  question text not null,
  birth_date date,
  birth_time time,
  birth_place text,
  pricing_mode text not null default 'free' check (pricing_mode in ('free','paid')),
  price numeric(10,2) not null default 0,
  payment_status text not null default 'not_required' check (payment_status in ('not_required','pending','paid','failed','refunded')),
  status text not null default 'queued' check (status in ('queued','awaiting_payment','in_progress','completed','cancelled')),
  ai_answer text,
  admin_answer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.service_catalog (name,description,ai_instructions) values
('Birth Chart Analysis','Explore planetary influences and important life themes.','Give a careful birth-chart-oriented interpretation based only on the information supplied. Clearly distinguish reflective astrology from factual certainty.'),
('Love & Marriage','Reflect on relationships, compatibility and emotional patterns.','Provide a thoughtful relationship-focused astrology interpretation based on supplied details. Avoid claiming certainty about another person’s private thoughts or future actions.'),
('Career Astrology','Gain perspective on work, direction and opportunities.','Provide a reflective career astrology interpretation based on supplied details. Avoid guarantees about employment, income or specific future events.'),
('Life Guidance','Discover reflective insights for important decisions.','Provide reflective guidance using the supplied context and astrology framing. Encourage informed personal decisions rather than presenting predictions as certainties.'),
('Numerology','Explore the symbolic meaning of numbers in your life.','Provide a numerology interpretation from the supplied information and clearly frame it as symbolic guidance.'),
('Vastu Consultation','Guidance on spaces, balance and traditional Vastu principles.','Provide traditional Vastu-oriented guidance from the supplied information. Avoid claims that it guarantees health, wealth or other outcomes.')
on conflict (name) do nothing;
alter table public.service_catalog enable row level security;
alter table public.service_requests enable row level security;
create policy if not exists "public enabled services read" on public.service_catalog for select to anon, authenticated using (enabled=true or public.is_admin());
create policy if not exists "admin manage services" on public.service_catalog for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy if not exists "customer own service requests" on public.service_requests for select to authenticated using (customer_id=auth.uid() or public.is_admin());
create policy if not exists "customer create service requests" on public.service_requests for insert to authenticated with check (customer_id=auth.uid());
create policy if not exists "admin manage service requests" on public.service_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.service_catalog to anon, authenticated;
grant select,insert on public.service_requests to authenticated;
