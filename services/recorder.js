const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { findBlackHoleDevice } = require('../utils/audioDevices');

/**
 * Audio Recorder Service
 *
 * Records system audio via sox (Sound eXchange) from BlackHole virtual device.
 * Handles subprocess management, file size monitoring, and graceful shutdown.
 */
class Recorder {
  /**
   * Create a new Recorder instance
   *
   * @param {string} outputDir - Base directory for recordings
   */
  constructor(outputDir) {
    this.outputDir = outputDir;
    this.soxProcess = null;
    this.currentFile = null;
    this.isRecording = false;
    this.startTime = null;
    this.sizeInterval = null;
    this.maxRecordingSize = 1024 * 1024 * 1024; // 1GB
  }

  /**
   * Start recording audio
   *
   * @param {Function} [warningCallback] - Optional callback for size warnings
   * @returns {{filepath: string, startTime: number}} Recording metadata
   * @throws {Error} If already recording or if device not found
   */
  start(warningCallback) {
    if (this.isRecording) {
      throw new Error('Already recording. Stop the current recording first.');
    }

    // Ensure recordings directory exists
    const recordingsDir = path.join(this.outputDir, 'recordings');
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true });
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    this.currentFile = path.join(recordingsDir, `${timestamp}_recording.wav`);

    // Detect BlackHole device
    let device;
    try {
      device = findBlackHoleDevice();
      console.log(`Using audio device: ${device}`);
    } catch (err) {
      throw new Error(`Failed to detect audio device: ${err.message}`);
    }

    // Start sox recording
    // Format: 48kHz, 16-bit, stereo WAV (high quality)
    this.soxProcess = spawn('sox', [
      '-t', 'coreaudio',     // CoreAudio driver (macOS)
      device,                // Input device
      '-r', '48000',         // Sample rate: 48kHz
      '-b', '16',            // Bit depth: 16-bit
      '-c', '2',             // Channels: stereo
      this.currentFile       // Output file
    ]);

    // Handle sox errors
    this.soxProcess.on('error', (err) => {
      console.error('sox process error:', err);
      this.isRecording = false;
      throw new Error(`Failed to start recording: ${err.message}`);
    });

    // Handle unexpected exit
    this.soxProcess.on('exit', (code, signal) => {
      if (this.isRecording) {
        console.error(`sox process exited unexpectedly: code=${code}, signal=${signal}`);
        this.isRecording = false;
      }
    });

    // Log sox stderr for debugging
    this.soxProcess.stderr.on('data', (data) => {
      console.log(`sox stderr: ${data}`);
    });

    this.isRecording = true;
    this.startTime = Date.now();

    // Start file size monitoring
    if (warningCallback) {
      this.startSizeMonitor(warningCallback);
    }

    return {
      filepath: this.currentFile,
      startTime: this.startTime
    };
  }

  /**
   * Stop recording audio
   *
   * @returns {Promise<{filepath: string, duration: number, size: number}>} Recording metadata
   * @throws {Error} If not currently recording
   */
  stop() {
    return new Promise((resolve, reject) => {
      if (!this.isRecording || !this.soxProcess) {
        reject(new Error('Not currently recording'));
        return;
      }

      // Stop size monitoring
      if (this.sizeInterval) {
        clearInterval(this.sizeInterval);
        this.sizeInterval = null;
      }

      // Wait for sox to finish writing
      this.soxProcess.on('exit', (code) => {
        this.isRecording = false;
        const duration = Date.now() - this.startTime;

        // Verify file exists and get size
        if (!fs.existsSync(this.currentFile)) {
          reject(new Error('Recording file was not created'));
          return;
        }

        const stats = fs.statSync(this.currentFile);

        // Verify file has content
        if (stats.size === 0) {
          reject(new Error('Recording file is empty. Check audio routing.'));
          return;
        }

        resolve({
          filepath: this.currentFile,
          duration: duration,
          size: stats.size
        });
      });

      // Send SIGTERM to gracefully stop sox
      try {
        this.soxProcess.kill('SIGTERM');
      } catch (err) {
        reject(new Error(`Failed to stop recording: ${err.message}`));
      }
    });
  }

  /**
   * Get current recording status
   *
   * @returns {{isRecording: boolean, duration: number, filepath: string}|null}
   */
  getStatus() {
    if (!this.isRecording) {
      return null;
    }

    return {
      isRecording: true,
      duration: Date.now() - this.startTime,
      filepath: this.currentFile
    };
  }

  /**
   * Monitor recording file size and warn if too large
   *
   * @param {Function} callback - Called with warning message if size exceeds limit
   * @private
   */
  startSizeMonitor(callback) {
    this.sizeInterval = setInterval(() => {
      if (!this.isRecording || !this.currentFile) {
        clearInterval(this.sizeInterval);
        return;
      }

      try {
        const stats = fs.statSync(this.currentFile);

        if (stats.size > this.maxRecordingSize) {
          const sizeMB = Math.round(stats.size / (1024 * 1024));
          callback(`Recording size is ${sizeMB}MB. Consider stopping to avoid disk space issues.`);
        }
      } catch (err) {
        // File might not exist yet
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Force cleanup (for emergency shutdown)
   */
  cleanup() {
    if (this.sizeInterval) {
      clearInterval(this.sizeInterval);
      this.sizeInterval = null;
    }

    if (this.soxProcess && this.isRecording) {
      try {
        this.soxProcess.kill('SIGKILL');
      } catch (err) {
        // Process already dead
      }
    }

    this.isRecording = false;
  }
}

module.exports = Recorder;
