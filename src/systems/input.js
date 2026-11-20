import { CONFIG } from '../config.js';

export function createInputController({
  canvas,
  runButton,
  biteButton,
  abilityButton,
  joyElement,
  onTogglePause,
  onCameraDrag,
  onCameraWheel,
}) {
  const keys = Object.create(null);
  const joy = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
  const look = { id: null, x: 0, y: 0 };
  const moveOut = { dx: 0, dz: 0, mag: 0 };

  let sprintButtonHeld = false;
  let wantBite = false;
  let wantAbility = false;

  const joyKnob = joyElement.firstElementChild;
  const maxJoy = CONFIG.simulation.joyMaxRadius;
  const deadzone = CONFIG.simulation.moveDeadzone;

  function onKeyDown(e) {
    const key = e.key.toLowerCase();
    keys[key] = true;
    if (e.key.startsWith('Arrow')) e.preventDefault();
    if (e.key === ' ') {
      wantBite = true;
      e.preventDefault();
    }
    if (key === 'q') {
      wantAbility = true;
    }
    if (e.key === 'Escape' || key === 'p') {
      onTogglePause();
    }
  }

  function onKeyUp(e) {
    keys[e.key.toLowerCase()] = false;
  }

  function onSprintDown() {
    sprintButtonHeld = true;
    runButton.classList.add('on');
  }

  function onSprintUp() {
    sprintButtonHeld = false;
    runButton.classList.remove('on');
  }

  function onBiteDown() {
    wantBite = true;
  }

  function onAbilityDown() {
    wantAbility = true;
  }

  function onCanvasPointerDown(e) {
    canvas.setPointerCapture(e.pointerId);
    if (e.pointerType !== 'mouse' && e.clientX < window.innerWidth * 0.5) {
      if (joy.active) return;
      joy.active = true;
      joy.id = e.pointerId;
      joy.ox = e.clientX;
      joy.oy = e.clientY;
      joy.dx = 0;
      joy.dy = 0;
      joyElement.style.display = 'block';
      joyElement.style.left = `${e.clientX}px`;
      joyElement.style.top = `${e.clientY}px`;
    } else if (look.id === null) {
      look.id = e.pointerId;
      look.x = e.clientX;
      look.y = e.clientY;
    }
  }

  function onCanvasPointerMove(e) {
    if (joy.active && e.pointerId === joy.id) {
      let dx = e.clientX - joy.ox;
      let dy = e.clientY - joy.oy;
      const m = Math.hypot(dx, dy);
      if (m > maxJoy) {
        dx *= maxJoy / m;
        dy *= maxJoy / m;
      }
      joy.dx = dx;
      joy.dy = dy;
      if (joyKnob) {
        joyKnob.style.transform = `translate(${dx}px,${dy}px)`;
      }
    }
    if (e.pointerId === look.id) {
      onCameraDrag(e.clientX - look.x, e.clientY - look.y);
      look.x = e.clientX;
      look.y = e.clientY;
    }
  }

  function onCanvasPointerUp(e) {
    if (joy.active && e.pointerId === joy.id) {
      joy.active = false;
      joy.id = null;
      joy.dx = 0;
      joy.dy = 0;
      joyElement.style.display = 'none';
      if (joyKnob) joyKnob.style.transform = '';
    }
    if (e.pointerId === look.id) {
      look.id = null;
      look.x = 0;
      look.y = 0;
    }
  }

  function onWheel(e) {
    onCameraWheel(e.deltaY);
    e.preventDefault();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  runButton.addEventListener('pointerdown', onSprintDown);
  runButton.addEventListener('pointerup', onSprintUp);
  runButton.addEventListener('pointercancel', onSprintUp);
  runButton.addEventListener('pointerleave', onSprintUp);
  biteButton.addEventListener('pointerdown', onBiteDown);
  if (abilityButton) {
    abilityButton.addEventListener('pointerdown', onAbilityDown);
  }
  canvas.addEventListener('pointerdown', onCanvasPointerDown);
  canvas.addEventListener('pointermove', onCanvasPointerMove);
  canvas.addEventListener('pointerup', onCanvasPointerUp);
  canvas.addEventListener('pointercancel', onCanvasPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  function getMoveInput(camYaw) {
    let dx = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0);
    let dz = (keys.arrowdown || keys.s ? 1 : 0) - (keys.arrowup || keys.w ? 1 : 0);
    if (joy.active) {
      dx = joy.dx / maxJoy;
      dz = joy.dy / maxJoy;
    }
    const cosY = Math.cos(camYaw);
    const sinY = Math.sin(camYaw);
    const ix = dx;
    const iz = dz;
    dx = ix * cosY + iz * sinY;
    dz = -ix * sinY + iz * cosY;

    let mag = Math.hypot(dx, dz);
    if (mag > 1) {
      dx /= mag;
      dz /= mag;
      mag = 1;
    }
    if (mag < deadzone) {
      mag = 0;
      dx = 0;
      dz = 0;
    }
    moveOut.dx = dx;
    moveOut.dz = dz;
    moveOut.mag = mag;
    return moveOut;
  }

  function clear() {
    for (const k in keys) {
      keys[k] = false;
    }
    joy.active = false;
    joy.id = null;
    joy.dx = 0;
    joy.dy = 0;
    look.id = null;
    sprintButtonHeld = false;
    wantBite = false;
    wantAbility = false;
    joyElement.style.display = 'none';
    if (joyKnob) joyKnob.style.transform = '';
    runButton.classList.remove('on');
  }

  return {
    keys,
    getMoveInput,
    isSprintHeld: () => sprintButtonHeld || !!keys.shift,
    consumeBite: () => {
      const requested = wantBite;
      wantBite = false;
      return requested;
    },
    consumeAbility: () => {
      const requested = wantAbility;
      wantAbility = false;
      return requested;
    },
    clear,
  };
}
