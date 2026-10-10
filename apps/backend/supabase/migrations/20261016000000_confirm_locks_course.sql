-- Security review M4: confirm_transfer_payment raced cancel_course. Confirm locked only the
-- booking, so a cancel running at the same moment could build its refund report before the new
-- payment committed, then cancel the booking anyway: a succeeded payment on a cancelled booking
-- with no refund report.
--
-- Confirm now takes the same locks in the same order as cancel_course (and book_seat): the course
-- row first, then the booking row. Whichever transaction gets the course lock first runs to the
-- end before the other one reads anything, so either the payment exists before cancel reports
-- refunds, or confirm sees the cancelled booking/course and refuses.
--
-- Everything else is unchanged from 20261014000000_confirm_transfer_payment.sql. An expired hold
-- can still be confirmed, as before (see security report L5, not changed here).
create or replace function public.confirm_transfer_payment(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_course public.courses;
  v_proof public.payment_proofs;
begin
  -- Unlocked read: only to check ownership and find the course to lock.
  select * into v_booking
  from public.bookings
  where id = p_booking_id and user_id = auth.uid();

  if not found then
    raise exception 'booking_not_found';
  end if;

  -- Lock order matches cancel_course: course row, then the booking row.
  select * into v_course
  from public.courses
  where id = v_booking.course_id
  for update;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if v_booking.status = 'paid' then
    return;
  end if;
  if v_booking.status <> 'held' then
    raise exception 'booking_not_payable';
  end if;
  if v_course.cancelled_at is not null then
    raise exception 'course_cancelled';
  end if;

  select * into v_proof
  from public.payment_proofs
  where booking_id = p_booking_id;

  if not found or split_part(v_proof.proof_path, '/', 1) <> auth.uid()::text or not exists (
    select 1 from storage.objects
    where bucket_id = 'payment-proofs' and name = v_proof.proof_path
  ) then
    raise exception 'payment_proof_required';
  end if;

  update public.bookings
  set status = 'paid', paid_at = now()
  where id = v_booking.id;

  insert into public.payments (booking_id, amount, status, idempotency_key, receipt_no)
  values (
    v_booking.id,
    v_course.price,
    'succeeded',
    'transfer-proof-' || v_proof.id,
    'RC-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.receipt_no_seq')::text, 6, '0')
  );
end;
$$;

revoke all on function public.confirm_transfer_payment(uuid) from public, anon;
grant execute on function public.confirm_transfer_payment(uuid) to authenticated;
