const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Find whisper.cpp binary
 *
 * Checks multiple common installation locations.
 *
 * @returns {string} Path to whisper binary
 * @throws {Error} If whisper.cpp binary not found
 */
function findWhisperBinary() {
  const possiblePaths = [
    './whisper.cpp/build/bin/whisper-cli',    // New CMake build location
    './whisper.cpp/main',                      // Old Makefile location
    path.join(__dirname, '../whisper.cpp/build/bin/whisper-cli'),
    path.join(__dirname, '../whisper.cpp/main'),
    '/usr/local/bin/whisper',
    '/opt/homebrew/bin/whisper',
    path.join(process.env.HOME, '.local/bin/whisper')
  ];

  for (let p of possiblePaths) {
    const resolvedPath = path.resolve(p);
    if (fs.existsSync(resolvedPath)) {
      console.log(`Found whisper binary at: ${resolvedPath}`);
      return resolvedPath;
    }
  }

  throw new Error(
    'whisper.cpp binary not found.\n' +
    'Please run ./setup.sh or manually compile whisper.cpp:\n' +
    '  git clone https://github.com/ggerganov/whisper.cpp.git\n' +
    '  cd whisper.cpp && make'
  );
}

/**
 * Find whisper model file
 *
 * Checks multiple common model locations.
 *
 * @returns {string} Path to model file
 * @throws {Error} If model file not found
 */
function findWhisperModel() {
  const possibleModels = [
    './models/ggml-base.en.bin',
    './whisper.cpp/models/ggml-base.en.bin',
    path.join(__dirname, '../models/ggml-base.en.bin'),
    path.join(__dirname, '../whisper.cpp/models/ggml-base.en.bin'),
    path.join(process.env.HOME, '.whisper/models/ggml-base.en.bin')
  ];

  for (let m of possibleModels) {
    const resolvedPath = path.resolve(m);
    if (fs.existsSync(resolvedPath)) {
      console.log(`Found whisper model at: ${resolvedPath}`);
      return resolvedPath;
    }
  }

  throw new Error(
    'Whisper model not found.\n' +
    'Please run ./setup.sh or manually download:\n' +
    '  cd whisper.cpp\n' +
    '  bash ./models/download-ggml-model.sh base.en\n' +
    '  cp models/ggml-base.en.bin ../models/'
  );
}

/**
 * Transcribe audio file using whisper.cpp
 *
 * @param {string} wavPath - Path to WAV audio file
 * @param {string} outputDir - Base directory for output
 * @param {Function} [progressCallback] - Optional callback for progress updates (0-100)
 * @returns {Promise<string>} Path to generated transcript file
 * @throws {Error} If transcription fails
 */
async function transcribe(wavPath, outputDir, progressCallback) {
  // Verify input file exists
  if (!fs.existsSync(wavPath)) {
    throw new Error(`Audio file not found: ${wavPath}`);
  }

  // Get whisper binary and model
  const whisperBin = findWhisperBinary();
  const modelPath = findWhisperModel();

  // Ensure processed directory exists
  const processedDir = path.join(outputDir, 'processed');
  if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir, { recursive: true });
  }

  // Generate output filename
  const basename = path.basename(wavPath, '.wav');
  const outputPrefix = path.join(processedDir, `${basename}_transcript`);

  console.log(`Starting transcription: ${wavPath}`);
  console.log(`Output prefix: ${outputPrefix}`);

  return new Promise((resolve, reject) => {
    // Spawn whisper.cpp process
    const whisper = spawn(whisperBin, [
      '-m', modelPath,        // Model file
      '-f', wavPath,          // Input audio file
      '-otxt',                // Output format: txt
      '-of', outputPrefix,    // Output file prefix
      '--print-progress',     // Print progress to stderr
      '--language', 'en',     // Language: English
      '--threads', '4'        // Use 4 threads (adjust based on CPU)
    ]);

    let stderrData = '';
    let lastProgress = 0;

    // Capture stderr for progress updates
    whisper.stderr.on('data', (data) => {
      stderrData += data.toString();

      // Parse progress if callback provided
      if (progressCallback) {
        // whisper.cpp outputs progress like: "progress = 42%"
        const progressMatch = stderrData.match(/progress\s*=\s*(\d+)%/);
        if (progressMatch) {
          const progress = parseInt(progressMatch[1]);
          if (progress !== lastProgress) {
            lastProgress = progress;
            progressCallback(progress);
          }
        }
      }
    });

    // Capture stdout (may contain warnings or info)
    whisper.stdout.on('data', (data) => {
      console.log(`whisper stdout: ${data.toString().trim()}`);
    });

    // Handle completion
    whisper.on('close', (code) => {
      if (code === 0) {
        const transcriptPath = `${outputPrefix}.txt`;

        if (fs.existsSync(transcriptPath)) {
          console.log(`Transcription complete: ${transcriptPath}`);

          // Verify file has content
          const stats = fs.statSync(transcriptPath);
          if (stats.size === 0) {
            reject(new Error('Transcript file is empty. Audio may be silent or corrupted.'));
            return;
          }

          resolve(transcriptPath);
        } else {
          reject(new Error(`Transcript file not created: ${transcriptPath}`));
        }
      } else {
        reject(new Error(`whisper.cpp failed with exit code ${code}\n${stderrData}`));
      }
    });

    // Handle errors
    whisper.on('error', (err) => {
      reject(new Error(`Failed to start whisper.cpp: ${err.message}`));
    });
  });
}

/**
 * Get estimated transcription time
 *
 * Based on ~5x real-time processing speed for base.en model on Apple Silicon.
 *
 * @param {number} audioDurationMs - Audio duration in milliseconds
 * @returns {number} Estimated transcription time in milliseconds
 */
function estimateTranscriptionTime(audioDurationMs) {
  // Whisper processes at approximately 5x real-time on M1/M2
  return Math.ceil(audioDurationMs / 5);
}

/**
 * Verify whisper.cpp installation
 *
 * @returns {{installed: boolean, binaryPath: string|null, modelPath: string|null, error: string|null}}
 */
function verifyInstallation() {
  const result = {
    installed: false,
    binaryPath: null,
    modelPath: null,
    error: null
  };

  try {
    result.binaryPath = findWhisperBinary();
  } catch (err) {
    result.error = err.message;
    return result;
  }

  try {
    result.modelPath = findWhisperModel();
  } catch (err) {
    result.error = err.message;
    return result;
  }

  result.installed = true;
  return result;
}

module.exports = {
  transcribe,
  findWhisperBinary,
  findWhisperModel,
  estimateTranscriptionTime,
  verifyInstallation
};
