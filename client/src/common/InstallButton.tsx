import { useSyncExternalStore } from 'react';
import { Button } from 'react-bootstrap';
import WhiteIcon from './icons/WhiteIcon';
import Tip from './tooltips/Tip';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const INSTALLED_KEY = 'pwaInstalled';

let installPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function setInstallPrompt(value: BeforeInstallPromptEvent | null) {
  installPrompt = value;
  listeners.forEach((l) => l());
}

function markInstalled() {
  try {
    localStorage.setItem(INSTALLED_KEY, '1');
  } catch {
    return;
  }
}

function isMarkedInstalled() {
  try {
    return localStorage.getItem(INSTALLED_KEY) === '1';
  } catch {
    return false;
  }
}

if (isStandalone()) markInstalled();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  setInstallPrompt(e as BeforeInstallPromptEvent);
});
window.addEventListener('appinstalled', () => {
  markInstalled();
  setInstallPrompt(null);
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches;
}

interface Props {
  ignoreInstalledFlag?: boolean;
}

function InstallButton({ ignoreInstalledFlag }: Props) {
  const prompt = useSyncExternalStore(subscribe, () => installPrompt);
  if (isStandalone()) return null;
  if (!prompt || (!ignoreInstalledFlag && isMarkedInstalled())) return null;

  function install() {
    prompt?.prompt();
    setInstallPrompt(null);
  }

  return (
    <Tip text="Install Annex as an app on this device">
      <Button
        variant="success"
        size="lg"
        className="d-flex align-items-center justify-content-center gap-2"
        onClick={install}
      >
        <WhiteIcon path="/icons/download.svg" size={20} />
        Install Game
      </Button>
    </Tip>
  );
}

export default InstallButton;
