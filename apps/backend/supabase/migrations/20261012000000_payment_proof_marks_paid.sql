create function public.mark_booking_paid_from_proof()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  if split_part(new.proof_path, '/', 1) <> auth.uid()::text or not exists (
    select 1 from storage.objects
    where bucket_id = 'payment-proofs' and name = new.proof_path
  ) then
    raise exception 'payment_proof_file_missing';
  end if;

  select * into v_booking
  from public.bookings
  where id = new.booking_id
  for update;

  if not found or v_booking.status <> 'held' then
    raise exception 'booking_not_payable';
  end if;

  update public.bookings
  set status = 'paid', paid_at = now()
  where id = v_booking.id;

  insert into public.payments (booking_id, amount, status, idempotency_key, receipt_no)
  select v_booking.id, c.price, 'succeeded', 'transfer-proof-' || new.id,
    'RC-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.receipt_no_seq')::text, 6, '0')
  from public.courses c
  where c.id = v_booking.course_id;

  return new;
end;
$$;

create trigger payment_proofs_mark_booking_paid
  after insert on public.payment_proofs
  for each row execute function public.mark_booking_paid_from_proof();

create policy "admin01 reads transfer proof images" on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-proofs' and public.is_school_admin());

revoke all on function public.mark_booking_paid_from_proof() from public, anon, authenticated;
