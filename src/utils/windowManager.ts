export type ModelessSimulationId = '2d' | '3d' | 'orbit';

export interface WindowLayoutState {
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export type ModelessWindowsState = Record<ModelessSimulationId, WindowLayoutState>;

export const DEFAULT_WINDOW_LAYOUTS: ModelessWindowsState = {
  '2d': {
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    x: 40,
    y: 80,
    width: 680,
    height: 520,
    zIndex: 100,
  },
  '3d': {
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    x: 180,
    y: 120,
    width: 680,
    height: 520,
    zIndex: 101,
  },
  'orbit': {
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    x: 320,
    y: 160,
    width: 640,
    height: 480,
    zIndex: 102,
  },
};

/**
 * Clamp window coordinates to stay within user viewport.
 */
export function clampWindowPosition(
  x: number,
  y: number,
  viewportWidth: number = 1920,
  viewportHeight: number = 1080
): { x: number; y: number } {
  const maxX = Math.max(0, viewportWidth - 100);
  const maxY = Math.max(0, viewportHeight - 60);
  return {
    x: Math.min(maxX, Math.max(10, x)),
    y: Math.min(maxY, Math.max(10, y)),
  };
}

/**
 * Clamp window size within allowed bounds.
 */
export function clampWindowSize(
  width: number,
  height: number,
  minWidth = 380,
  minHeight = 280,
  maxWidth = 3840,
  maxHeight = 2160
): { width: number; height: number } {
  return {
    width: Math.min(maxWidth, Math.max(minWidth, width)),
    height: Math.min(maxHeight, Math.max(minHeight, height)),
  };
}

/**
 * Bring the target window to the top by incrementing highest z-index.
 */
export function bringWindowToFront(
  state: ModelessWindowsState,
  targetId: ModelessSimulationId
): ModelessWindowsState {
  const currentMaxZ = Math.max(...Object.values(state).map((w) => w.zIndex), 100);
  if (state[targetId].zIndex === currentMaxZ) {
    return state;
  }
  return {
    ...state,
    [targetId]: {
      ...state[targetId],
      zIndex: currentMaxZ + 1,
    },
  };
}

/**
 * Toggle open/closed (dock/undock) state for a window.
 */
export function toggleWindowOpen(
  state: ModelessWindowsState,
  targetId: ModelessSimulationId
): ModelessWindowsState {
  const willOpen = !state[targetId].isOpen;
  const currentMaxZ = Math.max(...Object.values(state).map((w) => w.zIndex), 100);
  return {
    ...state,
    [targetId]: {
      ...state[targetId],
      isOpen: willOpen,
      isMinimized: false,
      zIndex: willOpen ? currentMaxZ + 1 : state[targetId].zIndex,
    },
  };
}

/**
 * Close (dock back) a window.
 */
export function closeWindow(
  state: ModelessWindowsState,
  targetId: ModelessSimulationId
): ModelessWindowsState {
  return {
    ...state,
    [targetId]: {
      ...state[targetId],
      isOpen: false,
    },
  };
}

/**
 * Toggle minimize state.
 */
export function toggleWindowMinimize(
  state: ModelessWindowsState,
  targetId: ModelessSimulationId
): ModelessWindowsState {
  return {
    ...state,
    [targetId]: {
      ...state[targetId],
      isMinimized: !state[targetId].isMinimized,
    },
  };
}

/**
 * Toggle maximize state.
 */
export function toggleWindowMaximize(
  state: ModelessWindowsState,
  targetId: ModelessSimulationId
): ModelessWindowsState {
  return {
    ...state,
    [targetId]: {
      ...state[targetId],
      isMaximized: !state[targetId].isMaximized,
      isMinimized: false,
    },
  };
}
