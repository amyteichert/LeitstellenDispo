import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ANSICHTEN } from './startansicht';

type Props = {
  anchorRef: React.RefObject<HTMLElement | null>;
  isOpen: boolean;
  onClose: () => void;
  currentView: string;
  onSelect: (view: string) => void;
  /** Sichtbare Menüpunkte (Standard: alle) */
  ansichten?: readonly string[];
};

export default function ViewDropdown({ anchorRef, isOpen, onClose, currentView, onSelect, ansichten = ANSICHTEN }: Props) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen || !anchorRef?.current) {
      setPos(null);
      return;
    }

    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const desiredWidth = Math.min(Math.max(rect.width, 180), 220);
      const left = rect.right - desiredWidth;
      const top = rect.bottom + 6;
      // keep some minimal padding from viewport edges
      const safeLeft = Math.max(8, Math.min(left, window.innerWidth - desiredWidth - 8));
      setPos({ top, left: safeLeft, width: desiredWidth });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isOpen, anchorRef]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (!isOpen) return;
      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen || !pos) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="view-dropdown__menu view-dropdown__portal"
      style={{ position: 'absolute', top: pos.top, left: pos.left, width: pos.width, zIndex: 5000 }}
      role="menu"
    >
      <ul style={{ listStyle: 'none', padding: 8, margin: 0 }}>
        {ansichten.map((v) => (
          <li key={v} style={{ marginBottom: 6 }}>
            <button
              type="button"
              className={`view-menu-item ${currentView === v ? 'active' : ''}`}
              onClick={() => {
                onSelect(v);
                onClose();
              }}
              aria-current={currentView === v}
            >
              {v}
            </button>
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  );
}
