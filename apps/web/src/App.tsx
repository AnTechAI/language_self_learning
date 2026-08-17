/**
 * App.tsx — Điểm vào UI React. Router đơn giản theo tab (chưa cần react-router).
 */
import { useEffect } from 'react';
import { AppShell } from './components/Layout';
import { Toast } from './components/ui';
import { GamesScreen } from './features/games/GamesScreen';
import { HomeScreen } from './features/home/HomeScreen';
import { LessonStudyScreen } from './features/study/LessonStudyScreen';
import { PickerScreen } from './features/picker/PickerScreen';
import { StatsScreen } from './features/stats/StatsScreen';
import { ZhRoot } from './features/zh/ZhRoot';
import { VocabScreen, WordDetail } from './features/vocab/VocabScreen';
import { useCourseStore } from './store/useCourseStore';

export default function App() {
  const booted = useCourseStore((s) => s.booted);
  const boot = useCourseStore((s) => s.boot);
  const course = useCourseStore((s) => s.course);
  const tab = useCourseStore((s) => s.tab);
  const study = useCourseStore((s) => s.study);
  const detailId = useCourseStore((s) => s.detailId);
  const toast = useCourseStore((s) => s.toast);

  useEffect(() => {
    if (!booted) void boot();
  }, [booted, boot]);

  // ===== GIAO DIỆN RIÊNG CHO TIẾNG TRUNG (Design v4 — chinese-app-ui.jsx) =====
  // Tách hoàn toàn khỏi shell tiếng Anh: shell riêng + 5 tab riêng
  if (course?.seed === 'zh') {
    return (
      <>
        <ZhRoot />
        <Toast msg={toast} />
      </>
    );
  }

  // ===== GIAO DIỆN TIẾNG ANH (Design v3 — giấy ấm) =====

  // Các PAGE toàn màn hình — hiện đè trước mọi tab
  if (study)
    return (
      <>
        <LessonStudyScreen />
        <Toast msg={toast} />
      </>
    );
  if (detailId)
    return (
      <>
        <div className="detail-page">
          <WordDetail id={detailId} />
        </div>
        <Toast msg={toast} />
      </>
    );

  let screen: React.ReactNode = null;
  if (!course) {
    screen = <PickerScreen />;
  } else if (tab === 'home') {
    screen = <HomeScreen />;
  } else if (tab === 'vocab') {
    screen = <VocabScreen />;
  } else if (tab === 'games') {
    screen = <GamesScreen />;
  } else if (tab === 'stats') {
    screen = <StatsScreen />;
  }

  return (
    <>
      <AppShell>{screen}</AppShell>
      <Toast msg={toast} />
    </>
  );
}
