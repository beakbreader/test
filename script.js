(() => {
  const $ = (sel) => document.querySelector(sel);

  const els = {
    resolution: $('#resolution'),
    fps: $('#fps'),
    bitrate: $('#bitrate'),
    sysAudio: $('#sysAudio'),
    micAudio: $('#micAudio'),
    start: $('#startBtn'),
    pause: $('#pauseBtn'),
    resume: $('#resumeBtn'),
    stop: $('#stopBtn'),
    status: $('#status'),
    timer: $('#timer'),
    size: $('#size'),
    format: $('#format'),
    preview: $('#preview'),
    downloads: $('#downloads'),
    compatList: $('#compatList'),
  };

  let displayStream = null;
  let micStream = null;
  let mixedStream = null;   // Final stream for MediaRecorder
  let audioContext = null;
  let mediaRecorder = null;
  let chunks = [];
  let bytesRecorded = 0;
  let timerInterval = null;
  let startTime = 0;

  // --- Capability readout
  function checkCompat() {
    const items = [];
    items.push(`getDisplayMedia: ${!!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) ? '✅' : '❌'}`);
    items.push(`MediaRecorder: ${typeof MediaRecorder !== 'undefined' ? '✅' : '❌'}`);

    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm',
      'video/mp4', // rarely works; some Safari builds only
    ];
    let chosen = '';
    for (const t of types) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) {
        chosen = chosen || t;
        items.push(`supports ${t}: ✅`);
      } else {
        items.push(`supports ${t}: ❌`);
      }
    }
    els.compatList.innerHTML = items.map(i => `<li>${i}</li>`).join('');
    els.format.textContent = chosen || 'No supported container';
    return chosen;
  }

  const preferredMimeType = checkCompat();

  function hhmmss(sec) {
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }

  function updateStatus(text) {
    els.status.textContent = text;
  }

  function enableDuringRecording(on) {
    els.start.disabled = on;
    els.pause.disabled = !on;
    els.stop.disabled = !on;
    els.resume.disabled = true;
  }

  async function getStreams() {
    const [w, h] = els.resolution.value.split('x').map(Number);
    const fr = Number(els.fps.value);

    // Screen / window / tab
    displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: w, max: w },
        height: { ideal: h, max: h },
        frameRate: { ideal: fr, max: fr },
        cursor: 'always'
      },
      audio: els.sysAudio.checked // system audio if browser allows
    });

    // Microphone (optional)
    if (els.micAudio.checked) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 2,
            sampleRate: 48000
          },
          video: false
        });
      } catch (e) {
        console.warn('Mic permission denied:', e);
        micStream = null;
      }
    }

    // Mix audio (system + mic) if needed
    const displayAudioTracks = displayStream.getAudioTracks();
    const micAudioTracks = micStream ? micStream.getAudioTracks() : [];
    const haveAnyAudio = displayAudioTracks.length || micAudioTracks.length;

    if (haveAnyAudio) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const dest = audioContext.createMediaStreamDestination();

      if (displayAudioTracks.length) {
        const sourceSys = audioContext.createMediaStreamSource(new MediaStream([displayAudioTracks[0]]));
        const gainSys = audioContext.createGain();
        gainSys.gain.value = 1.0;
        sourceSys.connect(gainSys).connect(dest);
      }

      if (micAudioTracks.length) {
        const sourceMic = audioContext.createMediaStreamSource(new MediaStream([micAudioTracks[0]]));
        const gainMic = audioContext.createGain();
        gainMic.gain.value = 1.0;
        sourceMic.connect(gainMic).connect(dest);
      }

      mixedStream = new MediaStream([
        displayStream.getVideoTracks()[0],
        ...dest.stream.getAudioTracks()
      ]);
    } else {
      mixedStream = new MediaStream([
        displayStream.getVideoTracks()[0]
      ]);
    }

    // Live preview (don’t use recorder output; show capture directly)
    els.preview.srcObject = mixedStream;

    // Stop everything if user stops sharing from the browser UI
    displayStream.getVideoTracks()[0].addEventListener('ended', stopAll);
  }

  function chooseRecorderOptions() {
    const kbps = Math.max(1000, Number(els.bitrate.value) || 12000);
    const bps = kbps * 1000;

    const candidates = [
      { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: bps },
      { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: bps },
      { mimeType: 'video/webm', videoBitsPerSecond: bps },
      { mimeType: 'video/mp4', videoBitsPerSecond: bps }, // may not be supported
    ];

    for (const c of candidates) {
      if (!c.mimeType || (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c.mimeType))) {
        return c;
      }
    }
    return {}; // fallback
  }

  async function startRecording() {
    try {
      updateStatus('Requesting capture…');
      await getStreams();

      chunks = [];
      bytesRecorded = 0;
      const options = chooseRecorderOptions();
      els.format.textContent = options.mimeType || preferredMimeType || 'unknown';

      mediaRecorder = new MediaRecorder(mixedStream, options);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size) {
          chunks.push(e.data);
          bytesRecorded += e.data.size;
          els.size.textContent = (bytesRecorded / (1024 * 1024)).toFixed(1) + ' MB';
        }
      };

      mediaRecorder.onstart = () => {
        startTime = performance.now();
        timerInterval = setInterval(() => {
          const elapsed = (performance.now() - startTime) / 1000;
          els.timer.textContent = hhmmss(elapsed);
        }, 250);
        updateStatus('Recording');
        enableDuringRecording(true);
      };

      mediaRecorder.onpause = () => updateStatus('Paused');
      mediaRecorder.onresume = () => updateStatus('Recording');

      mediaRecorder.onstop = onRecordingStop;

      mediaRecorder.start(1000); // collect data every second
    } catch (err) {
      console.error(err);
      updateStatus('Error: ' + (err && err.message ? err.message : String(err)));
      stopAll(true);
    }
  }

  function pauseRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      els.pause.disabled = true;
      els.resume.disabled = false;
    }
  }

  function resumeRecording() {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      els.pause.disabled = false;
      els.resume.disabled = true;
    }
  }

  function stopRecording() {
    if (mediaRecorder && (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused')) {
      mediaRecorder.stop();
    }
  }

  function onRecordingStop() {
    clearInterval(timerInterval);
    els.timer.textContent = '00:00';
    updateStatus('Stopped');
    enableDuringRecording(false);

    const mime = mediaRecorder.mimeType || 'video/webm';
    const blob = new Blob(chunks, { type: mime });
    const url = URL.createObjectURL(blob);

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = mime.includes('mp4') ? 'mp4' : 'webm';
    const name = `screen-${stamp}.${ext}`;

    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.textContent = `Download ${name}`;
    els.downloads.prepend(a);

    // Keep preview showing last frame rather than going black
    els.preview.srcObject = null;
    els.preview.src = url;
    els.preview.controls = true;

    stopAll();
  }

  function stopAll(silent=false) {
    try {
      displayStream && displayStream.getTracks().forEach(t => t.stop());
      micStream && micStream.getTracks().forEach(t => t.stop());
      audioContext && audioContext.close();
    } catch (e) { /* ignore */ }

    displayStream = null;
    micStream = null;
    mixedStream = null;
    audioContext = null;
    mediaRecorder = null;

    els.pause.disabled = true;
    els.resume.disabled = true;
    els.stop.disabled = true;
    els.start.disabled = false;

    if (!silent) updateStatus('Idle');
  }

  // Wire up UI
  els.start.addEventListener('click', startRecording);
  els.pause.addEventListener('click', pauseRecording);
  els.resume.addEventListener('click', resumeRecording);
  els.stop.addEventListener('click', stopRecording);

  window.addEventListener('beforeunload', () => stopAll(true));
})();
