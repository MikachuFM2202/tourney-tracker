// Serve practice: the 3D mini game on the CAT 3.0 page.
// A toy beach court in the WarranteeLah Blender-kit look (chunky rounded shapes, matte colours, warm sun,
// soft shadows). The player serves by swiping up: a faster swipe hits harder, a sideways lean aims.
// 5 levels of things to knock over on the far side, 2 minutes in total.
// three.js comes from jsDelivr through the import map in index.html. The pure physics below has no
// three.js in it, so it can be checked in node (see the bottom of this file).

export const P = {
  G: 9.81, K: 0.018, BR: 0.16, NET_H: 2.43, HALF_W: 4, LEN: 8,
  C: [0.85, 2.45, 9.0], /* where the hand meets the ball */
  TIME: 120
};

/* t: [kind, x, z, moving?] — far court is z from 0 (net) to -8 (baseline) */
export const LEVELS = [
  { name: 'Warm-up', guide: 1, wind: 0, t: [['bucket', -2, -4], ['bucket', 2, -4], ['bucket', 0, -6.5]] },
  { name: 'Bottle row', guide: 1, wind: 0, t: [['bottle', -3, -5], ['bottle', -1.5, -5], ['bottle', 0, -5], ['bottle', 1.5, -5], ['bottle', 3, -5]] },
  { name: 'Corners', guide: 0.55, wind: 0, t: [['cone', -3.3, -7.3], ['cone', 3.3, -7.3], ['can', -3.1, -2.9], ['can', 3.1, -2.9]] },
  { name: 'Sea breeze', guide: 0.3, wind: 1, t: [['bottle', -2, -6], ['bottle', 2, -3.4], ['cooler', 0, -5, { amp: 2.8, speed: 0.7 }], ['can', -3, -7.4]] },
  { name: 'Pro serve', guide: 0, wind: 1.4, t: [['bottle', -3.2, -7.5], ['bottle', 3.2, -7.5], ['can', 0, -2.9, { amp: 2.4, speed: 0.9 }], ['bottle', 0, -6.8, { amp: 2.8, speed: 0.75 }], ['can', -1.6, -4.8]] }
];
export const KINDS = { bottle: { r: 0.24, h: 1.05 }, can: { r: 0.22, h: 0.46 }, bucket: { r: 0.42, h: 0.52 }, cone: { r: 0.3, h: 0.62 }, cooler: { r: 0.46, h: 0.56 } };

/* swipe power p: 0 = softest serve that still goes forward, 1 = hardest that lands near the baseline */
/* a straight swipe heads for the middle of the far court, not straight ahead of the hand */
var AIM0 = Math.atan2(-P.C[0], P.C[2] + 5);
export function launch(p, yaw) {
  yaw += AIM0;
  var v = 9 + 7.5 * p, el = (38 - 18 * p) * Math.PI / 180, h = v * Math.cos(el);
  return [h * Math.sin(yaw), v * Math.sin(el), -h * Math.cos(yaw)];
}
export function stepBall(b, dt, wind) {
  var s = Math.hypot(b.v[0], b.v[1], b.v[2]);
  b.v[0] += (-P.K * s * b.v[0] + wind) * dt;
  b.v[1] += (-P.K * s * b.v[1] - P.G) * dt;
  b.v[2] += -P.K * s * b.v[2] * dt;
  b.p[0] += b.v[0] * dt; b.p[1] += b.v[1] * dt; b.p[2] += b.v[2] * dt;
}
/* the ball crosses the net plane this step: true when it hits the net */
export function netHit(z0, b) { return z0 > 0 && b.p[2] <= 0 && Math.abs(b.p[0]) < P.HALF_W + 0.6 && b.p[1] < P.NET_H + P.BR * 0.5; }
export function landing(x, z) { return Math.abs(x) > P.HALF_W ? 'wide' : z < -P.LEN ? 'long' : z > 0 ? 'net' : 'in'; }
/* the path the ball will take if served now, for the dotted line */
export function predict(p, yaw, wind) {
  var b = { p: P.C.slice(), v: launch(p, yaw) }, pts = [b.p.slice()], dt = 1 / 120, res = null;
  for (var i = 0; i < 600 && !res; i++) {
    var z0 = b.p[2];
    stepBall(b, dt, wind);
    if (netHit(z0, b)) { b.p[2] = 0; res = 'net'; }
    else if (b.p[1] <= P.BR) { b.p[1] = P.BR; res = landing(b.p[0], b.p[2]); }
    if (i % 3 === 2 || res) pts.push(b.p.slice());
  }
  return { pts: pts, res: res || 'long', land: b.p.slice() };
}

