import { useSyncExternalStore } from 'react';
import { Button } from 'react-bootstrap';
import { useWhiteIcon } from './icon';

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

if (window.matchMedia('(display-mode: standalone)').matches) markInstalled();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  if (!isMarkedInstalled()) setInstallPrompt(e as BeforeInstallPromptEvent);
});
window.addEventListener('appinstalled', () => {
  markInstalled();
  setInstallPrompt(null);
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function InstallButton() {
  const prompt = useSyncExternalStore(subscribe, () => installPrompt);
  const whiteDownloadIcon = useWhiteIcon('/icons/download.svg');
  if (!prompt) return null;

  function install() {
    prompt!.prompt();
    setInstallPrompt(null);
  }

  return (
    <Button
      variant="success"
      size="lg"
      className="d-flex align-items-center justify-content-center gap-2"
      onClick={install}
    >
      <img
        src={whiteDownloadIcon ?? '/icons/download.svg'}
        width={20}
        height={20}
        alt=""
      />
      Install Game
    </Button>
  );
}

export default InstallButton;
