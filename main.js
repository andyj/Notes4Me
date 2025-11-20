const { app, Tray, Menu, BrowserWindow, shell, nativeImage, Notification, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const { execSync } = require('child_process');

const Recorder = require('./services/recorder');
const { transcribe, verifyInstallation: verifyWhisper } = require('./services/transcriber');
const { generateNotes, checkOllamaHealth } = require('./services/summarizer');
const { ensureDirectoryStructure, cleanupOldRecordings, getStorageStats } = require('./services/fileManager');

// Persistent config store
const store = new Store({
  defaults: {
    outputDirectory: path.join(app.getPath('documents'), 'MeetingRecordings'),
    retentionDays: 7,
    autoProcess: true  // Automatically transcribe and generate notes after recording
  }
});

let tray = null;
let settingsWindow = null;
let recorder = null;
let currentRecordingPath = null;
let statusUpdateInterval = null;

// Track active processes for cleanup
const activeProcesses = new Set();

// Track dependency status
let dependenciesStatus = {
  sox: false,
  whisper: false,
  ollama: false,
  lastChecked: null
};

/**
 * Register a child process for cleanup on app exit
 */
function registerProcess(proc) {
  activeProcesses.add(proc);
  proc.on('exit', () => activeProcesses.delete(proc));
}

/**
 * Check if all required dependencies are installed
 */
function checkDependencies() {
  console.log('\n=== Checking Dependencies ===');

  const status = {
    sox: false,
    whisper: false,
    ollama: null, // null = checking, true = available, false = unavailable
    lastChecked: Date.now()
  };

  // Check sox
  console.log('Checking sox...');
  try {
    const soxPath = execSync('which sox', { encoding: 'utf-8' }).trim();
    console.log(`✅ sox found at: ${soxPath}`);

    // Also check version
    try {
      const soxVersion = execSync('sox --version', { encoding: 'utf-8' });
      console.log(`   Version: ${soxVersion.split('\n')[0]}`);
    } catch (e) {
      // Version check failed, but sox exists
    }

    status.sox = true;
  } catch (err) {
    console.log('❌ sox not found in PATH');
    console.log('   Run: brew install sox');
  }

  // Check whisper.cpp
  console.log('\nChecking whisper.cpp...');
  try {
    const whisperCheck = verifyWhisper();
    status.whisper = whisperCheck.installed;

    if (whisperCheck.installed) {
      console.log(`✅ whisper binary found at: ${whisperCheck.binaryPath}`);
      console.log(`✅ whisper model found at: ${whisperCheck.modelPath}`);
    } else {
      console.log('❌ whisper.cpp not found');
      console.log(`   Error: ${whisperCheck.error}`);
    }
  } catch (err) {
    console.log('❌ whisper.cpp check failed:', err.message);
    status.whisper = false;
  }

  // Check Ollama (async)
  console.log('\nChecking Ollama...');
  checkOllamaHealth()
    .then(() => {
      console.log('✅ Ollama is running and models available');
      status.ollama = true;
      dependenciesStatus.ollama = true;
      updateTrayMenu(); // Update menu when async check completes
    })
    .catch((err) => {
      console.log('❌ Ollama check failed:', err.message);
      status.ollama = false;
      dependenciesStatus.ollama = false;
      updateTrayMenu(); // Update menu when async check completes
    });

  console.log('\n=== Dependency Check Summary ===');
  console.log(`sox:     ${status.sox ? '✅' : '❌'}`);
  console.log(`whisper: ${status.whisper ? '✅' : '❌'}`);
  console.log(`ollama:  ${status.ollama === null ? '⏳ checking...' : (status.ollama ? '✅' : '❌')}`);
  console.log('================================\n');

  dependenciesStatus = status;
  return status;
}

/**
 * Show a user-friendly notification
 */
function showNotification(title, body, isError = false) {
  if (Notification.isSupported()) {
    new Notification({
      title: title,
      body: body,
      silent: false
    }).show();
  } else {
    // Fallback to dialog
    if (isError) {
      dialog.showErrorBox(title, body);
    }
  }
}

/**
 * Initialize recorder instance
 */
function initRecorder() {
  const outputDir = store.get('outputDirectory');
  ensureDirectoryStructure(outputDir);
  recorder = new Recorder(outputDir);
  console.log(`Recorder initialized with output directory: ${outputDir}`);
}

/**
 * Create a simple icon image with white background
 */
function createIconImage() {
  // Create a white circle icon as base64 PNG (32x32)
  // This is a white circle on transparent background
  const whiteCirclePng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA' +
    'dwAAAHcBx6XUPAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAPHSURBVFiFvZdL' +
    'aBNRFIa/mUknmUmbPJo0TZM2rY1aqFgRBBdCcSG4cePGhQs3uqiLghtBXIkLwY1YEXQhCC4EF4IIQRBC' +
    'UKQqraLWR2rTJk2TNk3zfMzMdVFbYjLJJBb8YWDmnHv+j3Pu3HsF/5MkSfobuAZ0As1ADfADKAA54A3w' +
    'RJblpf9CQPgL8RvAGWAb4PiHMQrwGLghy/JXPQL/JH4JuA5EtxivBm4Cl2VZVjcjIC4SHwcuapy/Clyy' +
    'WCyMjo6Sy+WoVCqEQiGi0SjJZBK32w3AHeBcPfE1AuIi8VngPIDX62VwcJBkMklTUxPBYBCHw0GxWCSd' +
    'TjM3N8f8/DyVSgWAOeCgLMsL6wSExMXi48BpgJ6eHk6dOkU8HtdU+ObNG+bm5lhcXGR5eRmAb8AeWZY/' +
    '/hYQEheLTwEHALq7uzl+/Djt7e2ahVer1VhYWOD9+/fMzs4CUAGOybI8vVZASFws/gToB+ju7ubYsWN0' +
    'dHTQCEqlEtPT07x9+5ZPnz4BfAcOybL8BiohcbH4B6APoKuri4GBAXbt2kVzc/Om51+tVpmdneX169d8' +
    '/vwZ4CtwUJblD0LiYvH3QB9AKpVi//79JBIJbDbbX01cLpeZmZlhamoKWZYBPgD7ZFkuCImLxd8BuwEC' +
    'gQD9/f309fXh9Xo3JbC8vMz09DSTk5OsrKwAFIBuWZbfCYmLxd8CXQAtLS3s3buX3bt34/F4NiWQz+d5' +
    '+fIlk5OTlEolgA/AblmW3wuJi8VfA50APp+Pnp4eent7cblcmxLI5XK8ePGCN2/eUC6XAT4Cu2VZ/iQk' +
    'LhZ/AXQAmM1mduzYQXd3N263e1MC2WyW58+fMzMzQ61WA/gM7JJl+bOQuFj8GdAOYDKZ2L59O7t376a1' +
    'tXVTAgsLC0xMTPD27Vv0ej3AF2CXLMtfhMTF4k+BFIDRaKS9vZ2uri6SyeSmBBYXF3n27Bnv3r1Dr9cD' +
    'fAW6ZFn+JiQuFn8MJAGMRiPJZJJUKkUikcBoNDYkUCgUePr0KR8/fkSv16PRUL4DKVmWvwuJi8UnQBJA' +
    'r9eTSCRIpVJs27ZNU/y3BJ48ecL169cpFosApVqtlpJl+YeQuFh8HOgB0Ol0xONxUqkUra2tmuK/JfD4' +
    '8WOuXbvGr1+/AAqyLO8REheLPwI6AXQ6HbFYjFQqRSwW0xT/LYEHDx5w9epVisUiQE6W5T1C4mLxh0AH' +
    'gF6vJxqN0tnZSTwe1xT/LYF79+5x+fJlCoUCQFaW5b1C4mLx+0AKwGAw0NraSiqVIhqNaor/Nzs7C0BW' +
    'luX9QuJi8XtAO4DRaCQSidDZ2UkkEtEU/5/8BhQtkX5GVVf+AAAAAElFTkSuQmCC',
    'base64'
  );

  return nativeImage.createFromBuffer(whiteCirclePng);
}

