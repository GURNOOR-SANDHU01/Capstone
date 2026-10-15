/**
 * Sentience Frontend Application Logic
 * Integrates with Firebase JS Client and backend REST API.
 */

import { auth } from './firebase-config.js';
import {
  signInAnonymously,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

let currentUser = null;
let currentToken = null;
let lastCreatedPromptId = null;

// DOM Elements
const authStatusText = document.getElementById('authStatusText');
const btnAuthAction = document.getElementById('btnAuthAction');
const liveConsoleOutput = document.getElementById('liveConsoleOutput');

function logConsole(title, data) {
  const timestamp = new Date().toLocaleTimeString();
  const entry = `[${timestamp}] ${title}\n` + (typeof data === 'object' ? JSON.stringify(data, null, 2) : data) + '\n\n';
  liveConsoleOutput.textContent = entry + liveConsoleOutput.textContent;
}

// Token helper for authenticated API requests
async function getAuthHeaders() {
  if (currentUser) {
    try {
      currentToken = await currentUser.getIdToken();
    } catch (e) {
      console.warn('Could not refresh ID token', e);
    }
  }

  // Fallback to local demo token if in development
  const token = currentToken || window.localStorage.getItem('sentience_demo_token') || 'demo_token_user_001_arjun';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// Navigation Tabs
document.querySelectorAll('.nav-tab').forEach((tabBtn) => {
  tabBtn.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));

    tabBtn.classList.add('active');
    const panelId = tabBtn.getAttribute('data-tab');
    document.getElementById(panelId)?.classList.add('active');
  });
});

// Firebase Auth Observer
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    currentToken = await user.getIdToken();
    authStatusText.textContent = `${user.email || 'User'} (${user.uid.substring(0, 8)}...)`;
    btnAuthAction.textContent = 'Sign Out';
    logConsole('Firebase Auth State Changed: Signed In', { uid: user.uid, isAnonymous: user.isAnonymous });
    loadAllData();
  } else {
    currentUser = null;
    currentToken = null;
    const demoUser = window.localStorage.getItem('sentience_demo_user') || 'user_001_arjun';
    authStatusText.textContent = `Demo Mode: ${demoUser}`;
    btnAuthAction.textContent = 'Sign In (Firebase)';
    logConsole('Auth State: Local Demo Mode', { activeUser: demoUser });
    loadAllData();
  }
});

btnAuthAction.addEventListener('click', async () => {
  if (currentUser) {
    await signOut(auth);
    window.localStorage.removeItem('sentience_demo_token');
    authStatusText.textContent = 'Not Authenticated';
    btnAuthAction.textContent = 'Sign In';
  } else {
    try {
      const res = await signInAnonymously(auth);
      logConsole('Signed in anonymously to Firebase', { uid: res.user.uid });
    } catch (err) {
      // In case offline or Firebase API key is demo placeholder, prompt demo user UID
      const customUid = prompt('Enter a demo user ID (e.g. user_001_arjun, user_002_priya, or user_003_karan):', 'user_001_arjun');
      if (customUid) {
        window.localStorage.setItem('sentience_demo_user', customUid);
        window.localStorage.setItem('sentience_demo_token', `demo_token_${customUid}`);
        authStatusText.textContent = `Demo: ${customUid}`;
        loadAllData();
      }
    }
  }
});

// Load all tabs data
async function loadAllData() {
  loadJournalEntries();
  loadMemories();
  loadConsent();
  loadSafetyAlerts();
  loadBiometrics();
}

// 1. Journaling & CBT Reflection
async function loadJournalEntries() {
  const container = document.getElementById('journalEntriesList');
  container.innerHTML = '<p style="color: var(--text-dim); font-size: 13px;">Loading entries...</p>';

  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/journal-entries?limit=10', { headers });
    const json = await res.json();
    logConsole('GET /api/journal-entries', json);

    if (!json.success || !json.data || json.data.length === 0) {
      container.innerHTML = '<p style="color: var(--text-dim); font-size: 13px;">No entries recorded yet. Write your first entry above!</p>';
      return;
    }

    container.innerHTML = json.data
      .map((entry) => {
        const emotion = entry.detected_emotions?.primary_state || 'neutral';
        const conf = entry.detected_emotions?.confidence ? `(${(entry.detected_emotions.confidence * 100).toFixed(0)}%)` : '';
        const themes = (entry.extracted_themes || []).map((t) => `<span class="emotion-badge">${t}</span>`).join(' ');
        const cbt = entry.reflection_prompt?.prompt_text
          ? `<div style="font-size: 12px; color: #d8b4fe; margin-top: 6px;">💡 Prompt: ${entry.reflection_prompt.prompt_text}</div>`
          : '';

        return `
          <div class="entry-item">
            <div class="entry-meta">
              <span>📅 ${entry.entry_date} &bull; ${entry.input_source}</span>
              <span class="emotion-badge">Emotion: ${emotion} ${conf}</span>
            </div>
            <div class="entry-content">${entry.masked_content}</div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">${themes}</div>
            ${cbt}
          </div>
        `;
      })
      .join('');
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger); font-size: 13px;">Failed to load entries: ${err.message}</p>`;
  }
}

