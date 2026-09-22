import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_WINDOW_LAYOUTS,
  clampWindowPosition,
  clampWindowSize,
  bringWindowToFront,
  toggleWindowOpen,
  closeWindow,
  toggleWindowMinimize,
  toggleWindowMaximize,
} from '../src/utils/windowManager';

test('clampWindowPosition keeps coordinates inside viewport', () => {
  const clampedNegative = clampWindowPosition(-50, -20, 1920, 1080);
  assert.equal(clampedNegative.x, 10);
  assert.equal(clampedNegative.y, 10);

  const clampedOverflow = clampWindowPosition(2500, 1500, 1920, 1080);
  assert.equal(clampedOverflow.x, 1820);
  assert.equal(clampedOverflow.y, 1020);

  const normal = clampWindowPosition(300, 200, 1920, 1080);
  assert.equal(normal.x, 300);
  assert.equal(normal.y, 200);
});

test('clampWindowSize respects minimum and maximum dimensions', () => {
  const tooSmall = clampWindowSize(200, 150, 380, 280, 1920, 1080);
  assert.equal(tooSmall.width, 380);
  assert.equal(tooSmall.height, 280);

  const tooLarge = clampWindowSize(3000, 2000, 380, 280, 1920, 1080);
  assert.equal(tooLarge.width, 1920);
  assert.equal(tooLarge.height, 1080);

  const valid = clampWindowSize(600, 450, 380, 280, 1920, 1080);
  assert.equal(valid.width, 600);
  assert.equal(valid.height, 450);
});

test('toggleWindowOpen opens window and raises z-index', () => {
  let state = { ...DEFAULT_WINDOW_LAYOUTS };
  assert.equal(state['2d'].isOpen, false);

  state = toggleWindowOpen(state, '2d');
  assert.equal(state['2d'].isOpen, true);
  assert.ok(state['2d'].zIndex >= 102);

  // Opening another window makes its z-index highest
  state = toggleWindowOpen(state, '3d');
  assert.equal(state['3d'].isOpen, true);
  assert.ok(state['3d'].zIndex > state['2d'].zIndex);

  // Toggling open window closes it
  state = toggleWindowOpen(state, '2d');
  assert.equal(state['2d'].isOpen, false);
});

test('bringWindowToFront elevates selected window to top z-index', () => {
  let state = { ...DEFAULT_WINDOW_LAYOUTS };
  state = toggleWindowOpen(state, '2d');
  state = toggleWindowOpen(state, '3d');
  assert.ok(state['3d'].zIndex > state['2d'].zIndex);

  // Focusing '2d' brings it to front
  state = bringWindowToFront(state, '2d');
  assert.ok(state['2d'].zIndex > state['3d'].zIndex);
});

test('minimize and maximize toggle states cleanly', () => {
  let state = { ...DEFAULT_WINDOW_LAYOUTS };
  state = toggleWindowOpen(state, 'orbit');
  assert.equal(state['orbit'].isMinimized, false);
  assert.equal(state['orbit'].isMaximized, false);

  // Minimize
  state = toggleWindowMinimize(state, 'orbit');
  assert.equal(state['orbit'].isMinimized, true);

  // Un-minimize
  state = toggleWindowMinimize(state, 'orbit');
  assert.equal(state['orbit'].isMinimized, false);

  // Maximize (should clear minimized)
  state = toggleWindowMinimize(state, 'orbit');
  assert.equal(state['orbit'].isMinimized, true);
  state = toggleWindowMaximize(state, 'orbit');
  assert.equal(state['orbit'].isMaximized, true);
  assert.equal(state['orbit'].isMinimized, false);

  // Close docks back
  state = closeWindow(state, 'orbit');
  assert.equal(state['orbit'].isOpen, false);
});
