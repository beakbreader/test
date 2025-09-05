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
  let mixedStream = null;
  let audioContext = null;
  let mediaRecorder = null;
  let chunks = [];
  let bytesRecorded = 0;
  let timerInterval = null;
  let startTime = 0;

  function logStatus(message, isError = false) {
    console[isError ? 'error' : 'log'](message);
    els.status.textContent = message;
  }

  function hhmmss(sec) {
    const s = Math.floor(sec), m = Math.floor(s / 60), r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }

  function enableDuringRecording(active) {
    els.start.disabled = active;
    els.pause.disabled = !active;
    els.stop.disabled = !active;
    els.resume.disabled = true;
  }

  function checkCompat() {
    const items = [];
    const hasGDM = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    const hasMR = typeof MediaRecorder !== 'undefined';

    items.push(`getDisplayMedia: ${hasGDM ? '✅' : '❌'}`);
    items.push(`MediaRecorder: ${hasMR ? '✅' : '❌'}`);

    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm',
      'video/mp4',
    ];

    let chosen = '';
    mimeTypes.forEach((type) => {
      const ok = MediaRecorder.isTypeSupported
        ? MediaRecorder.isTypeSupported(type)
        : false;
      items.push(`supports ${type}: ${ok ? '✅' : '❌'}`);
      if (!chosen && ok) chosen = type;
    });

    els.compatList.innerHTML = items.map((i) => `<li>${i}</li>`).join('');
    els.format.textContent = chosen || 'No supported container';

    if (!hasGDM) {
      throw new Error(
        'Your browser doesn’t support screen capture. Use latest Chrome/Edge on HTTPS.'
      );
    }
  }

  async function getStreams() {
    const [w, h] = els.resolution.value.split('x').map(Number);
    const fr = Number(els.fps.value);

    displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: w, max: w },
        height: { ideal: h, max: h },
        frameRate: { ideal: fr, max: fr },
        cursor: 'always',
      },
      audio: els.sysAudio.checked,
    });

    if (els.micAudio.checked) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      } catch (err) {
        console.warn('Mic capture denied:', err);
      }
    }

    const displayAudio = displayStream.getAudioTracks();
    const micAudio = micStream ? micStream.getAudioTracks() : [];
    const hasAudio = displayAudio.length || micAudio.length;

    if (hasAudio) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const dest = audioContext.createMediaStreamDestination();

      if (displayAudio.length) {
        const sysSrc = audioContext.createMediaStreamSource(
          new MediaStream([displayAudio[0]])
        );
        sysSrc.connect(dest);
      }
      if (micAudio.length) {
        const micSrc = audioContext.createMediaStreamSource(
          new MediaStream([micAudio[0]])
        );
        micSrc.connect(dest);
      }

      mixedStream = new MediaStream([
        displayStream.getVideoTracks()[0],
        ...dest.stream.getAudioTracks(),
      ]);
    } else {
      mixedStream = new MediaStream([displayStream.getVideoTracks()[0]]);
    }

    els.preview.srcObject = mixedStream;
    displayStream.getVideoTracks()[0].addEventListener('ended', stopAll);
  }

  function chooseRecorderOptions() {
    const kbps = Math.max(1000, Number(els.bitrate.value) || 12000);
    const bps = kbps * 1000;

    const options = [
      { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: bps },
      { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: bps },
      { mimeType: 'video/webm', videoBitsPerSecond: bps },
      { mimeType: 'video/mp4', videoBitsPerSecond: bps },
    ];

    return options.find((opt) => !opt.mimeType || MediaRecorder.isTypeSupported(opt.mimeType)) || {};
  }

  async function startRecording() {
    try {
      checkCompat();
      logStatus('Requesting capture…');
      await getStreams();

      chunks = [];
      bytesRecorded = 0;

      const opts = chooseRecorderOptions();
      els.format.textContent = opts.mimeType || els.format.textContent;

      mediaRecorder = new MediaRecorder(mixedStream, opts);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data?.size) {
          chunks.push(e.data);
          bytesRecorded += e.data.size;
          els.size.textContent = (bytesRecorded / (1024 * 1024)).toFixed(1) + ' MB';
        }
      };

      mediaRecorder.onstart = () => {
        startTime = performance.now();
        timerInterval = setInterval(() => {
          els.timer.textContent = hhmmss((performance.now() - startTime) / 1000);
        }, 250);

        enableDuringRecording(true);
        logStatus('Recording');
      };

      mediaRecorder.onpause = () => logStatus('Paused');
      mediaRecorder.onresume = () => logStatus('Recording');
      mediaRecorder.onstop = handleStop;

      mediaRecorder.start(1000);
    } catch (err) {
      logStatus('Error: ' + (err.message || err), true);
    }
  }

  function pauseRecording() {
    if (mediaRecorder?.state === 'recording') {
      mediaRecorder.pause();
      els.pause.disabled = true;
      els.resume.disabled = false;
    }
  }

  function resumeRecording() {
    if (mediaRecorder?.state === 'paused') {
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

  function handleStop() {
    clearInterval(timerInterval);
    els.timer.textContent = '00:00';
    enableDuringRecording(false);
    logStatus('Stopped');

    const mime = (mediaRecorder?.mimeType || 'video/webm');
    const blob = new Blob(chunks, { type: mime });
    const url = URL.createObjectURL(blob);
    const timeStamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = mime.includes('mp4') ? 'mp4' : 'webm';
    const filename = `screen-${timeStamp}.${ext}`;

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.textContent = `Download ${filename}`;
    els.downloads.prepend(anchor);

    els.preview.srcObject = null;
    els.preview.src = url;
    els.preview.controls = true;

    stopAll();
  }

  function stopAll() {
    try {
      displayStream?.getTracks().forEach((t) => t.stop());
      micStream?.getTracks().forEach((t) => t.stop());
      audioContext?.close();
    } catch (e) {
      console.warn('Error stopping streams:', e);
    }

    displayStream = null;
    micStream = null;
    mixedStream = null;
    audioContext = null;
    mediaRecorder = null;

    els.pause.disabled = true;
    els.resume.disabled = true;
    els.stop.disabled = true;
    els.start.disabled = false;

    if (!els.status.textContent.startsWith('Error')) {
      els.status.textContent = 'Idle';
    }
  }

  els.start.addEventListener('click', startRecording);
  els.pause.addEventListener('click', pauseRecording);
  els.resume.addEventListener('click', resumeRecording);
  els.stop.addEventListener('click', stopRecording);

  window.addEventListener('beforeunload', () => stopAll());

  try {
    checkCompat();
  } catch (err) {
    logStatus(err.message, true);
  }
})();
