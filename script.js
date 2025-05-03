const playBtn = document.getElementById("playBtn");
const stopBtn = document.getElementById("stopBtn");
const recordBtn = document.getElementById("recordBtn");
const volumeControl = document.getElementById("volume");
const sampleRateSelect = document.getElementById("sampleRate");
const codeArea = document.getElementById("code");
const canvas = document.getElementById("visualizer");
const ctx = canvas.getContext("2d");

let audioCtx, gainNode, scriptNode;
let mediaRecorder, chunks = [];
let isPlaying = false;
let index = 0;

// Insert code from beat preset
function insertCode(code) {
  codeArea.value = code;
}

// Play button
playBtn.onclick = () => {
  if (!isPlaying) startAudio();
};

// Stop button
stopBtn.onclick = stopAudio;

// Record button
recordBtn.onclick = () => {
  if (!mediaRecorder) return;
  if (mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    recordBtn.classList.remove("recording");
  } else {
    chunks = [];
    mediaRecorder.start();
    recordBtn.classList.add("recording");
  }
};

// Start audio generation
function startAudio() {
  const sampleRate = parseInt(sampleRateSelect.value);
  const code = codeArea.value;

  index = 0;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });

  gainNode = audioCtx.createGain();
  gainNode.gain.value = volumeControl.value;
  gainNode.connect(audioCtx.destination);

  const dest = audioCtx.createMediaStreamDestination();
  gainNode.connect(dest);
  mediaRecorder = new MediaRecorder(dest.stream);

  mediaRecorder.ondataavailable = e => chunks.push(e.data);
  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "numbeat.wav";
    a.click();
  };

  scriptNode = audioCtx.createScriptProcessor(1024, 0, 1);
  scriptNode.onaudioprocess = e => {
    const out = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < out.length; i++) {
      let value;
      try {
        value = Function('"use strict"; return (' + code + ')')();
      } catch {
        value = 0;
      }
      const freq = Math.abs(value % 2000) + 20;
      const sample = Math.sin(2 * Math.PI * freq * index / audioCtx.sampleRate);
      out[i] = sample * gainNode.gain.value;
      index++;
    }
    drawVisualizer(out);
  };

  scriptNode.connect(gainNode);
  isPlaying = true;
}

// Stop audio
function stopAudio() {
  if (!isPlaying) return;
  isPlaying = false;
  if (scriptNode) scriptNode.disconnect();
  if (gainNode) gainNode.disconnect();
  if (audioCtx) audioCtx.close();
  recordBtn.classList.remove("recording");
}

// Draw waveform
function drawVisualizer(samples) {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  ctx.fillStyle = "#003333";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "lime";
  ctx.beginPath();
  for (let i = 0; i < samples.length; i++) {
    const x = (i / samples.length) * canvas.width;
    const y = (0.5 - samples[i] / 2) * canvas.height;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// Handle tab switching
document.querySelectorAll('.tab-buttons button').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab-buttons button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  };
});
const highlightDiv = document.getElementById("highlight");

codeArea.addEventListener("input", updateHighlight);
codeArea.addEventListener("scroll", () => {
  highlightDiv.scrollTop = codeArea.scrollTop;
});

function updateHighlight() {
  const code = codeArea.value
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/(\/\/[^\n]*)/g, '<span class="highlight-comment">$1</span>')
    .replace(/(".*?"|'.*?')/g, '<span class="highlight-string">$1</span>')
    .replace(/\b(Math\.sin|Math\.cos|Math\.tan|Math\.sqrt|charCodeAt)\b/g, '<span class="highlight-func">$1</span>')
    .replace(/([1-9])/g, '<span class="highlight-number">$1</span>')
    .replace(/([\+\-\*\/\%\(\)])/g, '<span class="highlight-operator">$1</span>');

  highlightDiv.innerHTML = code;
}

// Initial highlight
updateHighlight();
