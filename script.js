// script.js - improved camera selection + same UI behaviour as before

// Elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const dotBtn = document.getElementById('dotBtn');
const lineBtn = document.getElementById('lineBtn');
const oriBtn = document.getElementById('oriBtn');
const lockBtn = document.getElementById('lockBtn');
const modeName = document.getElementById('modeName');
const oriName = document.getElementById('oriName');

// sizing
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  redraw();
}
window.addEventListener('resize', resize);
resize();

// ---------- camera init with device selection ----------
async function startCameraPreferRear() {
  // first, request permission with default camera so device labels appear
  let initialStream = null;
  try {
    initialStream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = initialStream;
    await video.play().catch(()=>{}); // some browsers require play call
  } catch (err) {
    console.warn('Initial camera permission failed:', err);
  }

  // enumerate devices
  let devices = await navigator.mediaDevices.enumerateDevices();
  const videoInputs = devices.filter(d => d.kind === 'videoinput');

  // try to find a rear/back/environment camera by label (case-insensitive)
  function findRear(inputs) {
    const keys = ['back','rear','environment','camera 1','camera2']; // camera labels vary
    for (const d of inputs) {
      const label = (d.label || '').toLowerCase();
      for (const k of keys) if (label.includes(k)) return d;
    }
    return null;
  }

  let rear = findRear(videoInputs);

  // If labels are empty (can happen if permission denied previously), fallback to using "facingMode: environment"
  if (!rear) {
    try {
      // try getUserMedia with facingMode ideal
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }});
      // if succeeded and different from initial, replace stream
      if (s) {
        stopStream(initialStream);
        video.srcObject = s;
        await video.play().catch(()=>{});
        return;
      }
    } catch(e){
      // ignore and try deviceId option next
    }
  }

  // If we found a rear deviceId explicitly, start with that
  if (rear && rear.deviceId) {
    try {
      const s2 = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: rear.deviceId } }});
      stopStream(initialStream);
      video.srcObject = s2;
      await video.play().catch(()=>{});
      return;
    } catch(e) {
      console.warn('Failed to open specific rear device, falling back', e);
    }
  }

  // If nothing else, keep the initial stream (if any). If none, try default request.
  if (!video.srcObject) {
    try {
      const s3 = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = s3;
      await video.play().catch(()=>{});
    } catch (e) {
      alert('No camera available or permission denied. Try a different browser or device.');
    }
  }
}

function stopStream(stream) {
  if (!stream) return;
  for (const t of stream.getTracks()) t.stop();
}

// run it
startCameraPreferRear();

// ensure redraw loops while video plays (keeps canvas aligned)
video.addEventListener('loadedmetadata', () => {
  resize();
  redraw();
});

// ------------ rest of app logic (dots / lines) ------------
// keep your previous state code but ensure redraw is called after video is ready

let mode = 'dot';
let orientation = 'vertical';
let dots = [];
let lines = [];
let selectedLine = null;
let dragging = null;

function setMode(m) {
  mode = m;
  dotBtn.classList.toggle('active', m === 'dot');
  lineBtn.classList.toggle('active', m === 'line');
  modeName.textContent = (m === 'dot') ? 'Dot' : 'Line';
}
dotBtn.onclick = () => setMode('dot');
lineBtn.onclick = () => setMode('line');

oriBtn.onclick = () => {
  orientation = (orientation === 'vertical') ? 'horizontal' : 'vertical';
  oriBtn.textContent = orientation === 'vertical' ? 'Orient: V' : 'Orient: H';
  oriName.textContent = orientation === 'vertical' ? 'Vertical' : 'Horizontal';
};

lockBtn.onclick = () => {
  if (selectedLine === null) return;
  lines[selectedLine].locked = !lines[selectedLine].locked;
  lockBtn.classList.toggle('locked', !!lines[selectedLine].locked);
  redraw();
};

function redraw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // Dots
  for (const d of dots) {
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(d.x, d.y, 7, 0, Math.PI*2);
    ctx.fill();
  }

  // Lines
  for (let i=0;i<lines.length;i++) {
    const l = lines[i];
    ctx.lineWidth = (i === selectedLine) ? 4 : 2;
    ctx.strokeStyle = l.locked ? 'rgba(180,180,180,0.9)' : (i === selectedLine ? '#00FFFF' : 'lime');
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
    if (i === selectedLine) {
      ctx.fillStyle = l.locked ? '#888' : '#00FFFF';
      const cx = (l.x1 + l.x2)/2;
      const cy = (l.y1 + l.y2)/2;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI*2);
      ctx.fill();
    }
  }
}

// basic distance helpers (same as before)
function distancePointToLine(px,py,x1,y1,x2,y2){
  const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
  const dot = A*C + B*D, lenSq = C*C + D*D;
  const param = (lenSq !== 0) ? dot / lenSq : -1;
  let xx, yy;
  if (param < 0) { xx = x1; yy = y1; }
  else if (param > 1) { xx = x2; yy = y2; }
  else { xx = x1 + param * C; yy = y1 + param * D; }
  const dx = px - xx, dy = py - yy;
  return Math.sqrt(dx*dx + dy*dy);
}
function findLineNear(px,py,threshold=16){
  for (let i=lines.length-1;i>=0;i--){
    const l = lines[i];
    const d = distancePointToLine(px,py,l.x1,l.y1,l.x2,l.y2);
    if (d < threshold) return i;
  }
  return null;
}

// pointer handlers (same behaviour as previous)
canvas.addEventListener('pointerdown', e => {
  const x = e.clientX, y = e.clientY;
  if (mode === 'dot') {
    dots.push({x,y});
    redraw();
    return;
  }
  const hit = findLineNear(x,y);
  if (hit !== null) {
    selectedLine = hit;
    if (!lines[hit].locked) {
      dragging = { index: hit, startX: x, startY: y, orig: {...lines[hit]} };
    } else {
      dragging = null;
    }
    lockBtn.classList.toggle('locked', !!lines[selectedLine].locked);
    redraw();
    return;
  }
  // create new line
  if (orientation === 'vertical') {
    const newLine = { x1: x, y1: 0, x2: x, y2: canvas.height, locked:false };
    lines.push(newLine);
    selectedLine = lines.length - 1;
    dragging = { index: selectedLine, startX: x, startY: y, orig: {...newLine} };
    redraw();
    return;
  } else {
    const newLine = { x1: 0, y1: y, x2: canvas.width, y2: y, locked:false };
    lines.push(newLine);
    selectedLine = lines.length - 1;
    dragging = { index: selectedLine, startX: x, startY: y, orig: {...newLine} };
    redraw();
    return;
  }
});

canvas.addEventListener('pointermove', e => {
  if (!dragging) return;
  const x = e.clientX, y = e.clientY;
  const d = dragging;
  const li = lines[d.index];
  if (!li || li.locked) return;
  if (orientation === 'vertical' || (li.x1 === li.x2)) {
    const dx = x - d.startX;
    const newX = d.orig.x1 + dx;
    li.x1 = li.x2 = Math.max(0, Math.min(canvas.width, newX));
  } else {
    const dy = y - d.startY;
    const newY = d.orig.y1 + dy;
    li.y1 = li.y2 = Math.max(0, Math.min(canvas.height, newY));
  }
  redraw();
});

canvas.addEventListener('pointerup', () => {
  dragging = null;
});

// initial
setMode('dot');
redraw();
