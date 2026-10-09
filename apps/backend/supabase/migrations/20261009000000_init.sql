-- SeatSure: course booking demo.
-- Promise under test: "จ่ายแล้วต้องได้ที่นั่ง ไม่เกิน ไม่ซ้ำ ไม่หลุด"
--   ไม่เกิน  seats taken never exceed capacity            -> book_seat (row lock)
--   ไม่ซ้ำ   one active booking, one charge per booking    -> unique index + pay_booking
--   ไม่หลุด  a succeeded payment always has a paid seat    -> pay_booking

create type public.user_role as enum ('parent', 'teacher', 'admin');
create type public.booking_status as enum ('held', 'paid', 'cancelled', 'expired');
create type public.payment_status as enum ('succeeded', 'refund_due');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'parent',
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  teacher_id uuid references public.profiles (id) on delete set null,
  capacity int not null check (capacity > 0),
  price numeric(10, 2) not null check (price >= 0),
  registration_open boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  student_name text not null,
  status public.booking_status not null default 'held',
  hold_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index bookings_course_id_idx on public.bookings (course_id);

-- ไม่ซ้ำ: an account can hold at most one live booking per course.
create unique index bookings_one_active_per_user
  on public.bookings (course_id, user_id)
  where status in ('held', 'paid');

create sequence public.receipt_no_seq;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  amount numeric(10, 2) not null,
  status public.payment_status not null,
  idempotency_key text not null unique,
  receipt_no text not null unique,
  created_at timestamptz not null default now()
);

create index payments_booking_id_idx on public.payments (booking_id);

-- Out of scope as a feature; kept only as the security case
-- "นักเรียนต้องเห็นเฉพาะเกรดของตัวเอง".
create table public.grades (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  grade text not null,
  unique (course_id, student_id)
);

-- Single-row settings. booking_mode = 'unsafe' switches book_seat/pay_booking
-- to the naive check-then-write versions so the tests can show the bugs.
-- check_to_save_delay_ms stands in for the slow work a real system does between
-- checking for a seat and saving the booking. It applies in both modes and is
-- 0 outside the tests, which raise it so the race happens on every run.
create table public.app_settings (
  id boolean primary key default true check (id),
  booking_mode text not null default 'safe' check (booking_mode in ('safe', 'unsafe')),
  check_to_save_delay_ms int not null default 0 check (check_to_save_delay_ms between 0 and 2000)
);

insert into public.app_settings default values;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.my_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(my_role() = 'admin', false);
$$;

