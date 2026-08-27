import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DEFAULT_CARDS_BUTTONS_TOP, TOP_BUTTON_GAP } from '../helpers';

export function usePanelsUI() {
  const [openPanel, setOpenPanel] = useState<
    'cards' | 'bonuses' | 'logs' | 'settings' | null
  >(null);
  const cardsOpen = openPanel === 'cards';
  const bonusesOpen = openPanel === 'bonuses';
  const logsOpen = openPanel === 'logs';
  const settingsOpen = openPanel === 'settings';
  const [cardsButtonsTop, setCardsButtonsTop] = useState(
    DEFAULT_CARDS_BUTTONS_TOP,
  );
  const cardsPanelRef = useRef<HTMLDivElement>(null);
  const cardsButtonRef = useRef<HTMLButtonElement>(null);
  const bonusesButtonRef = useRef<HTMLButtonElement>(null);
  const logsButtonRef = useRef<HTMLButtonElement>(null);
  const logsPanelRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const buttonColumnRef = useRef<HTMLDivElement>(null);
  const [logsPanelTop, setLogsPanelTop] = useState(DEFAULT_CARDS_BUTTONS_TOP);
  const [settingsPanelTop, setSettingsPanelTop] = useState(
    DEFAULT_CARDS_BUTTONS_TOP,
  );
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  useEffect(() => {
    const settingsEl = document.getElementById('settings-toggle');
    if (!settingsEl) return;
    function measure() {
      setCardsButtonsTop(
        settingsEl!.getBoundingClientRect().bottom + TOP_BUTTON_GAP,
      );
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(settingsEl);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!logsOpen) return;
    const container = buttonColumnRef.current;
    if (!container) return;
    function measure() {
      if (logsPanelRef.current)
        setLogsPanelTop(logsPanelRef.current.getBoundingClientRect().top);
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [logsOpen]);

  useLayoutEffect(() => {
    if (!settingsOpen) return;
    const container = buttonColumnRef.current;
    if (!container) return;
    function measure() {
      if (settingsPanelRef.current)
        setSettingsPanelTop(
          settingsPanelRef.current.getBoundingClientRect().top,
        );
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [settingsOpen]);

  useEffect(() => {
    if (openPanel === null) return;
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (cardsButtonRef.current?.contains(target)) return;
      if (bonusesButtonRef.current?.contains(target)) return;
      if (logsButtonRef.current?.contains(target)) return;
      if (settingsButtonRef.current?.contains(target)) return;
      if (cardsPanelRef.current?.contains(target)) return;
      if (logsPanelRef.current?.contains(target)) return;
      if (settingsPanelRef.current?.contains(target)) return;
      setOpenPanel(null);
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('contextmenu', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('contextmenu', handleOutside);
    };
  }, [openPanel]);

  return {
    openPanel,
    setOpenPanel,
    cardsOpen,
    bonusesOpen,
    logsOpen,
    settingsOpen,
    cardsButtonsTop,
    cardsPanelRef,
    cardsButtonRef,
    bonusesButtonRef,
    logsButtonRef,
    logsPanelRef,
    settingsButtonRef,
    settingsPanelRef,
    buttonColumnRef,
    logsPanelTop,
    settingsPanelTop,
    panelCollapsed,
    setPanelCollapsed,
  };
}
