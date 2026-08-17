/**
 * useLessons.ts — Hook tải manifest bài học (en). Đứng riêng file để
 * fast-refresh không phàn nàn (file HomeScreen chỉ export component).
 */
import { useEffect, useState } from 'react';
import { ensureLessonsManifest, type LessonMeta } from '../../data/lessons';
import { useCourseStore } from '../../store/useCourseStore';

/** Tải danh sách bài học theo KHÓA — tự refresh khi manifest sẵn sàng */
export function useLessons(): LessonMeta[] {
  const course = useCourseStore((s) => s.course);
  const ready = useCourseStore((s) => s.lessonManifestReady);
  const refresh = useCourseStore((s) => s.refreshLessonsManifest);
  const [list, setList] = useState<LessonMeta[]>([]);

  useEffect(() => {
    if (!ready) {
      void refresh();
      return;
    }
    ensureLessonsManifest(course ? course.seed : undefined)
      .then(setList)
      .catch(() => setList([]));
  }, [ready, refresh, course]);

  return list;
}
