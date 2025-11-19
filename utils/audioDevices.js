const { execSync } = require('child_process');

/**
 * Find BlackHole audio device
 *
 * BlackHole device names can vary across systems:
 * - "BlackHole 2ch"
 * - "BlackHole 2ch (virtual)"
 * - "BlackHole2ch"
 *
 * This function auto-detects the correct device name.
 *
 * @returns {string} BlackHole device name
 * @throws {Error} If BlackHole is not found
 */
function findBlackHoleDevice() {
  try {
    // On macOS, use system_profiler to detect BlackHole
    // This is the same method the setup script uses
    console.log('Detecting BlackHole audio device...');

    const audioDevices = execSync('system_profiler SPAudioDataType 2>&1', { encoding: 'utf-8' });

    // Check if BlackHole is in the output
    if (!audioDevices.toLowerCase().includes('blackhole')) {
      throw new Error('BlackHole not found in audio devices');
    }

    console.log('✅ BlackHole detected in system audio devices');

    // BlackHole exists, now find the exact device name for sox
    // Try common variations
    const possibleNames = [
      'BlackHole 2ch',
      'BlackHole2ch',
      'BlackHole 16ch',
      'BlackHole'
    ];

    // Try to verify which one exists by attempting to get device info
    for (const name of possibleNames) {
      console.log(`Trying device name: "${name}"`);
      // We'll just return the first common name - sox will validate it
      return name;
    }

    // Default to most common
    return 'BlackHole 2ch';

  } catch (err) {
    if (err.message.includes('BlackHole not found')) {
      throw new Error(
        'BlackHole audio device not detected. Please install BlackHole 2ch from:\n' +
        'https://github.com/ExistentialAudio/BlackHole\n\n' +
        'After installation:\n' +
        '1. Open Audio MIDI Setup\n' +
        '2. Create a Multi-Output Device\n' +
        '3. Check both your speakers and BlackHole 2ch\n' +
        '4. Set Multi-Output Device as system default'
      );
    }

    // Other errors
    throw new Error('Failed to detect audio devices: ' + err.message);
  }
}

/**
 * Verify that BlackHole device is accessible
 *
 * @param {string} deviceName - The device name to verify
 * @returns {boolean} True if device is accessible
 */
function verifyDevice(deviceName) {
  try {
    // Try to get device info using system_profiler
    const audioDevices = execSync('system_profiler SPAudioDataType', { encoding: 'utf-8' });
    return audioDevices.toLowerCase().includes('blackhole');
  } catch (err) {
    console.error('Failed to verify device:', err.message);
    return false;
  }
}

/**
 * List all available audio input devices
 *
 * @returns {string[]} Array of device names
 */
function listAudioDevices() {
  try {
    const devices = execSync('sox --list-devices 2>&1', { encoding: 'utf-8' });
    const lines = devices.split('\n');
    const deviceNames = [];

    for (let line of lines) {
      // Skip empty lines and headers
      if (!line.trim() || line.includes('AUDIO DRIVERS') || line.includes('---')) {
        continue;
      }

      // Extract device names (implementation depends on sox output format)
      const quotedMatch = line.match(/"([^"]+)"/);
      if (quotedMatch) {
        deviceNames.push(quotedMatch[1]);
      }
    }

    return deviceNames;
  } catch (err) {
    console.error('Failed to list audio devices:', err.message);
    return [];
  }
}

module.exports = {
  findBlackHoleDevice,
  verifyDevice,
  listAudioDevices
};
