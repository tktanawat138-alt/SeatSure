drop trigger if exists payment_proofs_mark_booking_paid on public.payment_proofs;
drop function if exists public.mark_booking_paid_from_proof();

grant update on public.payment_proofs to authenticated;

create policy "parents replace own unconfirmed transfer proofs" on public.payment_proofs
  for update to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.user_id = auth.uid() and b.status = 'held'
    )
  )
  with check (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.user_id = auth.uid() and b.status = 'held'
    )
    and split_part(proof_path, '/', 1) = auth.uid()::text
  );

create policy "parents delete own replaced payment proof images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

create function public.confirm_transfer_payment(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_proof public.payment_proofs;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'booking_not_found';
  end if;

  if v_booking.status = 'paid' then
    return;
  end if;
  if v_booking.status <> 'held' then
    raise exception 'booking_not_payable';
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
  select v_booking.id, c.price, 'succeeded', 'transfer-proof-' || v_proof.id,
    'RC-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.receipt_no_seq')::text, 6, '0')
  from public.courses c
  where c.id = v_booking.course_id;
end;
$$;

revoke all on function public.confirm_transfer_payment(uuid) from public, anon;
grant execute on function public.confirm_transfer_payment(uuid) to authenticated;
