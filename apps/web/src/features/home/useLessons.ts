/**
 * useLessons.ts — Hook tải manifest bài học (en). Đứng riêng file để
 * fast-refresh không phàn nàn (file HomeScreen chỉ export component).
 */
import { useEffect, useState } from 'react';
import { ensureLessonsManifest, type LessonMeta } from '../../data/lessons';
import { useCourseStore } from '../../store/useCourseStore';

/** Tải danh sách bài học (en) — tự refresh khi manifest sẵn sàng */
export function useLessons(): LessonMeta[] {
  const ready = useCourseStore((s) => s.lessonManifestReady);
  const refresh = useCourseStore((s) => s.refreshLessonsManifest);
  const [list, setList] = useState<LessonMeta[]>([]);

  useEffect(() => {
    if (!ready) {
      void refresh();
      return;
    }
    ensureLessonsManifest()
      .then(setList)
      .catch(() => setList([]));
  }, [ready, refresh]);

  return list;
}