-- A seat is taken by a paid booking or by a hold that has not run out yet.
create function public.seats_taken(p_course_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from bookings
  where course_id = p_course_id
    and (status = 'paid' or (status = 'held' and hold_expires_at > now()));
$$;

-- New accounts always start as 'parent'; role is never taken from user input.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ไม่เกิน: an admin cannot shrink a course below the seats already taken.
create function public.guard_course_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.capacity < old.capacity and new.capacity < seats_taken(new.id) then
    raise exception 'capacity_below_booked';
  end if;
  return new;
end;
$$;

create trigger courses_guard_capacity
  before update of capacity on public.courses
  for each row execute function public.guard_course_capacity();

-- Course list with live seat counts. Runs as its owner on purpose: callers
-- cannot read other people's bookings, but they may see how many seats are left.
create view public.course_seats as
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
  public.seats_taken(c.id) as seats_taken
from public.courses c
left join public.profiles t on t.id = c.teacher_id;

-- ---------------------------------------------------------------------------
-- Booking and payment
-- ---------------------------------------------------------------------------

create function public.book_seat(p_course_id uuid, p_student_name text)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_safe boolean := coalesce((select booking_mode <> 'unsafe' from app_settings), true);
  v_delay_ms int := coalesce((select check_to_save_delay_ms from app_settings), 0);
  v_course courses;
  v_taken int;
  v_booking bookings;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if coalesce(trim(p_student_name), '') = '' then
    raise exception 'student_name_required';
  end if;

  if v_safe then
    -- Concurrent bookings for the same course queue up on this row lock, so
    -- the count below always sees every booking that came before.
    select * into v_course from courses where id = p_course_id for update;
  else
    select * into v_course from courses where id = p_course_id;
  end if;
  if not found then
    raise exception 'course_not_found';
  end if;
  if not v_course.registration_open then
    raise exception 'registration_closed';
  end if;

  -- Release holds that ran out, so their seats (and their owners) can book again.
  update bookings
  set status = 'expired'
  where course_id = p_course_id and status = 'held' and hold_expires_at <= now();

  select count(*) into v_taken
  from bookings
  where course_id = p_course_id and status in ('held', 'paid');

  if v_taken >= v_course.capacity then
    raise exception 'course_full';
  end if;

  if v_delay_ms > 0 then
    perform pg_sleep(v_delay_ms / 1000.0);
  end if;

  insert into bookings (course_id, user_id, student_name, hold_expires_at)
  values (p_course_id, v_uid, trim(p_student_name), now() + interval '10 minutes')
  returning * into v_booking;

  return v_booking;
exception
  when unique_violation then
    raise exception 'already_booked';
end;
$$;

-- Mock payment gateway: every charge is approved. p_idempotency_key identifies
-- one payment attempt; repeating it returns the first result instead of charging again.
create function public.pay_booking(p_booking_id uuid, p_idempotency_key text)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_safe boolean := coalesce((select booking_mode <> 'unsafe' from app_settings), true);
  v_booking bookings;
  v_course courses;
  v_payment payments;
  v_status payment_status := 'succeeded';
  v_others int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if coalesce(trim(p_idempotency_key), '') = '' then
    raise exception 'idempotency_key_required';
  end if;

  select * into v_booking from bookings where id = p_booking_id and user_id = v_uid;
  if not found then
    raise exception 'booking_not_found';
  end if;

  if v_safe then
    -- Same lock order as book_seat (course first), then the booking itself.
    select * into v_course from courses where id = v_booking.course_id for update;
    select * into v_booking from bookings where id = p_booking_id for update;
  else
    select * into v_course from courses where id = v_booking.course_id;
  end if;

  select * into v_payment from payments where idempotency_key = p_idempotency_key;
  if found then
    if v_payment.booking_id <> p_booking_id then
      raise exception 'idempotency_key_reused';
    end if;
    return v_payment;
  end if;

  if v_safe then
    if v_booking.status = 'paid' then
      raise exception 'already_paid';
    end if;
    if v_booking.status = 'cancelled' then
      raise exception 'booking_cancelled';
    end if;

    -- ไม่หลุด: the hold ran out before the money arrived. Keep the seat if one
    -- is still free; otherwise record the money as owed back, never as a sale.
    if v_booking.status = 'expired' or v_booking.hold_expires_at <= now() then
      select count(*) into v_others
      from bookings
      where course_id = v_course.id
        and id <> v_booking.id
        and (status = 'paid' or (status = 'held' and hold_expires_at > now()));

      if v_others >= v_course.capacity
        or exists (
          select 1 from bookings
          where course_id = v_course.id and user_id = v_uid
            and id <> v_booking.id and status in ('held', 'paid')
        )
      then
        v_status := 'refund_due';
      end if;
    end if;

    if v_status = 'succeeded' then
      update bookings set status = 'paid', paid_at = now() where id = v_booking.id;
    else
      update bookings set status = 'expired' where id = v_booking.id;
    end if;
  else
    -- Naive version: takes the money without checking that the seat was
    -- actually secured, or that this booking was already paid for.
    update bookings
    set status = 'paid', paid_at = now()
    where id = p_booking_id and status = 'held' and hold_expires_at > now();
  end if;

  insert into payments (booking_id, amount, status, idempotency_key, receipt_no)
  values (
    p_booking_id,
    v_course.price,
    v_status,
    p_idempotency_key,
    'RC-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('receipt_no_seq')::text, 6, '0')
  )
  returning * into v_payment;

  return v_payment;
exception
  when unique_violation then
    raise exception 'duplicate_request';
end;
$$;

-- ---------------------------------------------------------------------------
-- Access control
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.grades enable row level security;
alter table public.app_settings enable row level security;

-- Privileges are granted explicitly; nothing is open to visitors who are not signed in.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon;

grant select on public.profiles, public.courses, public.bookings, public.payments,
  public.grades, public.app_settings, public.course_seats to authenticated;
grant insert, update on public.courses to authenticated;
grant update (booking_mode) on public.app_settings to authenticated;
grant execute on all functions in schema public to authenticated, service_role;

create policy "own profile, or admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "signed-in users see courses" on public.courses
  for select to authenticated
  using (true);

create policy "admin adds courses" on public.courses
  for insert to authenticated
  with check (public.is_admin());

create policy "admin edits courses" on public.courses
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Bookings and payments are written only through book_seat / pay_booking.
create policy "own bookings, course teacher, or admin" on public.bookings
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.courses c
      where c.id = bookings.course_id and c.teacher_id = auth.uid()
    )
  );

create policy "own payments, or admin" on public.payments
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.bookings b
      where b.id = payments.booking_id and b.user_id = auth.uid()
    )
  );

create policy "own grade, course teacher, or admin" on public.grades
  for select to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.courses c
      where c.id = grades.course_id and c.teacher_id = auth.uid()
    )
  );

create policy "signed-in users see settings" on public.app_settings
  for select to authenticated
  using (true);

create policy "admin changes settings" on public.app_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
