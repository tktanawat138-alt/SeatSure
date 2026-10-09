export interface CourseScheduleGateway {
  update(courseId: string, startsAt: string, endsAt: string): Promise<void>
}
