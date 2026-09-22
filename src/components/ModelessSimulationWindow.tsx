import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Minus, Square, Maximize2, Minimize2, X, Move } from 'lucide-react';

export interface ModelessWindowState {
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface ModelessSimulationWindowProps {
  id: string;
  title: string;
  icon?: React.ReactNode;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minWidth?: number;
  minHeight?: number;
  onClose: () => void;
  onToggleMinimize: () => void;
  onToggleMaximize: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  onFocus: () => void;
  children: React.ReactNode;
}

export const ModelessSimulationWindow: React.FC<ModelessSimulationWindowProps> = ({
  id,
  title,
  icon,
  isOpen,
  isMinimized,
  isMaximized,
  x,
  y,
  width,
  height,
  zIndex,
  minWidth = 380,
  minHeight = 280,
  onClose,
  onToggleMinimize,
  onToggleMaximize,
  onMove,
  onResize,
  onFocus,
  children,
}) => {
  const windowRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, initialX: 0, initialY: 0 });

  const isResizingRef = useRef(false);
  const resizeStartRef = useRef({ mouseX: 0, mouseY: 0, initialW: 0, initialH: 0 });

  // Handle dragging via pointer events on title bar
  const handleHeaderPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Ignore if clicking on control buttons inside header
      if ((e.target as HTMLElement).closest('button')) return;
      if (isMaximized) return;

      onFocus();
      isDraggingRef.current = true;
      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        initialX: x,
        initialY: y,
      };

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [isMaximized, onFocus, x, y]
  );

  const handleHeaderPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;

      // Keep within reasonable viewport bounds
      const maxX = Math.max(0, window.innerWidth - 100);
      const maxY = Math.max(0, window.innerHeight - 60);
      const newX = Math.min(maxX, Math.max(10, dragStartRef.current.initialX + dx));
      const newY = Math.min(maxY, Math.max(10, dragStartRef.current.initialY + dy));

      onMove(newX, newY);
    },
    [onMove]
  );

  const handleHeaderPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture might have already been released
      }
    }
  }, []);

  // Handle resizing via pointer events on bottom-right corner handle
  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isMaximized || isMinimized) return;
      onFocus();
      isResizingRef.current = true;
      resizeStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        initialW: width,
        initialH: height,
      };

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    },
    [height, isMaximized, isMinimized, onFocus, width]
  );

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isResizingRef.current) return;
      const dw = e.clientX - resizeStartRef.current.mouseX;
      const dh = e.clientY - resizeStartRef.current.mouseY;

      const maxW = Math.max(minWidth, window.innerWidth - x - 20);
      const maxH = Math.max(minHeight, window.innerHeight - y - 20);

      const newW = Math.min(maxW, Math.max(minWidth, resizeStartRef.current.initialW + dw));
      const newH = Math.min(maxH, Math.max(minHeight, resizeStartRef.current.initialH + dh));

      onResize(newW, newH);
    },
    [minHeight, minWidth, onResize, x, y]
  );

  const handleResizePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isResizingRef.current) {
      isResizingRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Released
      }
    }
  }, []);

  // Trigger resize events so inner Canvas / Three.js ResizeObservers update immediately
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen, isMinimized, isMaximized, width, height]);

  if (!isOpen) return null;

  // Compute inline styles based on position and maximized/minimized state
  const containerStyle: React.CSSProperties = isMaximized
    ? {
        position: 'fixed',
        top: '12px',
        left: '12px',
        right: '12px',
        bottom: '12px',
        width: 'auto',
        height: 'auto',
        zIndex,
      }
    : {
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: isMinimized ? 'auto' : `${height}px`,
        zIndex,
      };

  return (
    <div
      ref={windowRef}
      id={`modeless-window-${id}`}
      data-testid={`modeless-window-${id}`}
      role="dialog"
      aria-label={`${title} 비모달 윈도우`}
      aria-modal="false"
      onPointerDown={onFocus}
      style={containerStyle}
      className={`flex flex-col bg-[#0a0c14]/95 backdrop-blur-md rounded-lg border shadow-2xl transition-[border-color,box-shadow] select-none ${
        isMaximized ? 'border-cyan-500/50 shadow-cyan-950/40' : 'border-cyan-500/30 shadow-black/80'
      }`}
    >
      {/* Title Bar (Draggable) */}
      <div
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        onPointerCancel={handleHeaderPointerUp}
        className={`flex items-center justify-between px-3 py-2 border-b border-[#1f2438] bg-[#101424]/90 rounded-t-lg select-none ${
          isMaximized ? 'cursor-default' : 'cursor-move'
        }`}
        title={isMaximized ? title : `${title} (드래그하여 이동)`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-cyan-400 shrink-0">{icon || <Move className="w-3.5 h-3.5" />}</span>
          <span className="text-xs font-semibold text-slate-100 truncate font-mono">{title}</span>
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-800/40 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            비모달
          </span>
        </div>

        {/* Window Control Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Minimize / Restore */}
          <button
            type="button"
            onClick={onToggleMinimize}
            aria-label={isMinimized ? '창 복원' : '창 최소화'}
            title={isMinimized ? '창 복원' : '창 최소화 (접기)'}
            className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-[#1f253d] transition-colors"
          >
            {isMinimized ? <Square className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          </button>

          {/* Maximize / Restore */}
          <button
            type="button"
            onClick={onToggleMaximize}
            aria-label={isMaximized ? '이전 크기로 복원' : '창 최대화'}
            title={isMaximized ? '이전 크기로 복원' : '창 최대화'}
            className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-[#1f253d] transition-colors"
          >
            {isMaximized ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>

          {/* Dock / Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="메인 화면으로 도킹 복귀"
            title="메인 화면으로 도킹 복귀 (닫기)"
            className="p-1 rounded text-slate-400 hover:text-rose-300 hover:bg-rose-950/50 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Window Body Content */}
      {!isMinimized && (
        <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-[#06080e] select-auto">
          {children}

          {/* Resize Grip Handle (Bottom-Right Corner) */}
          {!isMaximized && (
            <div
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onPointerCancel={handleResizePointerUp}
              role="separator"
              aria-label="창 크기 조절"
              title="드래그하여 크기 조절"
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-50 flex items-center justify-center group"
            >
              <svg
                viewBox="0 0 16 16"
                className="w-3 h-3 text-slate-500 group-hover:text-cyan-300 transition-colors pointer-events-none"
              >
                <path d="M14 14H12V12H14V14ZM14 10H12V8H14V10ZM10 14H8V12H10V14Z" fill="currentColor" />
              </svg>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
