import AppTabs from '@/components/app-tabs';
import { CircleProvider } from '@/lib/circle-context';

export default function TabLayout() {
  return (
    <CircleProvider>
      <AppTabs />
    </CircleProvider>
  );
}
