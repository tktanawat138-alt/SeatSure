import type { CourseScheduleGateway } from '@/interfaces/course-schedule-gateway'
import { supabase } from '@/lib/supabase'

export const courseScheduleGateway: CourseScheduleGateway = {
  async update(courseId, startsAt, endsAt) {
    const { data, error } = await supabase.from('courses')
      .update({ starts_at: startsAt, ends_at: endsAt })
      .eq('id', courseId)
      .select('id')
    if (error) throw error
    if (!data.length) throw new Error('course_schedule_update_denied')
  },
}
