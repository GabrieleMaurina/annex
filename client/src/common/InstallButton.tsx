import { useSyncExternalStore } from 'react';
import { Button } from 'react-bootstrap';
import { useWhiteIcon } from './icon';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let installPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function setInstallPrompt(value: BeforeInstallPromptEvent | null) {
  installPrompt = value;
  listeners.forEach((l) => l());
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  setInstallPrompt(e as BeforeInstallPromptEvent);
});
window.addEventListener('appinstalled', () => setInstallPrompt(null));

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
