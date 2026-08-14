/**
 * App.tsx — Điểm vào UI React. Router đơn giản theo tab (chưa cần react-router).
 */
import { useEffect } from 'react';
import { AppShell } from './components/Layout';
import { Toast } from './components/ui';
import { GamesScreen } from './features/games/GamesScreen';
import { HomeScreen } from './features/home/HomeScreen';
import { PickerScreen } from './features/picker/PickerScreen';
import { StatsScreen } from './features/stats/StatsScreen';
import { VocabScreen } from './features/vocab/VocabScreen';
import { useCourseStore } from './store/useCourseStore';

export default function App() {
  const booted = useCourseStore((s) => s.booted);
  const boot = useCourseStore((s) => s.boot);
  const course = useCourseStore((s) => s.course);
  const tab = useCourseStore((s) => s.tab);
  const toast = useCourseStore((s) => s.toast);

  useEffect(() => {
    if (!booted) void boot();
  }, [booted, boot]);

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