export async function mount(root, store) {
  var THREE, RoundedBoxGeometry;
  try {
    THREE = await import('three');
    RoundedBoxGeometry = (await import('three/addons/geometries/RoundedBoxGeometry.js')).RoundedBoxGeometry;
  } catch (e) { root.querySelector('.s3d-load').textContent = 'The game could not load. Check the connection and reload the page.'; return; }

  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = matchMedia('(pointer: coarse)').matches;
  var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  /* ---------- DOM: canvas, heads-up display, panels ---------- */
  root.textContent = '';
  var canvas = el('canvas'); canvas.setAttribute('aria-label', 'Serve practice game. Swipe up on the court to serve.');
  var hud = el('div', 's3d-hud');
  var top = el('div', 's3d-top'), lvEl = el('span', 's3d-chip', ''), tmEl = el('span', 's3d-chip tm', '2:00'), scEl = el('span', 's3d-chip', '0');
  top.append(lvEl, tmEl, scEl);
  var sub = el('div', 's3d-sub'), dotsEl = el('span', 's3d-left'), windEl = el('span', 's3d-chip wind');
  sub.append(dotsEl, windEl);
  var tools = el('div', 's3d-tools');
  function toolBtn(label, on, key) {
    var b = el('button', 's3d-tool'); b.type = 'button'; b.setAttribute('aria-label', label);
    b.setAttribute('aria-pressed', String(on)); b.title = label;
    b.addEventListener('click', function () { var v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(v)); if (key) store.set(key, v ? '' : 'off'); paintTools(); });
    return b;
  }
  var sndBtn = toolBtn('Sound', store.get('cat.serve.snd') !== 'off', 'cat.serve.snd');
  var hapBtn = toolBtn('Vibration', store.get('cat.serve.hap') !== 'off', 'cat.serve.hap');
  var fullBtn = toolBtn('Full screen', false, null);
  function paintTools() {
    sndBtn.textContent = sndBtn.getAttribute('aria-pressed') === 'true' ? '🔊' : '🔇';
    hapBtn.textContent = hapBtn.getAttribute('aria-pressed') === 'true' ? '📳' : '📴';
    fullBtn.textContent = root.classList.contains('full') ? '✕' : '⛶';
  }
  function setFull(on) {
    root.classList.toggle('full', on); document.body.classList.toggle('s3d-lock', on);
    fullBtn.setAttribute('aria-pressed', String(on)); paintTools(); fit();
  }
  fullBtn.addEventListener('click', function () { setFull(!root.classList.contains('full')); });
  /* leaving the page (back button, a link) must not leave the site unable to scroll */
  addEventListener('hashchange', function () { setTimeout(function () { if (!root.isConnected) { setFull(false); pause(); } }); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && root.classList.contains('full')) fullBtn.click(); });
  tools.append(sndBtn, hapBtn, fullBtn); paintTools();
  var power = el('div', 's3d-power'), powerFill = el('i'); power.append(powerFill, el('b', null, 'Power'));
  var msgEl = el('p', 's3d-msg'); msgEl.setAttribute('role', 'status');
  hud.append(top, sub, tools, power, msgEl);
  var panel = el('div', 's3d-panel'), pops = el('div', 's3d-pops');
  /* iPhone Safari has no vibrate(); toggling a switch input gives a light tap of haptic feedback there */
  var hapLabel = el('label', 's3d-hap'), hapIn = el('input'); hapIn.type = 'checkbox'; hapIn.setAttribute('switch', ''); hapIn.tabIndex = -1;
  hapLabel.setAttribute('aria-hidden', 'true'); hapLabel.append(hapIn);
  root.append(canvas, hud, pops, panel, hapLabel);

  /* ---------- feedback: vibration and sound ---------- */
  function buzz(pattern) {
    if (hapBtn.getAttribute('aria-pressed') !== 'true') return;
    if (navigator.vibrate) navigator.vibrate(pattern); else hapLabel.click();
  }
  var ac = null;
  function audio() {
    if (sndBtn.getAttribute('aria-pressed') !== 'true') return null;
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { return null; }
    return ac;
  }
  function tone(type, f0, f1, dur, vol, delay) {
    var a = audio(); if (!a) return;
    var t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  var noiseBuf = null;
  function noise(f0, f1, dur, vol, q) {
    var a = audio(); if (!a) return;
    if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate); var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    var t = a.currentTime, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(a.destination); s.start(t); s.stop(t + dur + 0.02);
  }
  var SFX = {
    serve: function (p) { tone('sine', 180, 70, 0.12, 0.5); noise(600, 2400 + 1600 * p, 0.25, 0.25, 0.8); },
    clink: function (k) { tone('triangle', 1700 + k * 260, 1500, 0.35, 0.22); tone('sine', 2600 + k * 300, 2300, 0.25, 0.12, 0.02); },
    thud: function () { tone('sine', 140, 50, 0.2, 0.45); noise(300, 120, 0.2, 0.25); },
    net: function () { noise(400, 150, 0.3, 0.35, 0.6); tone('sine', 110, 60, 0.25, 0.3); },
    sand: function () { noise(900, 300, 0.18, 0.18, 0.7); },
    tick: function () { tone('square', 1200, 1100, 0.04, 0.06); },
    level: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone('triangle', f, f, 0.18, 0.18, i * 0.09); }); },
    whistle: function () { tone('sine', 2300, 2100, 0.5, 0.18); tone('sine', 2340, 2150, 0.5, 0.1); }
  };

  /* ---------- renderer and scene ---------- */
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { root.append(el('p', 's3d-load', 'This device cannot show the 3D game.')); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  var CAM = new THREE.Vector3(-0.5, 5.4, 14.6), LOOK = new THREE.Vector3(0.3, 0.6, -4.2);

  function canvasTex(w, h, draw, rep) {
    var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 4; }
    return t;
  }
  scene.background = canvasTex(2, 256, function (x, w, h) {
    var g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#6fbde8'); g.addColorStop(0.62, '#cfe9f3'); g.addColorStop(1, '#fbeedb');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  scene.fog = new THREE.Fog(0xf3e6d0, 40, 110);
  scene.add(new THREE.HemisphereLight(0xfff1de, 0x8a7458, 0.95));
  var sun = new THREE.DirectionalLight(0xffe2bf, 2.4);
  sun.position.set(7, 15, 9); sun.target.position.set(0, 0, -2);
  sun.castShadow = true; sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 14, bottom: -14, near: 1, far: 50 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  var fill = new THREE.DirectionalLight(0xc9dcff, 0.45); fill.position.set(-8, 6, 4); scene.add(fill);

  var mat = function (color, o) { return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.85, metalness: 0 }, o || {})); };
  function mesh(geo, m, x, y, z, parent, shadow) {
    var o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0);
    o.castShadow = shadow !== false; o.receiveShadow = true; (parent || scene).add(o); return o;
  }
  var rbox = function (w, h, d, r) { return new RoundedBoxGeometry(w, h, d, 3, r || Math.min(w, h, d) * 0.22); };

  /* sand, sea, shore */
  var sandTex = canvasTex(256, 256, function (x, w, h) {
    x.fillStyle = '#ead1a0'; x.fillRect(0, 0, w, h);
    for (var i = 0; i < 2600; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(160,120,70,.18)' : 'rgba(255,255,255,.25)'; x.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6); }
  }, [18, 18]);
  var sand = mesh(new THREE.PlaneGeometry(90, 90), mat(0xffffff, { map: sandTex, roughness: 1 }), 0, 0, 0, scene, false);
  sand.rotation.x = -Math.PI / 2;
  var sea = mesh(new THREE.PlaneGeometry(240, 80), mat(0x2aa6c4, { roughness: 0.35, metalness: 0.05 }), 0, 0.02, -62, scene, false);
  sea.rotation.x = -Math.PI / 2;
  var foam = mesh(new THREE.PlaneGeometry(240, 1.2), mat(0xf4fbfb, { roughness: 0.6 }), 0, 0.03, -22.4, scene, false);
  foam.rotation.x = -Math.PI / 2;

  /* court lines (blue tape), net, posts, antennas */
  var tape = mat(0x2f6fe0, { roughness: 0.6 });
  [[0, -8, 8.1, 0.08], [0, 8, 8.1, 0.08], [-4, 0, 0.08, 16], [4, 0, 0.08, 16]].forEach(function (l) {
    mesh(new THREE.BoxGeometry(l[2], 0.02, l[3]), tape, l[0], 0.01, l[1], scene, false);
  });
  var post = mat(0xf2ede2), pad = mat(0xe8573c);
  [-4.9, 4.9].forEach(function (x) {
    mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.65, 16), post, x, 1.32, 0);
    mesh(rbox(0.26, 1.3, 0.26, 0.1), pad, x, 0.7, 0);
  });
  var netTex = canvasTex(64, 64, function (x, w, h) {
    /* an alpha map reads brightness: white cords on black holes */
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.strokeStyle = '#fff'; x.lineWidth = 6; x.strokeRect(0, 0, w, h);
  }, [86, 10]);
  netTex.colorSpace = THREE.NoColorSpace;
  var netMesh = mesh(new THREE.PlaneGeometry(9.6, 1), new THREE.MeshStandardMaterial({ color: 0x1b1f2a, alphaMap: netTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 1 }), 0, P.NET_H - 0.5, 0, scene, false);
  mesh(new THREE.BoxGeometry(9.8, 0.07, 0.03), mat(0xfafafa), 0, P.NET_H - 0.035, 0);
  mesh(new THREE.BoxGeometry(9.8, 0.05, 0.03), mat(0xfafafa), 0, P.NET_H - 1, 0, scene, false);
  [-4, 4].forEach(function (x) {
    for (var i = 0; i < 8; i++) mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8), mat(i % 2 ? 0xffffff : 0xe23b3b), x, P.NET_H + 0.05 + i * 0.1, 0, scene, false);
  });

  /* palms, umbrella, cooler bags: scenery only */
  var trunkM = mat(0x9b6b43), leafM = mat(0x3f9a4f), leafM2 = mat(0x2f8243);
  function palm(x, z, lean) {
    var g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.z = lean; scene.add(g);
    for (var i = 0; i < 6; i++) mesh(new THREE.CylinderGeometry(0.2 - i * 0.015, 0.23 - i * 0.015, 0.9, 8), trunkM, Math.sin(i * 0.4) * 0.15 * i, 0.45 + i * 0.85, 0, g);
    for (var k = 0; k < 7; k++) {
      var leaf = mesh(rbox(0.5, 0.08, 2.4, 0.04), k % 2 ? leafM : leafM2, 0, 0, 1.1, null);
      var piv = new THREE.Group(); piv.position.set(Math.sin(5 * 0.4) * 0.75, 5.2, 0); piv.rotation.y = k / 7 * Math.PI * 2; piv.rotation.x = 0;
      var tilt = new THREE.Group(); tilt.rotation.x = 0.45; tilt.add(leaf); piv.add(tilt); g.add(piv);
    }
    mesh(new THREE.SphereGeometry(0.22, 12, 8), mat(0x6b4a2a), Math.sin(2) * 0.75, 5.05, 0.15, g);
  }
  palm(-9.5, -6, 0.12); palm(10.5, -11, -0.1); palm(-12, 4, 0.05); palm(12.5, 2, -0.14); palm(-15, -16, 0.08);
  var umb = new THREE.Group(); umb.position.set(8.6, 0, 6); scene.add(umb);
  mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8), post, 0, 1.2, 0, umb);
  for (var u = 0; u < 8; u++) {
    var seg = mesh(new THREE.ConeGeometry(1.5, 0.6, 3, 1, true, u * Math.PI / 4, Math.PI / 4), mat(u % 2 ? 0xffffff : 0xf0a830, { side: THREE.DoubleSide }), 0, 2.45, 0, umb);
    seg.castShadow = true;
  }
  mesh(rbox(1.2, 0.18, 2, 0.08), mat(0x2f7cf6), 7.6, 0.09, 7.2);

  /* wind flag on a pole behind the far baseline */
  var flagPole = mesh(new THREE.CylinderGeometry(0.04, 0.05, 3.6, 8), post, 5.8, 1.8, -9.6);
  var flag = new THREE.Group(); flag.position.set(5.8, 3.3, -9.6); scene.add(flag);
  var flagCloth = mesh(new THREE.BoxGeometry(0.9, 0.5, 0.02), mat(0xe23b3b), 0.45, 0, 0, flag);
  flagPole.visible = flag.visible = false;

  /* the server: a chunky toy player seen from behind */
  var skin = mat(0xc98d62), jersey = mat(0x2f7cf6), shorts = mat(0x1f2a44);
  var me = new THREE.Group(); me.position.set(0.55, 0, 9.25); scene.add(me);
  [-0.13, 0.13].forEach(function (x) { mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 10), skin, x, 0.36, 0, me); });
  mesh(rbox(0.48, 0.3, 0.3, 0.1), shorts, 0, 0.78, 0, me);
  var torso = mesh(rbox(0.54, 0.62, 0.32, 0.12), jersey, 0, 1.22, 0, me);
  mesh(rbox(0.5, 0.06, 0.33, 0.02), mat(0xffffff), 0, 1.3, 0, me);
  mesh(new THREE.SphereGeometry(0.2, 20, 14), skin, 0, 1.73, 0, me);
  var hair = mesh(new THREE.SphereGeometry(0.215, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(0x2b1d14), 0, 1.75, 0.01, me);
  hair.rotation.x = 0.35;
  var lArm = new THREE.Group(); lArm.position.set(-0.32, 1.45, 0); me.add(lArm);
  mesh(new THREE.CapsuleGeometry(0.075, 0.45, 4, 10), skin, 0, -0.28, 0, lArm); lArm.rotation.z = -0.25;
  var rArm = new THREE.Group(); rArm.position.set(0.32, 1.45, 0); me.add(rArm);
  mesh(new THREE.CapsuleGeometry(0.075, 0.45, 4, 10), skin, 0, 0.3, 0, rArm);
  var ARM_COCK = 0.95, ARM_HIT = -1.5;
  rArm.rotation.x = ARM_COCK;

  /* the ball, painted like a beach ball in yellow and blue */
  var ballTex = canvasTex(256, 128, function (x, w, h) {
    x.fillStyle = '#fbf6ea'; x.fillRect(0, 0, w, h);
    ['#f3c32f', '#1d5fbf', '#f3c32f'].forEach(function (c, i) {
      x.fillStyle = c; x.beginPath();
      for (var X = 0; X <= w; X += 4) x.lineTo(X, 18 + i * 34 + Math.sin(X / w * Math.PI * 6 + i) * 9);
      for (X = w; X >= 0; X -= 4) x.lineTo(X, 36 + i * 34 + Math.sin(X / w * Math.PI * 6 + i) * 9);
      x.fill();
    });
  });
  var ball = mesh(new THREE.SphereGeometry(P.BR, 28, 20), mat(0xffffff, { map: ballTex, roughness: 0.55 }), P.C[0], P.C[1], P.C[2]);
  var blob = mesh(new THREE.CircleGeometry(P.BR * 1.3, 24), new THREE.MeshBasicMaterial({ color: 0x5a4020, transparent: true, opacity: 0.25, depthWrite: false }), 0, 0.015, 0, scene, false);
  blob.rotation.x = -Math.PI / 2;

  /* dotted line: what the serve will do. The trail shows the path the last serve took. */
  var DOTS = 90;
  function dotMesh(color, opacity) {
    var m = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, depthWrite: false }), DOTS);
    m.count = 0; m.frustumCulled = false; scene.add(m); return m;
  }
  var guideDots = dotMesh(0xffffff, 0.95), trailDots = dotMesh(0xffe28a, 0.6);
  var ring = mesh(new THREE.RingGeometry(0.28, 0.38, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }), 0, 0.03, 0, scene, false);
  ring.rotation.x = -Math.PI / 2; ring.visible = false;
  var tmpM = new THREE.Matrix4();
  function placeDots(m, pts, frac) {
    var total = 0, i, out = [];
    for (i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
    var limit = total * frac, next = 0, run = 0;
    for (i = 1; i < pts.length && out.length < DOTS; i++) {
      var a = pts[i - 1], b = pts[i], d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      while (next <= run + d && next <= limit && out.length < DOTS) {
        var t = d ? (next - run) / d : 0; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); next += 0.32;
      }
      run += d;
    }
    out.forEach(function (q, k) { tmpM.makeTranslation(q[0], q[1], q[2]); m.setMatrixAt(k, tmpM); });
    m.count = out.length; m.instanceMatrix.needsUpdate = true;
  }

  /* ---------- targets ---------- */
  var bottleCols = [0x3fae6a, 0x2f9fd0, 0x8a5a2b, 0x46c08a];
  function makeTarget(kind, k) {
    var g = new THREE.Group(), m;
    if (kind === 'bottle') {
      m = mat(bottleCols[k % bottleCols.length], { roughness: 0.25 });
      mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.62, 20), m, 0, 0.31, 0, g);
      mesh(new THREE.CylinderGeometry(0.08, 0.22, 0.2, 20), m, 0, 0.72, 0, g);
      mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 14), m, 0, 0.92, 0, g);
      mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.07, 14), mat(0xf0f0f0), 0, 1.03, 0, g);
      mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.2, 20), mat(0xfbf3e0), 0, 0.34, 0, g);
    } else if (kind === 'can') {
      mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.4, 22), mat([0xe23b3b, 0xf0a830, 0x7a4fd6][k % 3], { roughness: 0.35, metalness: 0.2 }), 0, 0.23, 0, g);
      [0.02, 0.44].forEach(function (y) { mesh(new THREE.CylinderGeometry(0.185, 0.2, 0.04, 22), mat(0xcfd4da, { roughness: 0.3, metalness: 0.6 }), 0, y, 0, g); });
    } else if (kind === 'bucket') {
      mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.52, 24), mat([0xf07a2f, 0x2f7cf6, 0xe0478a][k % 3]), 0, 0.26, 0, g);
      var hd = mesh(new THREE.TorusGeometry(0.36, 0.025, 6, 24, Math.PI), mat(0xf6f1e4), 0, 0.5, 0, g); hd.rotation.y = 0.5;
    } else if (kind === 'cone') {
      mesh(new THREE.ConeGeometry(0.28, 0.62, 20), mat(0xf26b21), 0, 0.31, 0, g);
      mesh(new THREE.CylinderGeometry(0.14, 0.19, 0.12, 20), mat(0xffffff), 0, 0.33, 0, g);
      mesh(rbox(0.64, 0.05, 0.64, 0.02), mat(0xf26b21), 0, 0.025, 0, g);
    } else {
      mesh(rbox(0.9, 0.44, 0.56, 0.1), mat(0x2f8fd8), 0, 0.22, 0, g);
      mesh(rbox(0.94, 0.12, 0.6, 0.05), mat(0xf6f6f2), 0, 0.5, 0, g);
    }
    scene.add(g); return g;
  }
  var targets = [];
  function clearTargets() { targets.forEach(function (t) { scene.remove(t.obj); }); targets = []; }
  function spawnLevel(i) {
    clearTargets();
    LEVELS[i].t.forEach(function (d, k) {
      var spec = KINDS[d[0]], obj = makeTarget(d[0], k);
      obj.position.set(d[1], 0, d[2]);
      targets.push({ kind: d[0], obj: obj, r: spec.r, h: spec.h, x: d[1], z: d[2], bx: d[1], move: d[3] || null, phase: k * 1.7, alive: true, fall: null });
    });
    windNow = 0; newWind();
  }

  /* ---------- particles: sand puffs and confetti ---------- */
  var parts = [], partGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
  var partMats = [0xead1a0, 0xf3c32f, 0x2f7cf6, 0xe8573c, 0x3fae6a, 0xffffff].map(function (c) { return new THREE.MeshBasicMaterial({ color: c }); });
  function burst(x, y, z, n, kind) {
    for (var i = 0; i < n; i++) {
      var p = parts.length < 140 ? new THREE.Mesh(partGeo, partMats[0]) : parts.shift().m;
      p.material = kind === 'sand' ? partMats[0] : partMats[1 + (i % 5)];
      p.position.set(x, y, z); p.visible = true; scene.add(p);
      var sp = kind === 'sand' ? 1.6 : 3.2;
      parts.push({ m: p, v: [(Math.random() - 0.5) * sp, Math.random() * sp + (kind === 'sand' ? 0.8 : 2), (Math.random() - 0.5) * sp], life: kind === 'sand' ? 0.6 : 1.2, max: kind === 'sand' ? 0.6 : 1.2 });
    }
  }
  function updParts(dt) {
    for (var i = parts.length - 1; i >= 0; i--) {
      var q = parts[i]; q.life -= dt;
      if (q.life <= 0) { scene.remove(q.m); parts.splice(i, 1); continue; }
      q.v[1] -= 9 * dt; q.m.position.x += q.v[0] * dt; q.m.position.y = Math.max(0.03, q.m.position.y + q.v[1] * dt); q.m.position.z += q.v[2] * dt;
      q.m.rotation.x += 6 * dt; q.m.rotation.y += 4 * dt; q.m.scale.setScalar(Math.max(0.05, q.life / q.max));
    }
  }

  /* ---------- game state ---------- */
  var state = 'menu', level = 0, score = 0, timeLeft = P.TIME, serves = 0, hitsTotal = 0, cleared = 0;
  var best = +store.get('cat.serve.best') || 0;
  var windNow = 0, banner = 0, shake = 0, clock = 0, lastTick = -1;
  var shot = null; /* { p, v, z0, res, hits, ground, settle, trail } */
  var swing = 0; /* arm swing time left */
  var drag = null; /* { x0, y0, s: [{x,y,t}], p, yaw } */
  var msgTimer = 0;

  function newWind() {
    var w = LEVELS[level].wind;
    windNow = w ? (Math.random() < 0.5 ? -1 : 1) * w * (0.6 + Math.random() * 0.6) : 0;
    flagPole.visible = flag.visible = !!w;
    windEl.hidden = !w;
    windEl.textContent = 'Wind ' + (windNow < 0 ? '← ' : '→ ') + Math.abs(windNow).toFixed(1);
  }
  function say(t, secs) { msgEl.textContent = t; msgEl.classList.toggle('on', !!t); msgTimer = secs || 1.6; }
  function fmt(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); }
  function paintHud() {
    lvEl.textContent = 'Level ' + (level + 1) + '/5 · ' + LEVELS[level].name;
    tmEl.textContent = fmt(timeLeft); tmEl.classList.toggle('low', timeLeft <= 10);
    scEl.textContent = String(score);
    dotsEl.textContent = '';
    targets.forEach(function (t) { dotsEl.append(el('i', t.alive ? '' : 'gone')); });
  }
  function popAt(x, y, z, text) {
    var v = new THREE.Vector3(x, y, z).project(camera), r = canvas.getBoundingClientRect();
    var p = el('span', 's3d-pop', text);
    p.style.left = ((v.x + 1) / 2 * r.width) + 'px'; p.style.top = ((1 - v.y) / 2 * r.height) + 'px';
    pops.append(p); setTimeout(function () { p.remove(); }, 1000);
  }

  function showPanel(kind) {
    panel.textContent = ''; panel.hidden = false;
    var box = el('div', 's3d-card'), btn = el('button', 's3d-go'); btn.type = 'button';
    if (kind === 'menu') {
      box.append(el('p', 's3d-k', 'Serve practice'), el('h3', null, 'Knock them all over'),
        el('p', null, (coarse ? 'Swipe up' : 'Drag up') + ' on the court to serve. The faster the swipe, the harder the hit. Lean the swipe left or right to aim.'),
        el('p', null, '5 levels, 2 minutes. The dotted line shows where the ball goes, and fades out in the later levels.'));
      btn.textContent = 'Start'; btn.onclick = startGame;
      if (best) box.append(el('p', 's3d-best', 'Best score: ' + best));
    } else if (kind === 'pause') {
      box.append(el('p', 's3d-k', 'Paused'), el('h3', null, fmt(timeLeft) + ' left'), el('p', null, 'Level ' + (level + 1) + ' · ' + score + ' points'));
      btn.textContent = 'Carry on'; btn.onclick = resume;
    } else {
      var all = cleared === LEVELS.length;
      box.append(el('p', 's3d-k', all ? 'All 5 levels done' : 'Time!'), el('h3', null, score + ' points'),
        el('p', null, cleared + ' of 5 levels cleared · ' + hitsTotal + ' knocked over with ' + serves + ' serves' + (serves ? ' (' + Math.round(hitsTotal / serves * 100) + '% per serve)' : '') + '.'),
        el('p', 's3d-best', score >= best && score ? 'New best score!' : 'Best score: ' + best));
      btn.textContent = 'Play again'; btn.onclick = startGame;
    }
    box.append(btn); panel.append(box);
    setTimeout(function () { if (!panel.hidden) btn.focus({ preventScroll: true }); }, 50);
  }
  function hidePanel() { panel.hidden = true; panel.textContent = ''; }

  function readyBall() {
    shot = null; ball.position.set(P.C[0], P.C[1], P.C[2]); rArm.rotation.x = ARM_COCK;
    if (LEVELS[level].wind) newWind();
  }
  function startGame() {
    audio(); buzz(10);
    level = 0; score = 0; timeLeft = P.TIME; serves = 0; hitsTotal = 0; cleared = 0; lastTick = -1;
    trailDots.count = 0; hidePanel(); spawnLevel(0); readyBall();
    state = 'banner'; banner = 1.3; say('Level 1 · ' + LEVELS[0].name, 1.3); paintHud(); loop();
  }
  function pause() {
    if (state !== 'play' && state !== 'banner') return;
    state = 'paused'; drag = null; guideDots.count = 0; ring.visible = false; power.classList.remove('on'); showPanel('pause');
  }
  function resume() { hidePanel(); state = 'play'; buzz(10); loop(); }
  function endGame() {
    readyBall();
    state = 'over'; drag = null; guideDots.count = 0; ring.visible = false; power.classList.remove('on');
    if (cleared === LEVELS.length) { var bonus = Math.ceil(timeLeft) * 10; score += bonus; if (bonus) say('Time bonus +' + bonus, 2); }
    var wasBest = best;
    if (score > best) { best = score; store.set('cat.serve.best', String(best)); }
    SFX.whistle(); buzz([40, 60, 40, 60, 120]); paintHud(); showPanel('over');
    if (score > wasBest && score) burst(0, 2, 6, 40, 'confetti');
  }

  /* ---------- swipe to serve ---------- */
  function swipeState() {
    var s = drag.s, last = s[s.length - 1], i = s.length - 1;
    while (i > 0 && last.t - s[i - 1].t < 110) i--;
    var first = s[i], dt = Math.max(16, last.t - first.t), H = canvas.clientHeight || 400;
    var up = (first.y - last.y) / dt * 1000 / H; /* canvas heights per second, upwards */
    var dx = last.x - drag.x0, dy = drag.y0 - last.y;
    drag.p = Math.max(-0.1, Math.min(1.25, (up - 0.9) / 5.4));
    drag.yaw = Math.max(-0.42, Math.min(0.42, Math.atan2(dx, Math.max(8, dy)) * 0.7));
    drag.ok = dy > H * 0.06 && up > 0.4;
  }
  canvas.addEventListener('pointerdown', function (ev) {
    if (state !== 'play' || shot || drag) return;
    ev.preventDefault(); audio();
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
    drag = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, s: [{ x: ev.clientX, y: ev.clientY, t: ev.timeStamp }], p: 0, yaw: 0, ok: false };
    buzz(5);
  });
  canvas.addEventListener('pointermove', function (ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    drag.s.push({ x: ev.clientX, y: ev.clientY, t: ev.timeStamp });
    if (drag.s.length > 40) drag.s.shift();
    swipeState();
  });
  function endDrag(ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    var d = drag; drag = null; guideDots.count = 0; ring.visible = false; power.classList.remove('on');
    if (ev.type === 'pointercancel' || state !== 'play') return;
    if (d.s.length < 2) { say(coarse ? 'Swipe up to serve' : 'Drag up to serve', 1.4); return; }
    /* a finger that stopped before lifting has lost its speed */
    if (ev.timeStamp - d.s[d.s.length - 1].t > 90) { d.s.push({ x: ev.clientX, y: ev.clientY, t: ev.timeStamp }); drag = d; swipeState(); drag = null; }
    if (!d.ok) { say('Swipe up faster to serve', 1.4); return; }
    serve(d.p, d.yaw);
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  function serve(p, yaw) {
    serves++; swing = 0.22;
    root.dataset.serve = p.toFixed(2) + ' ' + yaw.toFixed(2); /* for testing */
    shot = { p: P.C.slice(), v: launch(p, yaw), res: null, hits: 0, ground: 0, settle: 0, trail: [P.C.slice()], tick: 0 };
    SFX.serve(Math.max(0, p)); buzz(Math.round(12 + 22 * Math.max(0, Math.min(1, p))));
  }
  function knock(t, bv) {
    t.alive = false; shot.hits++; hitsTotal++;
    var dir = Math.atan2(bv[0], -bv[2]);
    t.fall = { t: 0, dir: dir, dx: Math.sin(dir) * 0.7, dz: -Math.cos(dir) * 0.7, x0: t.obj.position.x, z0: t.obj.position.z, spin: (Math.random() - 0.5) * 1.5 };
    var n = shot.hits, pts = 100 * n * n - 100 * (n - 1) * (n - 1); /* 1 hit 100, 2 hits 400, 3 hits 900 */
    score += pts;
    say(n > 1 ? (n === 2 ? 'Double!' : 'Combo!') : 'Nice hit!', 1.2);
    SFX.clink(n); buzz(n > 1 ? [25, 40, 25, 40, 25] : [25, 40, 25]);
    burst(t.obj.position.x, t.h * 0.7, t.obj.position.z, 18, 'confetti');
    popAt(t.obj.position.x, t.h + 0.4, t.obj.position.z, n > 1 ? (n === 2 ? 'Double! +' : 'Combo! +') + pts : '+' + pts);
    if (!still) shake = 0.18;
    paintHud();
  }
  function stepShot(dt) {
    var b = shot, z0 = b.p[2], sp;
    stepBall(b, dt, windNow);
    if (netHit(z0, b)) {
      b.p[2] = P.BR; b.v[2] = Math.abs(b.v[2]) * 0.22; b.v[0] *= 0.3; b.v[1] = Math.min(b.v[1], 0);
      if (!b.res) { b.res = 'net'; SFX.net(); buzz(70); say('Into the net. Swipe a bit faster.', 1.6); }
    }
    if (b.p[0] < -14 || b.p[0] > 14 || b.p[2] < -20) { b.settle = 9; return; }
    targets.forEach(function (t) {
      if (!t.alive) return;
      var dx = b.p[0] - t.obj.position.x, dz = b.p[2] - t.obj.position.z, d = Math.hypot(dx, dz);
      if (d < t.r + P.BR && b.p[1] - P.BR < t.h) {
        var vIn = b.v.slice();
        knock(t, vIn);
        if (d > 0) { var nx = dx / d, nz = dz / d, vn = b.v[0] * nx + b.v[2] * nz; if (vn < 0) { b.v[0] -= 1.5 * vn * nx; b.v[2] -= 1.5 * vn * nz; } }
        b.v[0] *= 0.55; b.v[2] *= 0.55; b.v[1] = Math.max(b.v[1], 1.2);
      }
    });
    if (b.p[1] <= P.BR) {
      b.p[1] = P.BR;
      if (b.v[1] < 0) {
        if (!b.ground) {
          b.ground = 1;
          if (!b.res) b.res = landing(b.p[0], b.p[2]);
          SFX.sand(); burst(b.p[0], 0.05, b.p[2], 10, 'sand');
          if (!b.hits) {
            if (b.res === 'net') say('Too soft: it did not reach the net. Swipe faster.', 1.6);
            else if (b.res === 'long') say('Long. Swipe a little slower.', 1.6);
            else if (b.res === 'wide') say('Wide. Aim more to the middle.', 1.6);
            else if (b.res === 'in') say('In, but nothing hit.', 1.4);
          }
        }
        b.v[1] = -b.v[1] * 0.3; b.v[0] *= 0.55; b.v[2] *= 0.55;
        if (b.v[1] < 0.6) b.v[1] = 0;
      }
      b.v[0] *= 1 - 2.5 * dt; b.v[2] *= 1 - 2.5 * dt;
    }
    if (b.ground) b.settle += dt;
    if ((b.tick = (b.tick + 1) % 6) === 0 && b.trail.length < 400) b.trail.push(b.p.slice());
    sp = Math.hypot(b.v[0], b.v[1], b.v[2]);
    if (b.ground && sp < 0.35) b.settle = Math.max(b.settle, 1.2);
  }
  function endShot() {
    if (state !== 'play' && state !== 'banner') { readyBall(); return; }
    placeDots(trailDots, shot.trail, 1); trailFade = 2.2;
    var left = targets.filter(function (t) { return t.alive; }).length;
    if (!left) {
      cleared++;
      if (level === LEVELS.length - 1) { readyBall(); endGame(); return; }
      level++; SFX.level(); buzz([30, 40, 30, 40, 80]);
      spawnLevel(level); readyBall(); state = 'banner'; banner = 1.4;
      say('Level ' + (level + 1) + ' · ' + LEVELS[level].name + (LEVELS[level].wind ? ' · watch the wind' : ''), 1.6);
      paintHud(); return;
    }
    readyBall(); paintHud();
  }
  var trailFade = 0;

  /* ---------- frame loop: runs only while the game is on screen ---------- */
  var visible = false, running = false, lastT = 0, acc = 0;
  function onScreen() { return visible && !document.hidden && root.isConnected; }
  function loop() { if (running || !onScreen()) return; running = true; lastT = 0; requestAnimationFrame(frame); }
  function frame(t) {
    if (!onScreen()) { running = false; pause(); return; }
    var dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 1 / 60; lastT = t; clock += dt;
    if (state === 'banner') { banner -= dt; if (banner <= 0) state = 'play'; }
    if (state === 'play') {
      timeLeft -= dt;
      var sec = Math.ceil(timeLeft);
      if (timeLeft <= 10 && sec !== lastTick && sec > 0) { lastTick = sec; SFX.tick(); buzz(8); }
      if (timeLeft <= 0) { timeLeft = 0; endGame(); }
      else if (tmEl.textContent !== fmt(timeLeft)) { tmEl.textContent = fmt(timeLeft); tmEl.classList.toggle('low', timeLeft <= 10); }
    }
    /* moving targets slide side to side */
    if (state === 'play' || state === 'banner') targets.forEach(function (q) {
      if (q.move && q.alive) q.obj.position.x = q.bx + q.move.amp * Math.sin(clock * q.move.speed + q.phase);
    });
    if (shot && state !== 'paused' && state !== 'menu') {
      acc += dt;
      while (acc >= 1 / 240) { acc -= 1 / 240; if (shot) stepShot(1 / 240); }
      ball.position.set(shot.p[0], shot.p[1], shot.p[2]);
      var sp = Math.hypot(shot.v[0], shot.v[2]);
      if (sp > 0.01) ball.rotateOnWorldAxis(new THREE.Vector3(-shot.v[2], 0, shot.v[0]).normalize(), -sp * dt / P.BR);
      if (shot.settle >= 1.2) endShot();
    } else {
      acc = 0;
      ball.position.set(P.C[0], P.C[1] + Math.sin(clock * 3) * 0.04, P.C[2]);
    }
    blob.position.set(ball.position.x, 0.015, ball.position.z);
    blob.scale.setScalar(Math.max(0.35, 1 - ball.position.y / 6));
    /* arm: cocked while waiting, whips through on the serve */
    if (swing > 0) swing -= dt;
    rArm.rotation.x += ((swing > 0 ? ARM_HIT : shot ? -0.2 : ARM_COCK) - rArm.rotation.x) * Math.min(1, dt * (swing > 0 ? 40 : 8));
    torso.rotation.x = drag ? -0.08 : 0;
    /* knocked-over targets tip away from the ball */
    targets.forEach(function (q) {
      if (!q.fall || q.fall.t >= 1) return;
      q.fall.t = Math.min(1, q.fall.t + dt / 0.55);
      var e = 1 - Math.pow(1 - q.fall.t, 3), hop = Math.sin(q.fall.t * Math.PI) * 0.35;
      /* lying down, its side rests on the sand instead of its middle */
      q.obj.position.set(q.fall.x0 + q.fall.dx * e, hop + (q.kind === 'cooler' ? 0 : q.r * 0.85 * e), q.fall.z0 + q.fall.dz * e);
      q.obj.rotation.set(0, 0, 0);
      q.obj.rotateOnWorldAxis(new THREE.Vector3(Math.cos(q.fall.dir), 0, Math.sin(q.fall.dir)), -Math.PI / 2 * e * (q.kind === 'cooler' ? 0.5 : 1));
      q.obj.rotation.y += q.fall.spin * e;
    });
    /* the dotted line while swiping, cut shorter in later levels */
    if (drag && drag.s.length > 1) {
      var pr = predict(drag.p, drag.yaw, windNow), g = LEVELS[level].guide;
      var col = pr.res === 'in' ? 0xffffff : 0xff6b5a;
      guideDots.material.color.setHex(col);
      placeDots(guideDots, pr.pts, g ? Math.max(0.12, g) : 0.12);
      ring.visible = g >= 1 && pr.res !== 'net';
      if (ring.visible) { ring.position.set(pr.land[0], 0.03, pr.land[2]); ring.material.color.setHex(col); }
      power.classList.add('on');
      powerFill.style.transform = 'scaleY(' + Math.max(0.03, Math.min(1, (drag.p + 0.1) / 1.25)) + ')';
      powerFill.className = pr.res === 'in' ? 'ok' : 'bad';
    }
    if (trailFade > 0) { trailFade -= dt; trailDots.material.opacity = Math.max(0, Math.min(0.6, trailFade / 2)); if (trailFade <= 0) trailDots.count = 0; }
    if (flag.visible) { flag.rotation.y = (windNow < 0 ? Math.PI : 0) + Math.sin(clock * 6) * 0.15; flagCloth.rotation.x = Math.sin(clock * 9) * 0.1; }
    if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) msgEl.classList.remove('on'); }
    updParts(dt);
    camera.position.copy(CAM);
    if (shake > 0) { shake -= dt; camera.position.x += (Math.random() - 0.5) * shake * 0.4; camera.position.y += (Math.random() - 0.5) * shake * 0.4; }
    camera.lookAt(LOOK);
    renderer.render(scene, camera);
    if (state === 'menu' || state === 'over' || state === 'paused') { if (!parts.length && !(targets.some(function (q) { return q.fall && q.fall.t < 1; }))) { running = false; return; } }
    requestAnimationFrame(frame);
  }

  /* ---------- size, visibility ---------- */
  function fit() {
    var w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    /* keep the whole court in view on tall phones */
    camera.fov = w / h < 1 ? Math.min(75, 2 * Math.atan(Math.tan(20 * Math.PI / 180) / (w / h)) * 180 / Math.PI) : 42;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  new ResizeObserver(fit).observe(root);
  new IntersectionObserver(function (es) {
    visible = es[0].isIntersecting;
    if (visible && (state === 'play' || state === 'banner')) loop();
    else if (visible) { camera.position.copy(CAM); camera.lookAt(LOOK); renderer.render(scene, camera); }
  }, { threshold: 0.35 }).observe(root);
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });

  spawnLevel(0); paintHud(); showPanel('menu');
  camera.position.copy(CAM); camera.lookAt(LOOK); fit();
}
