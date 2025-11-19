/**
 * Meeting Recorder - Renderer Process
 *
 * UI logic for settings window
 * Communicates with main process via IPC bridge (preload.js)
 */

// API is exposed via preload.js
const api = window.meetingRecorder;

// State
let currentSettings = {};
let recordings = [];

/**
 * ============================================
 * Initialization
 * ============================================
 */

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Settings UI loaded');

  // Load initial data
  await loadSettings();
  await loadDependencies();
  await loadRecordings();
  await loadStorageStats();
  await loadVersion();

  // Setup event listeners
  setupEventListeners();

  // Setup IPC event listeners
  setupIPCListeners();

  // Setup keyboard shortcuts
  setupKeyboardShortcuts();
});

/**
 * ============================================
 * Data Loading
 * ============================================
 */

async function loadSettings() {
  try {
    currentSettings = await api.getSettings();
    console.log('Settings loaded:', currentSettings);

    // Update UI
    document.getElementById('output-directory').value = currentSettings.outputDirectory;
    document.getElementById('retention-days').value = currentSettings.retentionDays;
    document.getElementById('auto-process').checked = currentSettings.autoProcess;

    updateRetentionLabel(currentSettings.retentionDays);
  } catch (err) {
    console.error('Failed to load settings:', err);
    showError('Failed to load settings');
  }
}

async function loadDependencies() {
  try {
    const deps = await api.checkDependencies();
    console.log('Dependencies:', deps);

    updateStatusIcon('status-sox', deps.sox);
    updateStatusIcon('status-whisper', deps.whisper);
    updateStatusIcon('status-ollama', deps.ollama);
    updateStatusIcon('status-blackhole', deps.blackhole);
  } catch (err) {
    console.error('Failed to check dependencies:', err);
  }
}

async function loadRecordings() {
  const list = document.getElementById('recordings-list');

  try {
    list.innerHTML = '<div class="loading">Loading recordings...</div>';

    recordings = await api.listRecordings();
    console.log(`Loaded ${recordings.length} recordings`);

    if (recordings.length === 0) {
      list.innerHTML = '<div class="empty-state">No recordings yet.<br>Start recording from the menu bar!</div>';
      return;
    }

    // Render recordings
    list.innerHTML = recordings.map(rec => renderRecordingItem(rec)).join('');

    // Add event listeners
    recordings.forEach((rec, index) => {
      const deleteBtn = document.getElementById(`delete-${index}`);
      const openBtn = document.getElementById(`open-${index}`);
      const processBtn = document.getElementById(`process-${index}`);

      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => handleDeleteRecording(rec.filename));
      }

      if (openBtn) {
        openBtn.addEventListener('click', () => handleOpenFile(rec.filepath));
      }

      if (processBtn && !rec.transcribed) {
        processBtn.addEventListener('click', () => handleProcessRecording(rec.filepath));
      }
    });
  } catch (err) {
    console.error('Failed to load recordings:', err);
    list.innerHTML = `
      <div class="empty-state">
        Failed to load recordings<br>
        <button class="btn btn-secondary" onclick="loadRecordings()">Retry</button>
      </div>
    `;
    showError('Failed to load recordings');
  }
}

async function loadStorageStats() {
  try {
    const stats = await api.getStorageStats();
    console.log('Storage stats:', stats);

    document.getElementById('stat-total-size').textContent = stats.totalSizeFormatted;
    document.getElementById('stat-recordings').textContent = stats.recordingsCount;
    document.getElementById('stat-transcripts').textContent = stats.transcriptsCount;
    document.getElementById('stat-notes').textContent = stats.notesCount;
  } catch (err) {
    console.error('Failed to load storage stats:', err);
  }
}

async function loadVersion() {
  try {
    const version = await api.getVersion();
    document.getElementById('version').textContent = `v${version}`;
  } catch (err) {
    console.error('Failed to load version:', err);
  }
}

/**
 * ============================================
 * UI Rendering
 * ============================================
 */

