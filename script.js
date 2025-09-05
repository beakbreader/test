<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Screen Recorder — 1080p60</title>
  <style>
    :root{--bg:#0b0f14;--card:#111822;--text:#e6edf3;--muted:#9fb1c1;--brand:#4ea1ff;--danger:#ff5c5c;--border:#1f2a36;--radius:16px}
    *{box-sizing:border-box}html,body{height:100%}body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,Arial;background:linear-gradient(180deg,#0b0f14,#0d131a);color:var(--text)}
    .wrap{max-width:1100px;margin:24px auto;padding:0 16px}
    .card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px}
    .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}@media(max-width:780px){.grid{grid-template-columns:1fr 1fr}}
    .field{display:flex;flex-direction:column;gap:6px}.field input,.field select{background:#0c141d;color:var(--text);border:1px solid var(--border);border-radius:12px;padding:10px 12px}
    .check{grid-column:span 3;display:flex;align-items:center;gap:10px;color:var(--muted)}@media(max-width:780px){.check{grid-column:span 2}}
    .buttons{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}
    button{border:1px solid var(--border);background:#0c141d;color:var(--text);padding:10px 14px;border-radius:12px;cursor:pointer}
    button:disabled{opacity:.5;cursor:not-allowed}
    .primary{background:linear-gradient(180deg,#2f7fe0,#2368bb);border-color:#215ea9}
    .danger{background:linear-gradient(180deg,#ff6b6b,#e05555);border-color:#c84b4b}
    .status{margin-top:12px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;color:var(--muted);font-size:.95rem}
    video{width:100%;aspect-ratio:16/9;background:#0c141d;border:1px dashed var(--border);border-radius:12px}
    #downloads a{display:inline-block;margin:4px 8px 0 0;padding:8px 12px;border-radius:10px;border:1px solid var(--border);background:#0c141d;color:var(--text);text-decoration:none}
    small{color:var(--muted)}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Screen Recorder — 1080p60</h1>
    <p class="sub">Requests 1920×1080 @ 60fps (hardware/browser permitting).</p>

    <div class="card">
      <div class="grid">
        <label class="field">
          <span>Resolution</span>
          <select id="resolution">
            <option value="1920x1080" selected>1920×1080 (1080p)</option>
            <option value="1280x720">1280×720 (720p)</option>
            <option value="2560x1440">2560×1440 (1440p)</option>
            <option value="3840x2160">3840×2160 (4K)</option>
          </select>
        </label>
        <label class="field">
          <span>Frame rate</span>
          <select id="fps">
            <option value="60" selected>60</option>
            <option value="30">30</option>
          </select>
        </label>
        <label class="field">
          <span>Bitrate (kbps)</span>
          <input id="bitrate" type="number" min="1000" step="500" value="12000" />
        </label>
        <label class="check"><input id="sysAudio" type="checkbox" checked />Include system audio (if supported)</label>
        <label class="check"><input id="micAudio" type="checkbox" />Include microphone</label>
      </div>

      <div class="buttons">
        <button id="startBtn" class="primary">Start capture</button>
        <button id="pauseBtn" disabled>Pause</button>
        <button id="resumeBtn" disabled>Resume</button>
        <button id="stopBtn" class="danger" disabled>Stop</button>
      </div>

      <div class="status">
        <div><strong>Status:</strong> <span id="status">Idle</span></div>
        <div><strong>Timer:</strong> <span id="timer">00:00</span></div>
        <div><strong>Recorded:</strong> <span id="size">0.0 MB</span></div>
        <div><strong>Format:</strong> <span id="format">Detecting…</span></div>
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <h2>Preview</h2>
      <video id="preview" playsinline autoplay muted></video>
    </div>

    <div class="card" style="margin-top:12px">
      <h2>Output</h2>
      <div id="downloads"></div>
      <p class="note">Transcode to MP4 (editing-friendly): <code>ffmpeg -i input.webm -c:v libx264 -preset veryfast -crf 20 -c:a aac output.mp4</code></p>
      <details><summary>Compatibility details</summary>
        <ul id="compatList" style="margin-top:8px"></ul>
      </details>
      <small>If the button does “nothing,” open DevTools (F12) → Console. Any error will print here.</small>
    </div>
  </div>

  <script>
    (function(){
      const $ = (s)=>document.querySelector(s);
      const els = {
        resolution: $('#resolution'), fps: $('#fps'), bitrate: $('#bitrate'),
        sysAudio: $('#sysAudio'), micAudio: $('#micAudio'),
        start: $('#startBtn'), pause: $('#pauseBtn'), resume: $('#resumeBtn'), stop: $('#stopBtn'),
        status: $('#status'), timer: $('#timer'), size: $('#size'), format: $('#format'),
        preview: $('#preview'), downloads: $('#downloads'), compatList: $('#compatList'),
      };

      let displayStream=null, micStream=null, mixedStream=null, audioContext=null, mediaRecorder=null;
      let chunks=[], bytesRecorded=0, timerInterval=null, startTime=0;

      function logStatus(msg, err){
        console[err?'error':'log'](msg);
        els.status.textContent = msg;
      }

      function checkCompat(){
        const items=[];
        const okGDM = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
        const okMR = typeof MediaRecorder !== 'undefined';
        items.push(`getDisplayMedia: ${okGDM?'✅':'❌'}`);
        items.push(`MediaRecorder: ${okMR?'✅':'❌'}`);
        const types=[
          'video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm;codecs=vp9','video/webm','video/mp4'
        ];
        let chosen='';
        for(const t of types){
          if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)){
            chosen = chosen || t; items.push(`supports ${t}: ✅`);
          } else { items.push(`supports ${t}: ❌`); }
        }
        els.compatList.innerHTML = items.map(i=>`<li>${i}</li>`).join('');
        els.format.textContent = chosen || 'No supported container';
        if (!okGDM) throw new Error('Your browser does not support screen capture (getDisplayMedia). Use Chrome/Edge/Firefox on HTTPS.');
      }

      function hhmmss(sec){ const s=Math.floor(sec), m=Math.floor(s/60), r=s%60; return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`; }
      function enableDuringRecording(on){ els.start.disabled=on; els.pause.disabled=!on; els.stop.disabled=!on; els.resume.disabled=true; }

      async function getStreams(){
        const [w,h] = els.resolution.value.split('x').map(Number);
        const fr = Number(els.fps.value);
        // Request display capture
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video:{ width:{ideal:w,max:w}, height:{ideal:h,max:h}, frameRate:{ideal:fr,max:fr}, cursor:'always' },
          audio: els.sysAudio.checked
        });
        // Optional mic
        if (els.micAudio.checked){
          try{
            micStream = await navigator.mediaDevices.getUserMedia({ audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}, video:false });
          }catch(e){ console.warn('Mic denied:', e); }
        }
        // Mix audio
        const displayAudio = displayStream.getAudioTracks();
        const micAudio = micStream ? micStream.getAudioTracks() : [];
        if (displayAudio.length || micAudio.length){
          audioContext = new (window.AudioContext||window.webkitAudioContext)();
          const dest = audioContext.createMediaStreamDestination();
          if (displayAudio.length){
            const sysSrc = audioContext.createMediaStreamSource(new MediaStream([displayAudio[0]]));
            sysSrc.connect(dest);
          }
          if (micAudio.length){
            const micSrc = audioContext.createMediaStreamSource(new MediaStream([micAudio[0]]));
            micSrc.connect(dest);
          }
          mixedStream = new MediaStream([ displayStream.getVideoTracks()[0], ...dest.stream.getAudioTracks() ]);
        } else {
          mixedStream = new MediaStream([ displayStream.getVideoTracks()[0] ]);
        }
        els.preview.srcObject = mixedStream;
        displayStream.getVideoTracks()[0].addEventListener('ended', ()=> stopAll());
      }

      function chooseRecorderOptions(){
        const kbps = Math.max(1000, Number(els.bitrate.value) || 12000);
        const bps = kbps * 1000;
        const candidates = [
          { mimeType:'video/webm;codecs=vp9,opus', videoBitsPerSecond:bps },
          { mimeType:'video/webm;codecs=vp8,opus', videoBitsPerSecond:bps },
          { mimeType:'video/webm', videoBitsPerSecond:bps },
          { mimeType:'video/mp4', videoBitsPerSecond:bps } // unlikely
        ];
        for (const c of candidates){
          if (!c.mimeType || (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c.mimeType))) return c;
        }
        return {};
      }

      async function start(){
        try{
          checkCompat();
          logStatus('Requesting capture…');
          await getStreams();
          chunks=[]; bytesRecorded=0;
          const opts = chooseRecorderOptions();
          els.format.textContent = opts.mimeType || 'video/webm';

          mediaRecorder = new MediaRecorder(mixedStream, opts);
          mediaRecorder.ondataavailable = (e)=>{
            if (e.data && e.data.size){ chunks.push(e.data); bytesRecorded += e.data.size; els.size.textContent = (bytesRecorded/1048576).toFixed(1)+' MB'; }
          };
          mediaRecorder.onstart = ()=>{
            startTime = performance.now();
            timerInterval = setInterval(()=>{ els.timer.textContent = hhmmss((performance.now()-startTime)/1000); }, 250);
            enableDuringRecording(true);
            logStatus('Recording');
          };
          mediaRecorder.onpause = ()=> logStatus('Paused');
          mediaRecorder.onresume = ()=> logStatus('Recording');
          mediaRecorder.onstop = onStop;

          mediaRecorder.start(1000);
        }catch(err){
          logStatus('Error: ' + (err && err.message ? err.message : String(err)), true);
          // Common causes
          // - Not on HTTPS
          // - Denied permissions / closed picker
          // - Unsupported browser (old Safari)
        }
      }

      function pause(){ if (mediaRecorder && mediaRecorder.state==='recording'){ mediaRecorder.pause(); els.pause.disabled=true; els.resume.disabled=false; } }
      function resume(){ if (mediaRecorder && mediaRecorder.state==='paused'){ mediaRecorder.resume(); els.pause.disabled=false; els.resume.disabled=true; } }
      function stop(){ if (mediaRecorder && (mediaRecorder.state==='recording'||mediaRecorder.state==='paused')) mediaRecorder.stop(); }

      function onStop(){
        clearInterval(timerInterval); els.timer.textContent='00:00'; enableDuringRecording(false); logStatus('Stopped');
        const mime = mediaRecorder.mimeType || 'video/webm';
        const blob = new Blob(chunks, { type:mime });
        const url = URL.createObjectURL(blob);
        const stamp = new Date().toISOString().replace(/[:.]/g,'-');
        const ext = mime.includes('mp4') ? 'mp4' : 'webm';
        const name = `screen-${stamp}.${ext}`;
        const a = document.createElement('a'); a.href=url; a.download=name; a.textContent=`Download ${name}`;
        els.downloads.prepend(a);
        els.preview.srcObject = null; els.preview.src = url; els.preview.controls = true;
        stopAll();
      }

      function stopAll(){
        try{
          displayStream && displayStream.getTracks().forEach(t=>t.stop());
          micStream && micStream.getTracks().forEach(t=>t.stop());
          audioContext && audioContext.close();
        }catch(_){}
        displayStream=micStream=mixedStream=mediaRecorder=null; audioContext=null;
        els.pause.disabled=true; els.resume.disabled=true; els.stop.disabled=true; els.start.disabled=false;
        if (els.status.textContent!=='Error') els.status.textContent='Idle';
      }

      els.start.addEventListener('click', start);
      els.pause.addEventListener('click', pause);
      els.resume.addEventListener('click', resume);
      els.stop.addEventListener('click', stop);

      // Helpful: clear dangling streams on unload
      window.addEventListener('beforeunload', ()=> stopAll());
      // Show capabilities now
      try{ checkCompat(); }catch(e){ logStatus(e.message, true); }
    })();
  </script>
</body>
</html>
