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

// canvas sizing
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  redraw();
}
window.addEventListener('resize', resize);
resize();

// Try to open the rear camera with fallbacks
async function openRearCamera() {
  // Try exact environment
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: 'environment' } } });
    video.srcObject = s;
    return;
  } catch (e) {
    // ignore
  }
  // Try ideal environment
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
    video.srcObject = s;
    return;
  } catch (e) {
    // ignore
  }
  // Fallback to any camera (let browser choose)
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = s;
    return;
  } catch (err) {
    alert('Camera failed: ' + err);
  }
}
openRearCamera();

// state
let mode = 'dot';            // 'dot' or 'line'
let orientation = 'vertical' // 'vertical' or 'horizontal'
let dots = [];               // {x,y}
let lines = [];              // {x1,y1,x2,y2, locked:boolean}
let selectedLine = null;     // index of selected line
let dragging = null;         // {index, type:'line', startPointer...}
let lastPointerPos = null;

// toolbar handlers
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

// drawing
function redraw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // draw dots
  for (const d of dots) {
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(d.x, d.y, 7, 0, Math.PI*2);
    ctx.fill();
  }

  // draw lines
  for (let i=0;i<lines.length;i++) {
    const l = lines[i];
    ctx.lineWidth = (i === selectedLine) ? 4 : 2;
    ctx.strokeStyle = l.locked ? 'rgba(180,180,180,0.9)' : (i === selectedLine ? '#00FFFF' : 'lime');
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();

    // small handle at intersection for selected
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

// utilities
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

// pointer events
canvas.addEventListener('pointerdown', e => {
  const x = e.clientX, y = e.clientY;
  lastPointerPos = {x,y};

  if (mode === 'dot') {
    dots.push({x,y});
    redraw();
    return;
  }

  // mode === 'line'
  // select existing line if near
  const hit = findLineNear(x,y);
  if (hit !== null) {
    selectedLine = hit;
    // cannot drag if locked
    if (!lines[hit].locked) {
      // start dragging: vertical lines move horizontally (dx), horizontal lines move vertically (dy)
      dragging = { index: hit, startX: x, startY: y, orig: {...lines[hit]} };
    } else {
      dragging = null;
    }
    // update lock button state
    lockBtn.classList.toggle('locked', !!lines[selectedLine].locked);
    redraw();
    return;
  }

  // no hit: create new line at tap
  if (orientation === 'vertical') {
    const xPos = x;
    const newLine = { x1: xPos, y1: 0, x2: xPos, y2: canvas.height, locked:false };
    lines.push(newLine);
    selectedLine = lines.length - 1;
    lockBtn.classList.toggle('locked', false);
    redraw();
    // begin dragging right away (unless locked)
    dragging = { index: selectedLine, startX: x, startY: y, orig: {...newLine} };
    return;
  } else {
    // horizontal
    const yPos = y;
    const newLine = { x1: 0, y1: yPos, x2: canvas.width, y2: yPos, locked:false };
    lines.push(newLine);
    selectedLine = lines.length - 1;
    lockBtn.classList.toggle('locked', false);
    redraw();
    dragging = { index: selectedLine, startX: x, startY: y, orig: {...newLine} };
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
    // vertical line: move by deltaX
    const dx = x - d.startX;
    const newX = d.orig.x1 + dx;
    li.x1 = li.x2 = newX;
  } else {
    // horizontal line: move by deltaY
    const dy = y - d.startY;
    const newY = d.orig.y1 + dy;
    li.y1 = li.y2 = newY;
  }
  redraw();
});

canvas.addEventListener('pointerup', () => {
  dragging = null;
});

// init
setMode('dot');
redraw();
