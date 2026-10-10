import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Response, SidecarApp } from 'sidecar_sdk';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.ANTIGRAVITY_EXECUTABLE_DATA_DIR || join(HERE, '.data');
const STATE_FILE = join(DATA_DIR, 'echo_state.json');

const app = new SidecarApp();

const readLocal = (name) => readFileSync(join(HERE, name), 'utf8');

function loadState() {
  if (!existsSync(STATE_FILE)) {
    return {
      activeMode: 'companion',
      latencyTargetMs: 140,
      handoffSensitivity: 'Medium',
      bufferSizeKb: 48,
      lastSimulatedAction: 'System Standby',
    };
  }
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {
      activeMode: 'companion',
      latencyTargetMs: 140,
      handoffSensitivity: 'Medium',
      bufferSizeKb: 48,
      lastSimulatedAction: 'System Standby',
    };
  }
}

function saveState(patch) {
  const next = { ...loadState(), ...patch, updatedAt: new Date().toISOString() };
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

app.page('/', () => readLocal('index.html'));
app.page('/app.js', () => readLocal('app.js'));
app.api('/styles.css', () => new Response(readLocal('styles.css'), { contentType: 'text/css' }), 'GET');

app.api('/api/status', () => {
  const state = loadState();
  return {
    online: true,
    state,
    timestamp: new Date().toISOString(),
    metrics: {
      zeroLatencySoundingBoard: '< 150ms',
      autopilotFilterLatency: '< 250ms',
      localModel: 'Edge Quantized SLM (Gemma/Llama)',
      privacyTier: '100% On-Device / Zero-Cloud',
    },
  };
}, 'GET');

app.api('/api/toggle-mode', (data) => {
  const mode = data.mode === 'proxy' ? 'proxy' : 'companion';
  const state = saveState({
    activeMode: mode,
    latencyTargetMs: mode === 'proxy' ? 220 : 140,
    lastSimulatedAction: `Switched to ${mode.toUpperCase()}`,
  });
  return { ok: true, state };
});

app.api('/api/simulate-message', (data) => {
  const text = String(data.text || '').trim();
  const state = loadState();
  let responseText;
  let handoffTriggered = false;

  if (state.activeMode === 'proxy') {
    if (text.toLowerCase().includes('urgent') || text.toLowerCase().includes('contract') || text.toLowerCase().includes('emergency') || text.toLowerCase().includes('overwhelm')) {
      handoffTriggered = true;
      responseText = '[Handoff Gate] Flagged high emotional or contextual urgency. The Proxy paused autopilot and queued a priority notification to Keerthi.';
    } else {
      responseText = 'Hey! Got your message. Handling a few focus tasks right now, but noted on this. I will follow up with full details shortly!';
    }
  } else {
    responseText = 'I am right here with you. That is a compelling thought—lets unpack it before the spark fades away. What is the immediate core angle you want to explore?';
  }

  saveState({ lastSimulatedAction: `Evaluated: "${text.slice(0, 30)}..."` });

  return {
    ok: true,
    mode: state.activeMode,
    handoffTriggered,
    response: responseText,
    latencyMs: state.activeMode === 'proxy' ? 215 : 138,
  };
});

app.run();