document.getElementById('formNewEntry').addEventListener('submit', async (e) => {
  e.preventDefault();
  const content = document.getElementById('journalContent').value.trim();
  const inputSource = document.getElementById('inputSource').value;
  const themesInput = document.getElementById('entryThemes').value.trim();
  const themes = themesInput ? themesInput.split(',').map((s) => s.trim()) : [];

  if (!content) return;

  const btn = document.getElementById('btnSubmitEntry');
  btn.textContent = 'Processing with AI Models...';
  btn.disabled = true;

  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/journal-entries', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content,
        input_source: inputSource,
        extracted_themes: themes
      })
    });
    const json = await res.json();
    logConsole('POST /api/journal-entries', json);

    if (json.success) {
      document.getElementById('journalContent').value = '';
      document.getElementById('entryThemes').value = '';

      // Show generated reflection prompt if available
      const prompt = json.data.reflection_prompt;
      if (prompt && prompt.prompt_text) {
        document.getElementById('cbtPromptText').textContent = prompt.prompt_text;
        document.getElementById('latestAnalysisResult').style.display = 'block';
        lastCreatedPromptId = json.data.id;
      }

      loadJournalEntries();
    } else {
      alert(`Error creating entry: ${json.error?.message}`);
    }
  } catch (err) {
    logConsole('Error creating journal entry', err.message);
  } finally {
    btn.textContent = 'Process & Save Entry';
    btn.disabled = false;
  }
});

document.getElementById('btnSubmitCbtResponse').addEventListener('click', async () => {
  const responseText = document.getElementById('cbtResponseInput').value.trim();
  if (!responseText || !lastCreatedPromptId) return;

  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/journal-entries/${lastCreatedPromptId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        reflection_prompt: {
          user_response: responseText,
          was_helpful: true
        }
      })
    });
    const json = await res.json();
    logConsole(`PATCH /api/journal-entries/${lastCreatedPromptId}`, json);
    alert('Reflection response saved!');
    document.getElementById('latestAnalysisResult').style.display = 'none';
    loadJournalEntries();
  } catch (err) {
    logConsole('Error submitting reflection', err.message);
  }
});

document.getElementById('btnRefreshEntries').addEventListener('click', loadJournalEntries);

// 2. Extracted Memories
async function loadMemories() {
  const container = document.getElementById('memoriesList');
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/memories', { headers });
    const json = await res.json();
    logConsole('GET /api/memories', json);

    if (!json.success || !json.data || json.data.length === 0) {
      container.innerHTML = '<p style="color: var(--text-dim); font-size: 13px;">No long-term memories extracted yet.</p>';
      return;
    }

    container.innerHTML = json.data
      .map((mem) => `
        <div class="entry-item">
          <div class="entry-meta">
            <span class="emotion-badge">${mem.memory_type}</span>
            <span>Importance: ${(mem.importance_score * 100).toFixed(0)}%</span>
          </div>
          <div class="entry-content">${mem.memory_text}</div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" onclick="window.sendMemoryFeedback('${mem.id}', 'agree')">👍 Agree</button>
            <button class="btn btn-secondary btn-sm" onclick="window.sendMemoryFeedback('${mem.id}', 'disagree')">👎 Disagree</button>
          </div>
        </div>
      `)
      .join('');
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger); font-size: 13px;">Error: ${err.message}</p>`;
  }
}