/**
 * Create menu bar tray icon
 */
function createTray() {
  const icon = createIconImage();
  tray = new Tray(icon);

  // Use text/emoji as the visible icon (works reliably on macOS)
  tray.setTitle('🤖✏️');
  tray.setToolTip('Notes4Me');

  updateTrayMenu();
}

/**
 * Create or show settings window
 */
function openSettingsWindow() {
  // If window already exists, focus it
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  // Create new window
  settingsWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 700,
    minHeight: 500,
    title: 'Meeting Recorder - Settings',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
    show: false  // Show after ready to prevent visual flash
  });

  settingsWindow.loadFile('renderer/index.html');

  // Show when ready
  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
  });

  // Clean up reference when closed
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  // Open DevTools in development (optional)
  // settingsWindow.webContents.openDevTools();
}

/**
 * Update tray menu based on recording state
 */
function updateTrayMenu() {
  const isRecording = recorder && recorder.isRecording;
  const status = recorder ? recorder.getStatus() : null;
  const canRecord = dependenciesStatus.sox;

  const menuTemplate = [
    {
      label: isRecording ? '⏹  Stop Recording' : '⏺  Start Recording',
      click: isRecording ? handleStopRecording : handleStartRecording,
      enabled: isRecording || canRecord
    },
    {
      label: isRecording ? `Recording: ${formatDuration(status.duration)}` : (canRecord ? 'Ready to record' : '⚠️ Dependencies missing'),
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Settings...',
      click: openSettingsWindow
    },
    { type: 'separator' },
    {
      label: 'Open Recordings Folder',
      click: () => {
        const recordingsPath = path.join(store.get('outputDirectory'), 'recordings');
        ensureDirectoryStructure(store.get('outputDirectory'));
        shell.openPath(recordingsPath);
      }
    },
    {
      label: 'View Processed Notes',
      click: () => {
        const processedPath = path.join(store.get('outputDirectory'), 'processed');
        ensureDirectoryStructure(store.get('outputDirectory'));
        shell.openPath(processedPath);
      }
    },
    { type: 'separator' },
    {
      label: '🔄 Refresh Dependencies',
      click: () => {
        checkDependencies();
        setTimeout(() => {
          showNotification('Dependencies Checked', 'Check the console for details');
        }, 500);
      }
    },
    {
      label: 'Check Dependencies',
      click: showDependencyStatus
    },
    {
      label: 'Run Setup Script',
      click: runSetupScript
    },
    { type: 'separator' },
    {
      label: 'Storage Stats',
      click: showStorageStats
    },
    {
      label: 'Cleanup Old Recordings',
      click: runCleanup
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ];

  const contextMenu = Menu.buildFromTemplate(menuTemplate);
  tray.setContextMenu(contextMenu);
}

/**
 * Start recording handler
 */
function handleStartRecording() {
  try {
    const result = recorder.start((warning) => {
      console.warn(warning);
      // TODO: Show notification in Phase 5
    });

    currentRecordingPath = result.filepath;
    console.log(`Recording started: ${currentRecordingPath}`);

    // Update tray icon to recording state
    tray.setTitle('🤖🔴');

    // Update menu every second to show elapsed time
    statusUpdateInterval = setInterval(() => {
      if (!recorder.isRecording) {
        clearInterval(statusUpdateInterval);
        statusUpdateInterval = null;
      } else {
        updateTrayMenu();
      }
    }, 1000);

    updateTrayMenu();

  } catch (err) {
    console.error('Failed to start recording:', err);

    // Show user-friendly notification
    const errorMessage = err.message.split('\n')[0]; // First line only
    showNotification('Cannot Start Recording', errorMessage, true);

    // If sox is missing, show setup instructions
    if (err.message.includes('sox')) {
      setTimeout(() => {
        const response = dialog.showMessageBoxSync({
          type: 'error',
          title: 'Dependencies Missing',
          message: 'sox is not installed',
          detail: 'sox is required for audio recording.\n\nWould you like to run the setup script now?',
          buttons: ['Run Setup', 'Install Manually', 'Cancel'],
          defaultId: 0
        });

        if (response === 0) {
          runSetupScript();
        } else if (response === 1) {
          shell.openExternal('https://github.com/andyjarrett/notes4me#setup');
        }
      }, 100);
    }
  }
}

/**
 * Stop recording handler
 */
async function handleStopRecording() {
  try {
    const result = await recorder.stop();

    console.log(`Recording stopped: ${result.filepath}`);
    console.log(`Duration: ${formatDuration(result.duration)}`);
    console.log(`Size: ${(result.size / (1024 * 1024)).toFixed(2)} MB`);

    // Reset tray icon to idle state
    tray.setTitle('🤖✏️');

    // Clear status update interval
    if (statusUpdateInterval) {
      clearInterval(statusUpdateInterval);
      statusUpdateInterval = null;
    }

    updateTrayMenu();

    // Start processing pipeline if auto-process is enabled
    const autoProcess = store.get('autoProcess');
    if (autoProcess) {
      processRecording(result.filepath, result.duration);
    }

  } catch (err) {
    console.error('Failed to stop recording:', err);
  }
}

/**
 * Process recording: transcribe audio and generate meeting notes
 *
 * Complete pipeline: WAV → Transcript → Meeting Notes
 *
 * @param {string} wavPath - Path to recording file
 * @param {number} duration - Recording duration in ms
 */
async function processRecording(wavPath, duration) {
  const outputDir = store.get('outputDirectory');

  try {
    // Step 1: Transcribe audio
    tray.setToolTip('Transcribing audio...');
    console.log(`Starting transcription for: ${wavPath}`);
    console.log(`Estimated time: ${formatDuration(duration / 5)} (at ~5x real-time)`);

    const transcriptPath = await transcribe(wavPath, outputDir, (progress) => {
      tray.setToolTip(`Transcribing: ${progress}%`);
      console.log(`Transcription progress: ${progress}%`);
    });

    console.log(`✅ Transcription complete: ${transcriptPath}`);

    // Step 2: Generate meeting notes
    tray.setToolTip('Generating notes...');
    console.log(`Starting note generation from: ${transcriptPath}`);

    const notesPath = await generateNotes(transcriptPath, (bytesWritten) => {
      // Optional progress tracking
      if (bytesWritten % 100 === 0) {  // Log every 100 bytes
        tray.setToolTip(`Generating notes... (${Math.floor(bytesWritten / 100)} chars)`);
      }
    });

    console.log(`✅ Note generation complete: ${notesPath}`);

    // Reset tooltip
    tray.setToolTip('Notes4Me');

    // Show completion notification
    console.log('🎉 Processing complete! Transcript and notes are ready.');
    tray.displayBalloon({
      title: 'Processing Complete',
      content: 'Meeting notes generated successfully!'
    });

    // Optionally open notes file
    // shell.openPath(notesPath);

  } catch (err) {
    console.error('Processing failed:', err);
    tray.setToolTip('Notes4Me');

    // Show error notification
    tray.displayBalloon({
      title: 'Processing Error',
      content: `Failed: ${err.message.split('\n')[0]}`
    });
  }
}

/**
 * Show storage statistics
 */
function showStorageStats() {
  const stats = getStorageStats(store.get('outputDirectory'));

  console.log('Storage Statistics:');
  console.log(`Total Size: ${stats.totalSizeFormatted}`);
  console.log(`Recordings: ${stats.recordingCount}`);
  console.log(`Transcripts: ${stats.transcriptCount}`);
  console.log(`Notes: ${stats.notesCount}`);

  // TODO: Show in dialog or notification in Phase 5
  tray.displayBalloon({
    title: 'Storage Stats',
    content: `Total: ${stats.totalSizeFormatted}\nRecordings: ${stats.recordingCount}\nTranscripts: ${stats.transcriptCount}`
  });
}

/**
 * Run cleanup of old recordings
 */
function runCleanup() {
  const deleted = cleanupOldRecordings(
    store.get('outputDirectory'),
    store.get('retentionDays')
  );

  console.log(`Cleanup complete. Deleted ${deleted.length} old recordings.`);

  if (deleted.length > 0) {
    console.log('Deleted files:', deleted);
  }

  // TODO: Show notification in Phase 5
}

/**
 * Show dependency status
 */
function showDependencyStatus() {
  const status = checkDependencies();

  const statusEmoji = (installed) => installed ? '✅' : '❌';
  const statusText = `Dependencies Status:\n\n` +
    `${statusEmoji(status.sox)} sox (audio recording)\n` +
    `${statusEmoji(status.whisper)} whisper.cpp (transcription)\n` +
    `${statusEmoji(status.ollama)} Ollama (AI notes)\n\n` +
    (status.sox && status.whisper && status.ollama
      ? 'All dependencies installed!'
      : 'Some dependencies are missing.\nRun "setup.sh" to install them.');

  dialog.showMessageBox({
    type: status.sox && status.whisper && status.ollama ? 'info' : 'warning',
    title: 'Dependency Status',
    message: 'Meeting Recorder Dependencies',
    detail: statusText,
    buttons: status.sox && status.whisper && status.ollama ? ['OK'] : ['Run Setup', 'OK']
  }).then((result) => {
    if (result.response === 0 && !(status.sox && status.whisper && status.ollama)) {
      runSetupScript();
    }
  });

  // Update menu after checking
  updateTrayMenu();
}

/**
 * Run setup script in terminal
 */
function runSetupScript() {
  const setupPath = path.join(__dirname, 'setup.sh');

  // Open Terminal and run setup script
  const command = `cd "${__dirname}" && chmod +x setup.sh && ./setup.sh`;

  try {
    // Use AppleScript to open Terminal and run setup
    const appleScript = `
      tell application "Terminal"
        activate
        do script "cd \\"${__dirname}\\" && chmod +x setup.sh && ./setup.sh"
      end tell
    `;

    require('child_process').exec(`osascript -e '${appleScript}'`, (err) => {
      if (err) {
        console.error('Failed to open Terminal:', err);
        dialog.showErrorBox(
          'Cannot Run Setup',
          `Failed to open Terminal.\n\nPlease run manually:\ncd ${__dirname}\n./setup.sh`
        );
      } else {
        showNotification(
          'Setup Started',
          'The setup script is running in Terminal. Follow the instructions there.'
        );
      }
    });
  } catch (err) {
    console.error('Failed to run setup script:', err);
    dialog.showErrorBox(
      'Cannot Run Setup',
      `Failed to run setup script.\n\nPlease run manually:\ncd ${__dirname}\n./setup.sh`
    );
  }
}

/**
 * Format duration in milliseconds to HH:MM:SS or MM:SS
 */
function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * ============================================
 * IPC Handlers
 * ============================================
 */

// Recording Controls
ipcMain.handle('recording:start', async () => {
  try {
    const result = recorder.start((warning) => {
      console.warn(warning);
    });
    currentRecordingPath = result.filepath;
    tray.setTitle('🤖🔴');
    updateTrayMenu();
    return { success: true, filepath: result.filepath };
  } catch (err) {
    console.error('IPC recording:start failed:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('recording:stop', async () => {
  try {
    const result = await recorder.stop();
    tray.setTitle('🤖✏️');
    updateTrayMenu();

    // Auto-process if enabled
    const autoProcess = store.get('autoProcess');
    if (autoProcess) {
      processRecording(result.filepath, result.duration).catch(err => {
        console.error('Auto-processing failed:', err);
      });
    }

    return {
      success: true,
      filepath: result.filepath,
      duration: result.duration,
      size: result.size
    };
  } catch (err) {
    console.error('IPC recording:stop failed:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('recording:status', async () => {
  if (!recorder) {
    return { isRecording: false };
  }

  const status = recorder.getStatus();
  return {
    isRecording: recorder.isRecording,
    duration: status.duration,
    fileSize: status.fileSize
  };
});

// File Management
ipcMain.handle('files:list', async () => {
  try {
    const recordingsDir = path.join(store.get('outputDirectory'), 'recordings');
    const processedDir = path.join(store.get('outputDirectory'), 'processed');

    if (!fs.existsSync(recordingsDir)) {
      return [];
    }

    const files = fs.readdirSync(recordingsDir)
      .filter(f => f.endsWith('.wav'))
      .map(filename => {
        const filepath = path.join(recordingsDir, filename);
        const stats = fs.statSync(filepath);
        const basename = path.basename(filename, '.wav');

        // Check for associated transcript and notes
        const transcriptPath = path.join(processedDir, `${basename}_transcript.txt`);
        const notesPath = path.join(processedDir, `${basename}_notes.md`);

        return {
          filename,
          filepath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          transcribed: fs.existsSync(transcriptPath),
          summarized: fs.existsSync(notesPath)
        };
      })
      .sort((a, b) => b.created - a.created); // Newest first

    return files;
  } catch (err) {
    console.error('IPC files:list failed:', err);
    return [];
  }
});

ipcMain.handle('files:stats', async () => {
  try {
    const stats = getStorageStats(store.get('outputDirectory'));
    return {
      totalSize: stats.totalSize,
      totalSizeFormatted: stats.totalSizeFormatted,
      recordingsCount: stats.recordingCount,
      transcriptsCount: stats.transcriptCount,
      notesCount: stats.notesCount
    };
  } catch (err) {
    console.error('IPC files:stats failed:', err);
    return {
      totalSize: 0,
      totalSizeFormatted: '0 B',
      recordingsCount: 0,
      transcriptsCount: 0,
      notesCount: 0
    };
  }
});

ipcMain.handle('files:delete', async (event, filename) => {
  try {
    const recordingsDir = path.join(store.get('outputDirectory'), 'recordings');
    const processedDir = path.join(store.get('outputDirectory'), 'processed');

    const deletedFiles = [];
    const basename = path.basename(filename, '.wav');

    // Delete recording
    const wavPath = path.join(recordingsDir, filename);
    if (fs.existsSync(wavPath)) {
      fs.unlinkSync(wavPath);
      deletedFiles.push(filename);
    }

    // Delete transcript
    const transcriptPath = path.join(processedDir, `${basename}_transcript.txt`);
    if (fs.existsSync(transcriptPath)) {
      fs.unlinkSync(transcriptPath);
      deletedFiles.push(`${basename}_transcript.txt`);
    }

    // Delete notes
    const notesPath = path.join(processedDir, `${basename}_notes.md`);
    if (fs.existsSync(notesPath)) {
      fs.unlinkSync(notesPath);
      deletedFiles.push(`${basename}_notes.md`);
    }

    return { success: true, deletedFiles };
  } catch (err) {
    console.error('IPC files:delete failed:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('files:cleanup', async () => {
  try {
    const deleted = cleanupOldRecordings(
      store.get('outputDirectory'),
      store.get('retentionDays')
    );

    // Calculate freed space
    let freedSpace = 0;
    // We can't calculate this accurately after deletion, but we can estimate

    return {
      success: true,
      deletedCount: deleted.length,
      deletedFiles: deleted,
      freedSpace
    };
  } catch (err) {
    console.error('IPC files:cleanup failed:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('files:open', async (event, filepath) => {
  try {
    await shell.openPath(filepath);
    return { success: true };
  } catch (err) {
    console.error('IPC files:open failed:', err);
    return { success: false, error: err.message };
  }
});

// Processing
ipcMain.handle('process:transcribe', async (event, wavPath) => {
  try {
    const outputDir = store.get('outputDirectory');
    const transcriptPath = await transcribe(wavPath, outputDir, (progress) => {
      // Send progress updates to renderer
      if (BrowserWindow.getAllWindows().length > 0) {
        BrowserWindow.getAllWindows()[0].webContents.send('processing:progress', {
          stage: 'transcription',
          progress,
          message: `Transcribing: ${progress}%`
        });
      }
    });

    return { success: true, transcriptPath };
  } catch (err) {
    console.error('IPC process:transcribe failed:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('process:summarize', async (event, transcriptPath) => {
  try {
    const notesPath = await generateNotes(transcriptPath, (bytesWritten) => {
      // Send progress updates to renderer
      if (BrowserWindow.getAllWindows().length > 0 && bytesWritten % 100 === 0) {
        BrowserWindow.getAllWindows()[0].webContents.send('processing:progress', {
          stage: 'summarization',
          progress: Math.floor(bytesWritten / 100),
          message: `Generating notes... (${Math.floor(bytesWritten / 100)} chars)`
        });
      }
    });

    return { success: true, notesPath };
  } catch (err) {
    console.error('IPC process:summarize failed:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('process:full', async (event, wavPath) => {
  try {
    const outputDir = store.get('outputDirectory');

    // Transcribe
    const transcriptPath = await transcribe(wavPath, outputDir, (progress) => {
      if (BrowserWindow.getAllWindows().length > 0) {
        BrowserWindow.getAllWindows()[0].webContents.send('processing:progress', {
          stage: 'transcription',
          progress,
          message: `Transcribing: ${progress}%`
        });
      }
    });

    // Generate notes
    const notesPath = await generateNotes(transcriptPath, (bytesWritten) => {
      if (BrowserWindow.getAllWindows().length > 0 && bytesWritten % 100 === 0) {
        BrowserWindow.getAllWindows()[0].webContents.send('processing:progress', {
          stage: 'summarization',
          progress: Math.floor(bytesWritten / 100),
          message: `Generating notes...`
        });
      }
    });

    return { success: true, transcriptPath, notesPath };
  } catch (err) {
    console.error('IPC process:full failed:', err);
    return { success: false, error: err.message };
  }
});

// Settings
ipcMain.handle('settings:get', async () => {
  return {
    outputDirectory: store.get('outputDirectory'),
    retentionDays: store.get('retentionDays'),
    autoProcess: store.get('autoProcess')
  };
});

ipcMain.handle('settings:update', async (event, settings) => {
  try {
    if (settings.outputDirectory !== undefined) {
      store.set('outputDirectory', settings.outputDirectory);
      // Reinitialize recorder with new directory
      initRecorder();
    }
    if (settings.retentionDays !== undefined) {
      store.set('retentionDays', settings.retentionDays);
    }
    if (settings.autoProcess !== undefined) {
      store.set('autoProcess', settings.autoProcess);
    }

    return { success: true };
  } catch (err) {
    console.error('IPC settings:update failed:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('settings:reset', async () => {
  try {
    store.clear();
    initRecorder();
    return { success: true };
  } catch (err) {
    console.error('IPC settings:reset failed:', err);
    return { success: false, error: err.message };
  }
});

// System Information
ipcMain.handle('system:dependencies', async () => {
  const status = checkDependencies();
  return {
    sox: status.sox,
    whisper: status.whisper,
    ollama: status.ollama,
    blackhole: status.sox // BlackHole check is part of sox check
  };
});

ipcMain.handle('system:version', async () => {
  return app.getVersion();
});

ipcMain.handle('system:openOutputDir', async () => {
  try {
    await shell.openPath(store.get('outputDirectory'));
    return { success: true };
  } catch (err) {
    console.error('IPC system:openOutputDir failed:', err);
    return { success: false, error: err.message };
  }
});

/**
 * App lifecycle: Ready
 */
app.whenReady().then(() => {
  console.log('Meeting Recorder starting...');
  console.log(`Electron version: ${process.versions.electron}`);
  console.log(`Node version: ${process.versions.node}`);

  // Initialize recorder and tray
  initRecorder();
  createTray();

  // Check dependencies on startup
  const deps = checkDependencies();

  // Run cleanup on startup
  runCleanup();

  console.log('Notes4Me ready. Click the menu bar icon to start recording.');

  // Show welcome message if dependencies are missing
  if (!deps.sox || !deps.whisper) {
    setTimeout(() => {
      const response = dialog.showMessageBoxSync({
        type: 'info',
        title: 'Welcome to Meeting Recorder',
        message: 'Setup Required',
        detail: 'Some dependencies are missing. Would you like to run the setup script now?\n\n' +
               'This will install:\n• sox (audio recording)\n• whisper.cpp (transcription)\n• Ollama (AI notes)',
        buttons: ['Run Setup', 'Check Status', 'Skip'],
        defaultId: 0
      });

      if (response === 0) {
        runSetupScript();
      } else if (response === 1) {
        showDependencyStatus();
      }
    }, 1000);
  }
});

/**
 * App lifecycle: Window all closed
 * Don't quit - we're a menu bar app
 */
app.on('window-all-closed', (e) => {
  // Prevent quit on window close for menu bar apps
  e.preventDefault();
});

/**
 * App lifecycle: Before quit
 * Clean up all processes
 */
app.on('before-quit', () => {
  console.log('App quitting, cleaning up...');

  // Stop recording if active
  if (recorder && recorder.isRecording) {
    console.log('Stopping active recording...');
    recorder.cleanup();
  }

  // Kill all registered child processes
  activeProcesses.forEach(proc => {
    try {
      proc.kill('SIGTERM');
    } catch (e) {
      // Process already dead
    }
  });
});

/**
 * Prevent multiple instances
 */
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('Another instance is already running. Quitting.');
  app.quit();
} else {
  app.on('second-instance', () => {
    console.log('Attempted to start second instance');
    // Focus the tray or show a notification
    if (tray) {
      tray.displayBalloon({
        title: 'Notes4Me',
        content: 'Already running in menu bar'
      });
    }
  });
}
