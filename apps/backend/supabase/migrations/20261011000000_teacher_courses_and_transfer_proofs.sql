alter table public.courses
  add column starts_at timestamptz,
  add column ends_at timestamptz,
  add column approval_status text not null default 'approved'
    check (approval_status in ('pending', 'approved', 'rejected')),
  add column approval_note text;

create function public.is_school_admin()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select coalesce(public.my_role() = 'admin' and exists (
    select 1 from auth.users where id = auth.uid() and lower(email) = 'admin01@seatsure.test'
  ), false);
$$;

create policy "teachers submit courses for review" on public.courses
  for insert to authenticated with check (
    public.my_role() = 'teacher' and teacher_id = auth.uid()
    and approval_status = 'pending' and cancelled_at is null
  );
drop policy if exists "admin adds courses" on public.courses;

create function public.guard_booking_approved_course()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists(select 1 from public.courses where id=new.course_id and approval_status='approved' and cancelled_at is null) then
    raise exception 'course_not_approved';
  end if;
  return new;
end; $$;
create trigger bookings_require_approved_course before insert on public.bookings
  for each row execute function public.guard_booking_approved_course();

create function public.guard_course_approval()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.approval_status is distinct from old.approval_status and not public.is_school_admin() then
    raise exception 'admin01_required';
  end if;
  return new;
end; $$;
create trigger courses_guard_approval before update of approval_status on public.courses
  for each row execute function public.guard_course_approval();
alter table public.courses add constraint courses_valid_schedule
  check (starts_at is null or ends_at is null or ends_at > starts_at);

create table public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  proof_path text not null,
  submitted_at timestamptz not null default now()
);
alter table public.payment_proofs enable row level security;
revoke all on public.payment_proofs from anon, authenticated;
grant select, insert on public.payment_proofs to authenticated;
create policy "parents read own transfer proofs" on public.payment_proofs
  for select to authenticated using (
    exists(select 1 from public.bookings b where b.id=booking_id and b.user_id=auth.uid())
    or public.is_school_admin()
  );
create policy "parents submit own transfer proofs" on public.payment_proofs
  for insert to authenticated with check (
    exists(select 1 from public.bookings b where b.id=booking_id and b.user_id=auth.uid() and b.status='held')
  );

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs','payment-proofs',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "parents upload own payment proof image" on storage.objects for insert to authenticated
  with check (bucket_id='payment-proofs' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "parents read own payment proof image" on storage.objects for select to authenticated
  using (bucket_id='payment-proofs' and (storage.foldername(name))[1]=auth.uid()::text);

create function public.extend_transfer_booking()
returns trigger language plpgsql set search_path = public as $$
begin new.hold_expires_at := now() + interval '7 days'; return new; end; $$;
create trigger bookings_extend_transfer_window before insert on public.bookings
  for each row execute function public.extend_transfer_booking();

create or replace function public.pay_booking(p_booking_id uuid, p_idempotency_key text)
returns public.payments language plpgsql security definer set search_path = public as $$
begin raise exception 'bank_transfer_only'; end; $$;

create or replace view public.course_seats as
select c.id,c.title,c.description,c.teacher_id,t.full_name as teacher_name,c.capacity,c.price,c.registration_open,c.created_at,
  public.seats_taken(c.id) as seats_taken,c.cancelled_at,c.cancellation_reason,c.starts_at,c.ends_at,c.approval_status,c.approval_note
from public.courses c left join public.profiles t on t.id=c.teacher_id
where c.approval_status='approved';

revoke all on function public.is_school_admin() from public, anon;
grant execute on function public.is_school_admin() to authenticated, service_role;
