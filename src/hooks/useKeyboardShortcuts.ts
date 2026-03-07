import { useEffect } from 'react';
import { useTimelineStore } from '../store/timelineStore';
import { useVideoPreviewStore } from '../store/videoPreviewStore';
import { useShortcutStore, matchesBinding } from '../store/shortcutStore';

const FRAME_STEP = 1 / 30; // 1 frame at 30fps

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
    (el as HTMLElement).isContentEditable;
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in form fields
      if (isInputFocused()) return;

      const { shortcuts, setHelpVisible, helpVisible } = useShortcutStore.getState();

      // Escでヘルプを閉じる
      if (e.key === 'Escape' && helpVisible) {
        setHelpVisible(false);
        return;
      }

      const timeline = useTimelineStore.getState();
      const videoPreview = useVideoPreviewStore.getState();

      for (const shortcut of shortcuts) {
        if (!matchesBinding(e, shortcut.binding)) continue;

        // Matched a shortcut — prevent default browser behavior
        e.preventDefault();

        switch (shortcut.id) {
          case 'playPause': {
            const newPlaying = !timeline.isPlaying;
            timeline.setIsPlaying(newPlaying);
            videoPreview.setIsPlaying(newPlaying);
            break;
          }

          case 'split': {
            if (timeline.selectedClipId && timeline.selectedTrackId) {
              timeline.splitClipAtTime(
                timeline.selectedTrackId,
                timeline.selectedClipId,
                timeline.currentTime
              );
            }
            break;
          }

          case 'undo':
            timeline.undo();
            break;

          case 'redo':
            timeline.redo();
            break;

          case 'copy':
            timeline.copySelectedClip();
            break;

          case 'paste':
            timeline.pasteClip();
            break;

          case 'delete':
          case 'deleteAlt':
            timeline.deleteSelectedClip();
            break;

          case 'frameNext': {
            const nextTime = Math.min(
              timeline.currentTime + FRAME_STEP,
              timeline.duration || Infinity
            );
            timeline.setCurrentTime(nextTime);
            videoPreview.setCurrentTime(nextTime);
            break;
          }

          case 'framePrev': {
            const prevTime = Math.max(timeline.currentTime - FRAME_STEP, 0);
            timeline.setCurrentTime(prevTime);
            videoPreview.setCurrentTime(prevTime);
            break;
          }

          case 'zoomIn':
            timeline.zoomIn();
            break;

          case 'zoomOut':
            timeline.zoomOut();
            break;

          case 'showHelp':
            setHelpVisible(!helpVisible);
            break;
        }

        return; // Only handle the first match
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