function renderRecordingItem(rec) {
  const date = new Date(rec.created);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString();
  const sizeStr = formatFileSize(rec.size);

  const index = recordings.indexOf(rec);

  return `
    <div class="recording-item">
      <div class="recording-info">
        <div class="recording-name">${rec.filename}</div>
        <div class="recording-meta">
          <span>${dateStr} ${timeStr}</span>
          <span>${sizeStr}</span>
        </div>
      </div>
      <div class="recording-badges">
        ${rec.transcribed ? '<span class="badge badge-success">Transcribed</span>' : '<span class="badge badge-warning">Not transcribed</span>'}
        ${rec.summarized ? '<span class="badge badge-success">Summarized</span>' : ''}
      </div>
      <div class="recording-actions">
        <button class="icon-btn" id="open-${index}" title="Open file">📂</button>
        ${!rec.transcribed ? `<button class="icon-btn" id="process-${index}" title="Process recording">⚙️</button>` : ''}
        <button class="icon-btn danger" id="delete-${index}" title="Delete">🗑️</button>
      </div>
    </div>
  `;
}

function updateStatusIcon(elementId, isOk) {
  const element = document.getElementById(elementId);
  if (!element) return;

  element.textContent = isOk ? '✅' : '❌';
}

function updateRetentionLabel(days) {
  const label = document.getElementById('retention-days-value');
  label.textContent = `${days} day${days !== 1 ? 's' : ''}`;
}

/**
 * ============================================
 * Event Handlers
 * ============================================
 */

function setupEventListeners() {
  // Retention days slider
  document.getElementById('retention-days').addEventListener('input', (e) => {
    updateRetentionLabel(e.target.value);
  });

  // Refresh dependencies
  document.getElementById('btn-refresh-deps').addEventListener('click', async () => {
    await loadDependencies();
  });

  // Refresh recordings list
  document.getElementById('btn-refresh-list').addEventListener('click', async () => {
    await loadRecordings();
  });

  // Cleanup old files
  document.getElementById('btn-cleanup').addEventListener('click', handleCleanup);

  // Open output directory
  document.getElementById('btn-open-output').addEventListener('click', async () => {
    await api.openOutputDirectory();
  });

  // Change output directory
  document.getElementById('btn-change-dir').addEventListener('click', () => {
    alert('Directory selection will be implemented in a future update.\nFor now, modify the setting directly in electron-store.');
  });

  // Reset settings
  document.getElementById('btn-reset-settings').addEventListener('click', handleResetSettings);

  // Save settings
  document.getElementById('btn-save').addEventListener('click', handleSaveSettings);
}

function setupIPCListeners() {
  // Listen for processing progress
  api.onProcessingProgress((data) => {
    showProcessingOverlay(data.stage, data.message, data.progress);
  });

  // Listen for errors
  api.onError((data) => {
    console.error('IPC Error:', data);
    showError(data.error);
    hideProcessingOverlay();
  });

  // Listen for notifications
  api.onNotification((data) => {
    console.log('Notification:', data);
    // Show toast based on notification type
    const type = data.type || 'info';
    showToast(data.message, type);
  });
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + S: Save settings
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSaveSettings();
    }

    // Cmd/Ctrl + R: Refresh recordings
    if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
      e.preventDefault();
      loadRecordings();
      showInfo('Refreshing recordings...');
    }

    // Cmd/Ctrl + D: Check dependencies
    if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
      e.preventDefault();
      loadDependencies();
      showInfo('Checking dependencies...');
    }

    // Cmd/Ctrl + W: Close window (handled by Electron)
    // Escape: Close any overlays
    if (e.key === 'Escape') {
      const overlay = document.getElementById('processing-overlay');
      if (!overlay.classList.contains('hidden')) {
        // Don't close overlay during processing
        e.preventDefault();
      }
    }
  });
}

async function handleSaveSettings() {
  try {
    const newSettings = {
      outputDirectory: document.getElementById('output-directory').value,
      retentionDays: parseInt(document.getElementById('retention-days').value),
      autoProcess: document.getElementById('auto-process').checked
    };

    const result = await api.updateSettings(newSettings);

    if (result.success) {
      currentSettings = newSettings;
      showSuccess('Settings saved successfully');
    } else {
      showError('Failed to save settings: ' + result.error);
    }
  } catch (err) {
    console.error('Failed to save settings:', err);
    showError('Failed to save settings');
  }
}

