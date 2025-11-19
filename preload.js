/**
 * Preload Script for Meeting Recorder
 *
 * This script runs in the renderer process before the page loads.
 * It provides a secure bridge between the renderer and main process via contextBridge.
 *
 * Security:
 * - Only exposes specific whitelisted APIs
 * - No direct access to Node.js or Electron APIs from renderer
 * - All communication via IPC (Inter-Process Communication)
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Exposed API for renderer process
 *
 * All methods return Promises for async operations
 */
contextBridge.exposeInMainWorld('meetingRecorder', {
  // ============================================
  // Recording Controls
  // ============================================

  /**
   * Start audio recording
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  startRecording: () => ipcRenderer.invoke('recording:start'),

  /**
   * Stop audio recording
   * @returns {Promise<{success: boolean, filepath?: string, duration?: number, error?: string}>}
   */
  stopRecording: () => ipcRenderer.invoke('recording:stop'),

  /**
   * Get current recording status
   * @returns {Promise<{isRecording: boolean, duration?: number, fileSize?: number}>}
   */
  getRecordingStatus: () => ipcRenderer.invoke('recording:status'),

  // ============================================
  // File Management
  // ============================================

  /**
   * List all recordings
   * @returns {Promise<Array<{filename: string, size: number, created: Date, transcribed: boolean, summarized: boolean}>>}
   */
  listRecordings: () => ipcRenderer.invoke('files:list'),

  /**
   * Get storage statistics
   * @returns {Promise<{totalSize: number, recordingsCount: number, transcriptsCount: number, notesCount: number}>}
   */
  getStorageStats: () => ipcRenderer.invoke('files:stats'),

  /**
   * Delete a specific recording and its associated files
   * @param {string} filename - The recording filename
   * @returns {Promise<{success: boolean, deletedFiles: string[], error?: string}>}
   */
  deleteRecording: (filename) => ipcRenderer.invoke('files:delete', filename),

  /**
   * Clean up old recordings based on retention policy
   * @returns {Promise<{success: boolean, deletedCount: number, freedSpace: number}>}
   */
  cleanupOldRecordings: () => ipcRenderer.invoke('files:cleanup'),

  /**
   * Open a file in the default application
   * @param {string} filepath - Absolute path to file
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  openFile: (filepath) => ipcRenderer.invoke('files:open', filepath),

  // ============================================
  // Processing
  // ============================================

  /**
   * Transcribe a specific recording
   * @param {string} wavPath - Path to WAV file
   * @returns {Promise<{success: boolean, transcriptPath?: string, error?: string}>}
   */
  transcribeRecording: (wavPath) => ipcRenderer.invoke('process:transcribe', wavPath),

  /**
   * Generate notes from a transcript
   * @param {string} transcriptPath - Path to transcript file
   * @returns {Promise<{success: boolean, notesPath?: string, error?: string}>}
   */
  generateNotes: (transcriptPath) => ipcRenderer.invoke('process:summarize', transcriptPath),

  /**
   * Process a recording (transcribe + summarize)
   * @param {string} wavPath - Path to WAV file
   * @returns {Promise<{success: boolean, transcriptPath?: string, notesPath?: string, error?: string}>}
   */
  processRecording: (wavPath) => ipcRenderer.invoke('process:full', wavPath),

  // ============================================
  // Settings
  // ============================================

  /**
   * Get current application settings
   * @returns {Promise<Object>} Settings object
   */
  getSettings: () => ipcRenderer.invoke('settings:get'),

  /**
   * Update application settings
   * @param {Object} settings - Settings to update
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),

  /**
   * Reset settings to defaults
   * @returns {Promise<{success: boolean}>}
   */
  resetSettings: () => ipcRenderer.invoke('settings:reset'),

  // ============================================
  // System Information
  // ============================================

  /**
   * Check if all dependencies are installed
   * @returns {Promise<{sox: boolean, whisper: boolean, ollama: boolean, blackhole: boolean}>}
   */
  checkDependencies: () => ipcRenderer.invoke('system:dependencies'),

  /**
   * Get application version
   * @returns {Promise<string>} Version string
   */
  getVersion: () => ipcRenderer.invoke('system:version'),

  /**
   * Open output directory in Finder
   * @returns {Promise<{success: boolean}>}
   */
  openOutputDirectory: () => ipcRenderer.invoke('system:openOutputDir'),

  // ============================================
  // Event Listeners
  // ============================================

  /**
   * Listen for recording status updates
   * @param {Function} callback - Called with {isRecording: boolean, duration: number, fileSize: number}
   */
  onRecordingUpdate: (callback) => {
    ipcRenderer.on('recording:update', (event, data) => callback(data));
  },

  /**
   * Listen for processing progress updates
   * @param {Function} callback - Called with {stage: string, progress: number, message: string}
   */
  onProcessingProgress: (callback) => {
    ipcRenderer.on('processing:progress', (event, data) => callback(data));
  },

  /**
   * Listen for errors
   * @param {Function} callback - Called with {error: string, details: string}
   */
  onError: (callback) => {
    ipcRenderer.on('error', (event, data) => callback(data));
  },

  /**
   * Listen for notifications
   * @param {Function} callback - Called with {title: string, message: string, type: string}
   */
  onNotification: (callback) => {
    ipcRenderer.on('notification', (event, data) => callback(data));
  },

  /**
   * Remove event listener
   * @param {string} channel - Event channel name
   * @param {Function} callback - The callback to remove
   */
  removeListener: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  }
});

console.log('✅ Preload script loaded - API exposed to renderer');
