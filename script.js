// Camera setup
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Set canvas size to match screen
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.onresize = resize;

// Start camera
navigator.mediaDevices.getUserMedia({
  video: { facingMode: { exact: "environment" } }
})
  .then(stream => { video.srcObject = stream; })
  .catch(err => alert("Camera error: " + err));

// Add a dot where the user taps
canvas.addEventListener("pointerdown", e => {
  const x = e.clientX;
  const y = e.clientY;

  ctx.fillStyle = "red";
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fill();
});