async function handleResetSettings() {
  if (!confirm('Are you sure you want to reset all settings to defaults?')) {
    return;
  }

  try {
    const result = await api.resetSettings();

    if (result.success) {
      await loadSettings();
      showSuccess('Settings reset to defaults');
    } else {
      showError('Failed to reset settings');
    }
  } catch (err) {
    console.error('Failed to reset settings:', err);
    showError('Failed to reset settings');
  }
}

async function handleDeleteRecording(filename) {
  if (!confirm(`Delete recording "${filename}"?\n\nThis will also delete associated transcripts and notes.`)) {
    return;
  }

  try {
    const result = await api.deleteRecording(filename);

    if (result.success) {
      showSuccess(`Deleted ${result.deletedFiles.length} file(s)`);
      await loadRecordings();
      await loadStorageStats();
    } else {
      showError('Failed to delete recording: ' + result.error);
    }
  } catch (err) {
    console.error('Failed to delete recording:', err);
    showError('Failed to delete recording');
  }
}

async function handleOpenFile(filepath) {
  try {
    await api.openFile(filepath);
  } catch (err) {
    console.error('Failed to open file:', err);
    showError('Failed to open file');
  }
}

async function handleProcessRecording(wavPath) {
  try {
    showProcessingOverlay('Processing', 'Starting transcription...', 0);

    const result = await api.processRecording(wavPath);

    hideProcessingOverlay();

    if (result.success) {
      showSuccess('Processing complete!');
      await loadRecordings();
    } else {
      showError('Processing failed: ' + result.error);
    }
  } catch (err) {
    console.error('Failed to process recording:', err);
    hideProcessingOverlay();
    showError('Processing failed');
  }
}

async function handleCleanup() {
  const retentionDays = parseInt(document.getElementById('retention-days').value);

  if (!confirm(`Delete recordings older than ${retentionDays} days?\n\nTranscripts and notes will be preserved.`)) {
    return;
  }

  try {
    const result = await api.cleanupOldRecordings();

    if (result.success) {
      showSuccess(`Cleaned up ${result.deletedCount} old recording(s)`);
      await loadRecordings();
      await loadStorageStats();
    } else {
      showError('Cleanup failed: ' + result.error);
    }
  } catch (err) {
    console.error('Cleanup failed:', err);
    showError('Cleanup failed');
  }
}

/**
 * ============================================
 * UI Helpers
 * ============================================
 */

function showProcessingOverlay(stage, message, progress) {
  const overlay = document.getElementById('processing-overlay');
  const stageEl = document.getElementById('processing-stage');
  const messageEl = document.getElementById('processing-message');
  const progressFill = document.getElementById('progress-fill');
  const progressPercent = document.getElementById('processing-percent');

  stageEl.textContent = stage;
  messageEl.textContent = message;
  progressFill.style.width = `${progress}%`;
  progressPercent.textContent = `${progress}%`;

  overlay.classList.remove('hidden');
}

function hideProcessingOverlay() {
  const overlay = document.getElementById('processing-overlay');
  overlay.classList.add('hidden');
}

/**
 * Show toast notification
 * @param {string} message - The message to display
 * @param {string} type - Type: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in ms (default: 4000)
 */
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  // Icon based on type
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  // Title based on type
  const titles = {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Info'
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <div class="toast-content">
      <div class="toast-title">${titles[type]}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close">&times;</button>
  `;

  // Add to container
  container.appendChild(toast);

  // Close button handler
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    removeToast(toast);
  });

  // Auto-remove after duration
  setTimeout(() => {
    removeToast(toast);
  }, duration);
}

function removeToast(toast) {
  toast.classList.add('hiding');
  setTimeout(() => {
    toast.remove();
  }, 300);
}

function showSuccess(message) {
  showToast(message, 'success');
}

function showError(message) {
  showToast(message, 'error', 6000); // Longer duration for errors
}

function showWarning(message) {
  showToast(message, 'warning');
}

function showInfo(message) {
  showToast(message, 'info');
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
