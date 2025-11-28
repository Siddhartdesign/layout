const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Adjust canvas to screen size
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.onresize = resizeCanvas;

// Force BACK camera
navigator.mediaDevices.getUserMedia({
  video: { facingMode: { ideal: "environment" } }
}).then(stream => {
  video.srcObject = stream;
}).catch(err => {
  alert("Camera error: " + err);
});

// Modes
let mode = "dot";
dotBtn.onclick = () => mode = "dot";
lineBtn.onclick = () => mode = "line";
gridBtn.onclick = () => {
  showGrid = !showGrid;
  redraw();
};

let showGrid = false;

// Store drawn objects
let dots = [];
let lines = [];

// For line drawing
let lineStart = null;
let draggingLineIndex = null;

// Draw everything
function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw dots
  ctx.fillStyle = "red";
  dots.forEach(d => {
    ctx.beginPath();
    ctx.arc(d.x, d.y, 8, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw lines
  ctx.strokeStyle = "lime";
  ctx.lineWidth = 3;
  lines.forEach(l => {
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
  });

  // Draw perspective grid
  if (showGrid) {
    drawPerspectiveGrid();
  }
}

function drawPerspectiveGrid() {
  const vpX = canvas.width / 2;
  const vpY = canvas.height * 0.1;

  ctx.strokeStyle = "rgba(255,255,0,0.6)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(vpX, vpY);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
}

// Handle taps
canvas.addEventListener("pointerdown", e => {
  const x = e.clientX;
  const y = e.clientY;

  if (mode === "dot") {
    dots.push({ x, y });
    redraw();
    return;
  }

  if (mode === "line") {
    // Check if touching a line (for dragging)
    draggingLineIndex = findLineNearPoint(x, y);
    if (draggingLineIndex !== null) return;

    // Start or finish a new line
    if (!lineStart) {
      lineStart = { x, y };
    } else {
      lines.push({
        x1: lineStart.x, y1: lineStart.y,
        x2: x, y2: y
      });
      lineStart = null;
      redraw();
    }
  }
});

// Dragging lines
canvas.addEventListener("pointermove", e => {
  if (draggingLineIndex !== null) {
    const dx = e.clientX - (lines[draggingLineIndex].lastX || e.clientX);
    const dy = e.clientY - (lines[draggingLineIndex].lastY || e.clientY);

    lines[draggingLineIndex].x1 += dx;
    lines[draggingLineIndex].y1 += dy;
    lines[draggingLineIndex].x2 += dx;
    lines[draggingLineIndex].y2 += dy;

    lines[draggingLineIndex].lastX = e.clientX;
    lines[draggingLineIndex].lastY = e.clientY;

    redraw();
  }
});

canvas.addEventListener("pointerup", () => {
  if (draggingLineIndex !== null) {
    lines[draggingLineIndex].lastX = null;
    lines[draggingLineIndex].lastY = null;
  }
  draggingLineIndex = null;
});

// Detect if user tapped near a line
function findLineNearPoint(px, py) {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const dist = distancePointToLine(px, py, l.x1, l.y1, l.x2, l.y2);
    if (dist < 15) return i;
  }
  return null;
}

function distancePointToLine(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  const param = dot / lenSq;

  let xx, yy;

  if (param < 0) { xx = x1; yy = y1; }
  else if (param > 1) { xx = x2; yy = y2; }
  else { xx = x1 + param * C; yy = y1 + param * D; }

  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}
