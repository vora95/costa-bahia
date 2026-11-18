// Keyboard + pointer input. Keys are read every frame; actions are edge-triggered
// (takeActions consumes them once), movement is level-triggered.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;
export const ACTION_WEAPON_NEXT = 32;
export const ACTION_HANDBRAKE = 64;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM, Space: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE, Escape: ACTION_PAUSE,
  KeyE: ACTION_ENTER,
  KeyF: ACTION_PUNCH,
  KeyG: ACTION_SHOOT,
  KeyQ: ACTION_WEAPON_NEXT,
};

export function createInput(canvas) {
  const down = new Set();
  let queued = 0;
  let shootHeld = false;

  function onKey(e, isDown) {
    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) e.preventDefault();
    if (isDown) {
      if (!e.repeat && KEY_ACTIONS[code]) queued |= KEY_ACTIONS[code];
      if (code === 'KeyG') shootHeld = true;
      down.add(code);
    } else {
      if (code === 'KeyG') shootHeld = false;
      down.delete(code);
    }
  }
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  canvas.addEventListener('pointerdown', () => { queued |= ACTION_CONFIRM; });
  window.addEventListener('blur', () => { down.clear(); shootHeld = false; });

  function axis() {
    // {f: forward -1..1, s: strafe/right -1..1, run, handbrake}
    let f = 0; let s = 0;
    if (down.has('KeyW') || down.has('ArrowUp')) f += 1;
    if (down.has('KeyS') || down.has('ArrowDown')) f -= 1;
    if (down.has('KeyD') || down.has('ArrowRight')) s += 1;
    if (down.has('KeyA') || down.has('ArrowLeft')) s -= 1;
    return { f, s, run: down.has('ShiftLeft') || down.has('ShiftRight'), handbrake: down.has('Space'), shootHeld };
  }

  return {
    axis,
    get shootHeld() { return shootHeld; },
    takeActions() { const a = queued; queued = 0; return a; },
    isDown(code) { return down.has(code); },
  };
}
