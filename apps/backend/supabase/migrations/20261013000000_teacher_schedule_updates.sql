create policy "teachers update their course schedule"
  on public.courses
  for update to authenticated
  using (public.my_role() = 'teacher' and teacher_id = auth.uid())
  with check (public.my_role() = 'teacher' and teacher_id = auth.uid());

create function public.guard_teacher_course_schedule()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.my_role() = 'teacher' then
    if old.teacher_id is distinct from auth.uid()
      or new.teacher_id is distinct from old.teacher_id
      or (to_jsonb(new) - 'starts_at' - 'ends_at') is distinct from
         (to_jsonb(old) - 'starts_at' - 'ends_at') then
      raise exception 'teachers_may_only_change_schedule';
    end if;
  end if;
  return new;
end;
$$;

create trigger courses_teacher_schedule_only
  before update on public.courses
  for each row execute function public.guard_teacher_course_schedule();

revoke all on function public.guard_teacher_course_schedule() from public, anon, authenticated;
