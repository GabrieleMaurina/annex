import { useEffect } from 'react';
import { playSound } from '../../../lib/sounds';
import type { PaintTool } from '../paint/paintTools';

interface Shortcuts {
  mode: 'graph' | 'paint';
  tool: PaintTool | null;
  setTool: (tool: PaintTool | null) => void;
  setCollapsed: (collapsed: boolean) => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function useEditorShortcuts({
  mode,
  tool,
  setTool,
  setCollapsed,
  onSave,
  onUndo,
  onRedo,
}: Shortcuts) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && mode === 'paint') {
        if (tool) {
          playSound('click');
          setTool(null);
        } else {
          setCollapsed(true);
        }
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        playSound('click');
        onSave();
      } else if (key === 'z') {
        e.preventDefault();
        playSound('click');
        if (e.shiftKey) onRedo();
        else onUndo();
      } else if (key === 'y') {
        e.preventDefault();
        playSound('click');
        onRedo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSave, onUndo, onRedo, mode, tool, setTool, setCollapsed]);
}
