/**
 * lib/zh.test.ts — Tiện ích khóa tiếng Trung (pinyin, thanh điệu, SM-2 SRS).
 */
import { describe, expect, it } from 'vitest';
import { charTones, dueIn, levelFromLessonTitle, numericFromMarked, sm2, stripTones } from './zh';

describe('stripTones', () => {
  it('bỏ thanh điệu, giữ chữ thường', () => {
    expect(stripTones('nǐ hǎo Wǒ ài')).toBe('ni hao wo ai');
  });
  it('loại ký tự không phải pinyin', () => {
    expect(stripTones('汉语 hàn yǔ')).toBe('han yu');
  });
});

describe('numericFromMarked', () => {
  it('chuyển dấu thanh → số', () => {
    expect(numericFromMarked('nǐ hǎo')).toBe('ni3 hao3');
    expect(numericFromMarked('shàng hǎi')).toBe('shang4 hai3');
    expect(numericFromMarked('zhōng guó')).toBe('zhong1 guo2');
  });
  it('thanh nhẹ (không dấu) → không thêm số', () => {
    expect(numericFromMarked('de')).toBe('de');
  });
  it('ü giữ dạng ü', () => {
    expect(numericFromMarked('lǜ sè')).toBe('lü4 se4');
  });
});

describe('charTones', () => {
  it('ghép chữ với âm tiết 1:1', () => {
    expect(charTones('你好', 'ni3 hao3')).toEqual([
      { char: '你', tone: 3 },
      { char: '好', tone: 3 },
    ]);
  });
  it('thiếu âm tiết → tone 0', () => {
    expect(charTones('火车', 'huo3 che1')).toEqual([
      { char: '火', tone: 3 },
      { char: '车', tone: 1 },
    ]);
  });
  it('số sai phạm vi → 0', () => {
    expect(charTones('儿', 'r5')[0].tone).toBe(0);
  });
});

describe('sm2 (SRS)', () => {
  it('lần đầu — Good → interval 1, ease 2.5', () => {
    const r = sm2(2);
    expect(r.interval).toBe(1);
    expect(r.ease).toBe(2.5);
    expect(r.reps).toBe(1);
  });
  it('Again → interval 0 (ôn lại hôm nay), ease giảm', () => {
    const r = sm2(0, { ease: 2.5, interval: 6, reps: 3 });
    expect(r.interval).toBe(0);
    expect(r.ease).toBe(2.3);
    expect(r.reps).toBe(4);
  });
  it('lần thứ 2 Good → 6 ngày', () => {
    const r = sm2(2, { ease: 2.5, interval: 1, reps: 1 });
    expect(r.interval).toBe(6);
  });
  it('Easy → ease +0.15, interval nhân thêm', () => {
    const r = sm2(3, { ease: 2.5, interval: 6, reps: 2 });
    expect(r.ease).toBe(2.65);
    expect(r.interval).toBeGreaterThan(6);
  });
  it('ease không xuống dưới 1.3', () => {
    expect(sm2(0, { ease: 1.3, interval: 2, reps: 5 }).ease).toBe(1.3);
  });
});

describe('dueIn & levelFromLessonTitle', () => {
  it('ngày +N (YYYY-MM-DD)', () => {
    expect(dueIn(0, new Date('2024-01-10T12:00:00Z'))).toBe('2024-01-10');
    expect(dueIn(3, new Date('2024-01-10T12:00:00Z'))).toBe('2024-01-13');
  });
  it('parse cấp độ từ tiêu đề bài HSK', () => {
    expect(levelFromLessonTitle('HSK 2 · Bài 3')).toBe(2);
    expect(levelFromLessonTitle('HSK 6 · Bài 57')).toBe(6);
    expect(levelFromLessonTitle('Bài 1 · 500 từ thông dụng')).toBeUndefined();
  });
});
