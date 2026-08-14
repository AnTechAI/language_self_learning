/**
 * courses.ts — Định nghĩa khóa học (port từ legacy config.js).
 * Thêm khóa mới (vd tiếng Nhật): thêm 1 object ở đây + bộ seed tương ứng.
 */
import type { Course } from '@english/shared';

export const COURSES: Course[] = [
  {
    id: 'en',
    name: 'Tiếng Anh',
    icon: '🇬🇧',
    tagline: 'IPA + ví dụ, kho từ phong phú nhất',
    color: '#16a34a',
    source: { code: 'en', label: 'Anh', tts: 'en-US' },
    target: { code: 'vi', label: 'Việt', tts: 'vi-VN' },
    storagePrefix: 'course_en',
    seed: 'en',
    usesPinyin: false,
    dictLookup: true,
    pronunciationLabel: 'Phiên âm (IPA)',
    pronunciationPh: '/əˈpruːv/',
    wordFieldLabel: 'Từ tiếng Anh',
    wordFieldPh: 'vd: approve',
  },
  {
    id: 'zh',
    name: 'Tiếng Trung',
    icon: '🇨🇳',
    tagline: 'Chữ Hán + phiên âm pinyin',
    color: '#dc2626',
    source: { code: 'zh', label: 'Trung', tts: 'zh-CN' },
    target: { code: 'vi', label: 'Việt', tts: 'vi-VN' },
    storagePrefix: 'course_zh',
    seed: 'zh',
    usesPinyin: true,
    dictLookup: false,
    pronunciationLabel: 'Phiên âm (pinyin)',
    pronunciationPh: 'nǐ hǎo',
    wordFieldLabel: 'Chữ Hán',
    wordFieldPh: 'vd: 你好',
  },
];

export const DAILY_QUOTA = 8;

export function courseById(id: string | null | undefined): Course | undefined {
  if (!id) return undefined;
  return COURSES.find((c) => c.id === id);
}
