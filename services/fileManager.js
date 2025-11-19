const fs = require('fs');
const path = require('path');

const RETENTION_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Ensure directory structure exists
 *
 * Creates recordings/, processed/, and temp/ directories if they don't exist.
 *
 * @param {string} baseDir - Base directory for the application
 */
function ensureDirectoryStructure(baseDir) {
  const dirs = [
    path.join(baseDir, 'recordings'),
    path.join(baseDir, 'processed'),
    path.join(baseDir, 'temp')
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

/**
 * Clean up old recording files
 *
 * Deletes WAV files older than the retention period.
 * Transcripts and notes are NEVER deleted automatically.
 *
 * @param {string} baseDir - Base directory for the application
 * @param {number} [retentionDays=7] - Number of days to keep recordings
 * @returns {string[]} Array of deleted file names
 */
function cleanupOldRecordings(baseDir, retentionDays = RETENTION_DAYS) {
  const recordingsDir = path.join(baseDir, 'recordings');

  if (!fs.existsSync(recordingsDir)) {
    return [];
  }

  const now = Date.now();
  const maxAge = retentionDays * MS_PER_DAY;
  const deleted = [];

  try {
    const files = fs.readdirSync(recordingsDir);

    for (let file of files) {
      // Only delete WAV files
      if (!file.endsWith('.wav')) {
        continue;
      }

      const filepath = path.join(recordingsDir, file);

      try {
        const stats = fs.statSync(filepath);
        const age = now - stats.mtimeMs;

        if (age > maxAge) {
          fs.unlinkSync(filepath);
          deleted.push(file);
          console.log(`Deleted old recording: ${file}`);
        }
      } catch (err) {
        console.error(`Failed to process file ${file}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Failed to cleanup recordings:', err.message);
  }

  return deleted;
}

/**
 * Get storage statistics
 *
 * Calculates total disk usage and file counts for recordings and processed files.
 *
 * @param {string} baseDir - Base directory for the application
 * @returns {{totalSize: number, totalSizeFormatted: string, recordingCount: number, transcriptCount: number, notesCount: number}}
 */
function getStorageStats(baseDir) {
  let totalSize = 0;
  let recordingCount = 0;
  let transcriptCount = 0;
  let notesCount = 0;

  const recordingsDir = path.join(baseDir, 'recordings');
  const processedDir = path.join(baseDir, 'processed');

  // Count recordings
  if (fs.existsSync(recordingsDir)) {
    try {
      const files = fs.readdirSync(recordingsDir);
      files.forEach(file => {
        if (file.endsWith('.wav')) {
          try {
            const stats = fs.statSync(path.join(recordingsDir, file));
            totalSize += stats.size;
            recordingCount++;
          } catch (err) {
            // Skip files we can't access
          }
        }
      });
    } catch (err) {
      console.error('Failed to read recordings directory:', err.message);
    }
  }

  // Count processed files
  if (fs.existsSync(processedDir)) {
    try {
      const files = fs.readdirSync(processedDir);
      files.forEach(file => {
        try {
          const stats = fs.statSync(path.join(processedDir, file));
          totalSize += stats.size;

          if (file.endsWith('_transcript.txt')) {
            transcriptCount++;
          } else if (file.endsWith('_notes.md')) {
            notesCount++;
          }
        } catch (err) {
          // Skip files we can't access
        }
      });
    } catch (err) {
      console.error('Failed to read processed directory:', err.message);
    }
  }

  return {
    totalSize,
    totalSizeFormatted: formatBytes(totalSize),
    recordingCount,
    transcriptCount,
    notesCount
  };
}

/**
 * Format bytes to human-readable string
 *
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string (e.g., "1.5 GB")
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get recording age in days
 *
 * @param {string} filepath - Path to recording file
 * @returns {number} Age in days
 */
function getRecordingAge(filepath) {
  try {
    const stats = fs.statSync(filepath);
    const age = Date.now() - stats.mtimeMs;
    return Math.floor(age / MS_PER_DAY);
  } catch (err) {
    return 0;
  }
}

/**
 * List all recordings with metadata
 *
 * @param {string} baseDir - Base directory for the application
 * @returns {Array<{filename: string, filepath: string, size: number, age: number, sizeFormatted: string}>}
 */
function listRecordings(baseDir) {
  const recordingsDir = path.join(baseDir, 'recordings');

  if (!fs.existsSync(recordingsDir)) {
    return [];
  }

  const recordings = [];

  try {
    const files = fs.readdirSync(recordingsDir);

    files.forEach(file => {
      if (!file.endsWith('.wav')) {
        return;
      }

      const filepath = path.join(recordingsDir, file);

      try {
        const stats = fs.statSync(filepath);
        recordings.push({
          filename: file,
          filepath: filepath,
          size: stats.size,
          age: getRecordingAge(filepath),
          sizeFormatted: formatBytes(stats.size)
        });
      } catch (err) {
        // Skip files we can't access
      }
    });

    // Sort by modification time (newest first)
    recordings.sort((a, b) => {
      const statsA = fs.statSync(a.filepath);
      const statsB = fs.statSync(b.filepath);
      return statsB.mtimeMs - statsA.mtimeMs;
    });

  } catch (err) {
    console.error('Failed to list recordings:', err.message);
  }

  return recordings;
}

/**
 * Delete a specific recording
 *
 * @param {string} filepath - Full path to recording file
 * @returns {boolean} True if deleted successfully
 */
function deleteRecording(filepath) {
  try {
    if (fs.existsSync(filepath) && filepath.endsWith('.wav')) {
      fs.unlinkSync(filepath);
      console.log(`Deleted recording: ${filepath}`);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`Failed to delete recording: ${err.message}`);
    return false;
  }
}

module.exports = {
  ensureDirectoryStructure,
  cleanupOldRecordings,
  getStorageStats,
  formatBytes,
  listRecordings,
  deleteRecording,
  getRecordingAge
};