window.sendMemoryFeedback = async (memoryId, feedback) => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/memories/${memoryId}/feedback`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_feedback: feedback,
        is_accurate: feedback === 'agree'
      })
    });
    const json = await res.json();
    logConsole(`POST /api/memories/${memoryId}/feedback`, json);
    alert(`Feedback (${feedback}) submitted! Model importance score updated.`);
    loadMemories();
  } catch (err) {
    logConsole('Feedback error', err.message);
  }
};

document.getElementById('formAddMemory').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = document.getElementById('customMemoryText').value.trim();
  const type = document.getElementById('customMemoryType').value;
  if (!text) return;

  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/memories', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        memory_text: text,
        memory_type: type,
        importance_score: 0.8
      })
    });
    const json = await res.json();
    logConsole('POST /api/memories', json);
    document.getElementById('customMemoryText').value = '';
    loadMemories();
  } catch (err) {
    logConsole('Add memory error', err.message);
  }
});

document.getElementById('btnRefreshMemories').addEventListener('click', loadMemories);

// 3. Therapist Consent & Bridges
async function loadConsent() {
  const container = document.getElementById('consentBridgesList');
  const auditContainer = document.getElementById('consentAuditList');

  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/consent', { headers });
    const json = await res.json();
    logConsole('GET /api/consent', json);

    if (json.success) {
      const bridges = json.data.activeBridges || [];
      if (bridges.length === 0) {
        container.innerHTML = '<p style="color: var(--text-dim); font-size: 13px;">No therapist bridges established.</p>';
      } else {
        container.innerHTML = bridges
          .map((b) => `
            <div class="entry-item">
              <div class="entry-meta">
                <span>Therapist: <strong>${b.therapist_id}</strong></span>
                <span style="color: ${b.consent_granted ? 'var(--success)' : 'var(--danger)'};">
                  ${b.consent_granted ? '● Active Consent' : '○ Revoked'}
                </span>
              </div>
              <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">
                Access: <code>${b.access_level}</code> &bull; Red Flags: ${b.red_flag_alerts_enabled ? 'Enabled' : 'Disabled'}
              </div>
              ${
                b.consent_granted
                  ? `<button class="btn btn-danger btn-sm" onclick="window.revokeConsent('${b.therapist_id}')">Revoke Consent</button>`
                  : ''
              }
            </div>
          `)
          .join('');
      }

      const audit = json.data.auditHistory || [];
      if (audit.length === 0) {
        auditContainer.innerHTML = '<p style="color: var(--text-dim); font-size: 12px;">No consent audit history.</p>';
      } else {
        auditContainer.innerHTML = audit
          .map((a) => `
            <div style="font-size: 12px; border-bottom: 1px solid var(--border-color); padding: 6px 0;">
              <strong>[${a.action.toUpperCase()}]</strong> ${a.feature_affected} &bull; Therapist: ${a.metadata?.therapist_id || 'N/A'}
            </div>
          `)
          .join('');
      }
    }
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger); font-size: 13px;">Error: ${err.message}</p>`;
  }
}

window.revokeConsent = async (therapistId) => {
  if (!confirm(`Are you sure you want to revoke therapist consent for ${therapistId}?`)) return;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/consent/therapist', {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ therapist_id: therapistId })
    });
    const json = await res.json();
    logConsole('DELETE /api/consent/therapist', json);
    loadConsent();
  } catch (err) {
    logConsole('Revoke consent error', err.message);
  }
};

document.getElementById('formGrantConsent').addEventListener('submit', async (e) => {
  e.preventDefault();
  const therapistId = document.getElementById('therapistUid').value.trim();
  const accessLevel = document.getElementById('accessLevel').value;
  const redFlags = document.getElementById('enableRedFlagAlerts').checked;

  if (!therapistId) return;

  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/consent/therapist', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        therapist_id: therapistId,
        access_level: accessLevel,
        red_flag_alerts_enabled: redFlags
      })
    });
    const json = await res.json();
    logConsole('POST /api/consent/therapist', json);
    alert('Therapist consent successfully granted and recorded to immutable audit log.');
    document.getElementById('therapistUid').value = '';
    loadConsent();
  } catch (err) {
    logConsole('Grant consent error', err.message);
  }
});

document.getElementById('btnRefreshConsent').addEventListener('click', loadConsent);

