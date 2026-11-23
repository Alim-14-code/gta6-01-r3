// Port Aurora — keyboard and mouse state.
// One job: turn raw browser events into a clean input snapshot the game reads.
export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  const pressed = new Set(); // keys pressed since the last consume

  function keyName(e) {
    // Lower-case every key so 'Enter', 'ArrowUp', 'Shift' and 'Escape' match
    // the names the game checks ('enter', 'arrowup', 'shift', 'escape').
    return e.key.toLowerCase();
  }

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(keyName(e));
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    keys,
    mouse,
    // True while any of the given keys is held.
    down(...names) {
      return names.some((n) => keys.has(n));
    },
    // True once per physical press; the press is consumed by reading it.
    wasPressed(name) {
      if (pressed.has(name)) { pressed.delete(name); return true; }
      return false;
    },
    // True once per mouse click; consumed by reading it.
    wasClicked() {
      if (mouse.clicked) { mouse.clicked = false; return true; }
      return false;
    },
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
  };
}
