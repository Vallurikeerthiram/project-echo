const sidecar = window.sidecar;
const $ = (id) => document.getElementById(id);

let currentMode = 'companion';

async function callApi(path, { method = 'GET', body } = {}) {
  if (!sidecar) {
    return { ok: true, state: { activeMode: currentMode } };
  }
  const res = await sidecar.fetch(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `${res.status} ${res.statusText}`);
  }
  return data;
}

let toastTimer;
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 2500);
}

async function refresh() {
  try {
    const res = await callApi('/api/status');
    if (res.state) {
      applyMode(res.state.activeMode);
    }
    if ($('system-badge')) {
      $('system-badge').textContent = 'ONLINE';
    }
  } catch (err) {
    if ($('system-badge')) {
      $('system-badge').textContent = 'PREVIEW';
    }
  }
}

function applyMode(mode) {
  currentMode = mode;
  const isProxy = mode === 'proxy';
  $('btn-proxy').classList.toggle('active', isProxy);
  $('btn-companion').classList.toggle('active', !isProxy);
  $('mode-badge').textContent = isProxy ? 'AUTOPILOT' : 'SYNTHESIZER';
  $('mode-badge').className = isProxy ? 'badge ok' : 'badge companion';
  $('latency-val').textContent = isProxy ? '< 250 ms (Tone Matching Filter)' : '< 150 ms (Zero-Latency Echo)';
}

async function toggleMode(mode) {
  applyMode(mode);
  try {
    await callApi('/api/toggle-mode', { method: 'POST', body: { mode } });
    toast(`Mode set to: ${mode.toUpperCase()}`);
  } catch (err) {
    toast(`Failed to switch mode`);
  }
}

async function sendSimulation() {
  const input = $('sim-input');
  const text = input.value.trim() || 'Testing zero-latency reflex connection';
  $('sim-response').textContent = 'Evaluating through neural pipeline...';

  try {
    const res = await callApi('/api/simulate-message', {
      method: 'POST',
      body: { text },
    });

    if (res.response) {
      $('sim-response').innerHTML = `<strong>[${res.mode.toUpperCase()} / ${res.latencyMs}ms]</strong>: ${res.response}`;
      if (res.handoffTriggered) {
        $('handoff-status').textContent = '⚠️ Handoff Triggered (Nuance Detected)';
      } else {
        $('handoff-status').textContent = 'Autonomous / Absorbing load';
      }
    }
  } catch {
    $('sim-response').textContent = `[Simulated Reflex]: Immediate response rendered locally in 138ms.`;
  }
  input.value = '';
}

function init() {
  $('btn-proxy').addEventListener('click', () => toggleMode('proxy'));
  $('btn-companion').addEventListener('click', () => toggleMode('companion'));
  $('btn-send').addEventListener('click', sendSimulation);
  $('sim-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendSimulation();
  });

  refresh();
}

init();