// 4. Safety Alerts
async function loadSafetyAlerts() {
  const container = document.getElementById('safetyAlertsList');
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/safety-alerts', { headers });
    const json = await res.json();
    logConsole('GET /api/safety-alerts', json);

    if (!json.success || !json.data || json.data.length === 0) {
      container.innerHTML = '<p style="color: var(--text-dim); font-size: 13px;">No red flag alerts on record. Your safety indicators are clear.</p>';
      return;
    }

    container.innerHTML = json.data
      .map((alert) => `
        <div class="entry-item" style="border-left: 4px solid ${alert.severity === 'high' ? 'var(--danger)' : 'var(--warning)'};">
          <div class="entry-meta">
            <span style="font-weight: 600; color: #fca5a5;">⚠️ ${alert.alert_type.toUpperCase()} (${alert.severity})</span>
            <span class="emotion-badge">Status: ${alert.alert_status}</span>
          </div>
          <div class="entry-content">${alert.trigger_reason}</div>
          <div style="font-size: 12px; color: var(--text-dim);">
            Assigned Therapist: ${alert.therapist_id || 'None'}
          </div>
        </div>
      `)
      .join('');
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger); font-size: 13px;">Error: ${err.message}</p>`;
  }
}

document.getElementById('btnRefreshSafety').addEventListener('click', loadSafetyAlerts);

// 5. Biometrics
async function loadBiometrics() {
  const container = document.getElementById('biometricsLogsList');
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/biometrics', { headers });
    const json = await res.json();
    logConsole('GET /api/biometrics', json);

    if (!json.success || !json.data || json.data.length === 0) {
      container.innerHTML = '<p style="color: var(--text-dim); font-size: 13px;">No biometric sync logs recorded yet.</p>';
      return;
    }

    container.innerHTML = json.data
      .map((log) => `
        <div class="entry-item">
          <div class="entry-meta">
            <span>Provider: <strong>${log.provider}</strong></span>
            <span style="color: ${log.status === 'success' ? 'var(--success)' : 'var(--danger)'};">Status: ${log.status}</span>
          </div>
          <div style="font-size: 13px; color: var(--text-muted);">
            Metrics count: ${log.data_synced?.metrics_count ?? 'N/A'} &bull; Range: ${log.data_synced?.date_range ?? 'N/A'}
          </div>
        </div>
      `)
      .join('');
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger); font-size: 13px;">Error: ${err.message}</p>`;
  }
}

document.getElementById('formSyncBiometrics').addEventListener('submit', async (e) => {
  e.preventDefault();
  const provider = document.getElementById('bioProvider').value;
  const hr = parseFloat(document.getElementById('bioRestingHr').value);
  const hrv = parseFloat(document.getElementById('bioHrv').value);
  const sleep = parseFloat(document.getElementById('bioSleepHours').value);
  const stress = parseInt(document.getElementById('bioStress').value, 10);

  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/biometrics/sync', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        provider,
        metrics: {
          resting_hr: hr,
          hr_variability: hrv,
          sleep_hours: sleep,
          stress_level: stress
        }
      })
    });
    const json = await res.json();
    logConsole('POST /api/biometrics/sync', json);
    alert('Biometrics successfully synced and logged!');
    loadBiometrics();
  } catch (err) {
    logConsole('Biometric sync error', err.message);
  }
});

document.getElementById('btnRefreshBiometrics').addEventListener('click', loadBiometrics);

// 6. Diagnostics & Health Check
async function runHealthCheck() {
  const container = document.getElementById('healthResults');
  container.innerHTML = '<p>Running diagnostics...</p>';

  try {
    const [hRes, fbRes, mRes] = await Promise.all([
      fetch('/api/health'),
      fetch('/api/health/firebase'),
      fetch('/api/health/model')
    ]);

    const hJson = await hRes.json();
    const fbJson = await fbRes.json();
    const mJson = await mRes.json();

    logConsole('Health Checks', { core: hJson, firebase: fbJson, model: mJson });

    container.innerHTML = `
      <div><strong>Core Server:</strong> <span style="color: var(--success);">${hJson.data?.status}</span> (${hJson.data?.service})</div>
      <div><strong>Firebase Project:</strong> <code>${fbJson.data?.firebase?.projectId}</code></div>
      <div><strong>Firestore Status:</strong> <span style="color: ${fbJson.data?.status === 'healthy' ? 'var(--success)' : 'var(--warning)'};">${fbJson.data?.status}</span> (region: ${fbJson.data?.firebase?.databaseLocation})</div>
      <div><strong>AI Model Adapter:</strong> <span style="color: #a855f7;">${mJson.data?.adapter || 'active'}</span> (${mJson.data?.status})</div>
    `;
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger);">Health check failed: ${err.message}</p>`;
  }
}

document.getElementById('btnCheckHealth').addEventListener('click', runHealthCheck);

// Initial run
runHealthCheck();
