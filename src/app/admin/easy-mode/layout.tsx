import '@/styles/easy-mode.css';
import EasyModeShell from '@/components/easy-mode/EasyModeShell';
import { FontSizeProvider } from '@/contexts/FontSizeContext';

export default function EasyModeLayout() {
  return (
    <FontSizeProvider>
      <EasyModeShell />
    </FontSizeProvider>
  );
}
