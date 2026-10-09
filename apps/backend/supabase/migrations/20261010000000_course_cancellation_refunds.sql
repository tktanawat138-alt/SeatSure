alter table public.courses
  add column cancelled_at timestamptz,
  add column cancellation_reason text;

update public.app_settings
set booking_mode = 'safe', check_to_save_delay_ms = 0
where id = true;

create table public.refund_reports (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments (id) on delete restrict,
  booking_id uuid not null references public.bookings (id) on delete restrict,
  course_id uuid not null references public.courses (id) on delete restrict,
  course_title text not null,
  student_name text not null,
  account_name text not null,
  account_email text not null,
  amount numeric(10, 2) not null check (amount >= 0),
  receipt_no text not null,
  cancellation_reason text not null,
  created_at timestamptz not null default now()
);

create index refund_reports_created_at_idx on public.refund_reports (created_at desc);
alter table public.refund_reports enable row level security;
revoke all on public.refund_reports from anon, authenticated;
grant select on public.refund_reports to authenticated;

create policy "admins read refund reports" on public.refund_reports
  for select to authenticated
  using (public.is_admin());

create function public.prevent_cancelled_course_reopen()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.cancelled_at is not null and new.registration_open then
    raise exception 'course_cancelled';
  end if;
  return new;
end;
$$;

create trigger courses_prevent_cancelled_reopen
  before update of registration_open on public.courses
  for each row execute function public.prevent_cancelled_course_reopen();

create function public.cancel_course(p_course_id uuid, p_reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course public.courses;
  v_refund_count integer;
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'cancellation_reason_required';
  end if;

  select * into v_course
  from public.courses
  where id = p_course_id
  for update;

  if not found then
    raise exception 'course_not_found';
  end if;
  if v_course.cancelled_at is not null then
    raise exception 'course_already_cancelled';
  end if;

  update public.courses
  set registration_open = false,
      cancelled_at = now(),
      cancellation_reason = trim(p_reason)
  where id = p_course_id;

  insert into public.refund_reports (
    payment_id, booking_id, course_id, course_title, student_name,
    account_name, account_email, amount, receipt_no, cancellation_reason
  )
  select p.id, b.id, c.id, c.title, b.student_name,
         pr.full_name, coalesce(u.email, ''), p.amount, p.receipt_no, trim(p_reason)
  from public.payments p
  join public.bookings b on b.id = p.booking_id
  join public.courses c on c.id = b.course_id
  join public.profiles pr on pr.id = b.user_id
  left join auth.users u on u.id = b.user_id
  where b.course_id = p_course_id
    and b.status = 'paid'
    and p.status = 'succeeded'
  on conflict (payment_id) do nothing;
  get diagnostics v_refund_count = row_count;

  update public.payments p
  set status = 'refund_due'
  from public.bookings b
  where b.id = p.booking_id
    and b.course_id = p_course_id
    and b.status = 'paid'
    and p.status = 'succeeded';

  update public.bookings
  set status = 'cancelled'
  where course_id = p_course_id
    and status in ('held', 'paid');

  return v_refund_count;
end;
$$;

revoke all on function public.prevent_cancelled_course_reopen() from public, anon;
revoke all on function public.cancel_course(uuid, text) from public, anon;
grant execute on function public.cancel_course(uuid, text) to authenticated, service_role;

create or replace view public.course_seats as
select
  c.id,
  c.title,
  c.description,
  c.teacher_id,
  t.full_name as teacher_name,
  c.capacity,
  c.price,
  c.registration_open,
  c.created_at,
  public.seats_taken(c.id) as seats_taken,
  c.cancelled_at,
  c.cancellation_reason
from public.courses c
left join public.profiles t on t.id = c.teacher_id;
