# Notes4Me

> A privacy-focused macOS menu bar application for recording, transcribing, and summarising meetings using local AI processing.

**All data stays on your machine—no cloud uploads, no subscriptions, no privacy compromises.**

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [How It Works](#how-it-works)
- [System Requirements](#system-requirements)
- [Installation](#installation)
  - [Quick Start](#quick-start)
  - [Detailed Setup Guide](#detailed-setup-guide)
  - [Audio Routing Configuration](#audio-routing-configuration)
- [Usage](#usage)
  - [Starting the App](#starting-the-app)
  - [Recording Your First Meeting](#recording-your-first-meeting)
  - [Understanding the Output](#understanding-the-output)
  - [Settings & Configuration](#settings--configuration)
- [Performance](#performance)
- [Troubleshooting](#troubleshooting)
- [Privacy & Security](#privacy--security)
- [FAQ](#faq)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Notes4Me is a macOS menu bar application designed for professionals who want to record and transcribe meetings without compromising privacy. Unlike cloud-based solutions, all processing happens locally on your Mac using state-of-the-art open-source AI models.

**What makes Notes4Me different:**

- ✅ **Privacy-First**: Zero data leaves your machine
- ✅ **Cost-Effective**: No subscription fees or per-minute charges
- ✅ **Powerful**: Uses the same AI models as paid services
- ✅ **Fast**: ~5x real-time transcription on Apple Silicon
- ✅ **Intelligent**: Generates structured meeting notes with action items

---

## Features

### Core Functionality
- **Audio Recording**: Captures system audio from any application (Zoom, Google Meet, Microsoft Teams, etc.)
- **Speech-to-Text**: Converts recordings to accurate text transcripts using whisper.cpp
- **AI Summarisation**: Generates structured meeting notes with:
  - Action items and owners
  - Key takeaways
  - Meeting purpose and context
  - Problems, blockers, and solutions discussed
  - Next steps

### User Experience
- **Menu Bar Integration**: Lightweight tray app that's always accessible
- **One-Click Recording**: Start/stop recording with a single click
- **Automatic Processing**: Optionally transcribe and summarise recordings automatically
- **Settings UI**: Modern, dark-mode-enabled interface for configuration
- **File Management**: Automatic cleanup of old recordings with configurable retention (1-30 days)
- **Storage Tracking**: Monitor disk usage for recordings, transcripts, and notes

### Privacy & Performance
- **100% Local Processing**: No cloud APIs, no external services
- **Fast Transcription**: ~5x real-time on Apple Silicon (M1/M2/M3)
- **Efficient Summarisation**: 2-3 minutes for typical meetings
- **Secure by Design**: Electron security best practices with sandboxed renderer

---

## How It Works

Notes4Me uses a three-stage pipeline to transform raw audio into actionable meeting notes:

```
┌─────────────────┐
│  1. Recording   │  sox captures system audio via BlackHole virtual device
│   (Real-time)   │  Saves to: ~/Documents/MeetingRecordings/recordings/
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. Transcription│  whisper.cpp converts speech to text locally
│   (~5x speed)   │  Saves to: ~/Documents/MeetingRecordings/processed/
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. Summarisation│  Ollama (llama3.2) generates structured notes
│   (2-3 minutes) │  Saves to: ~/Documents/MeetingRecordings/processed/
└─────────────────┘
```

**Technology Stack:**
- **Electron 33.x**: Cross-platform desktop framework
- **sox**: Reliable audio recording utility
- **whisper.cpp**: Fast, local speech recognition (from OpenAI's Whisper model)
- **Ollama**: Local LLM runtime for AI summarisation
- **BlackHole**: Virtual audio device for system audio capture

---

## System Requirements

### Minimum Requirements
- **Operating System**: macOS 11 (Big Sur) or later
- **Processor**: Apple Silicon (M1/M2/M3) or Intel (x86_64)
- **RAM**: 8GB (16GB recommended for faster processing)
- **Storage**: 5GB free space (for dependencies and models)
- **Node.js**: 18.x or later (if building from source)

### Recommended Setup
- **Processor**: Apple Silicon (M1 or newer) for optimal performance
- **RAM**: 16GB for smooth multitasking during processing
- **Storage**: 20GB+ for storing recordings before cleanup

### Software Dependencies
All dependencies are installed automatically via the `setup.sh` script:
- **Homebrew**: macOS package manager
- **sox**: Audio recording utility
- **Ollama**: Local LLM runtime
- **cmake**: Build tool for whisper.cpp
- **whisper.cpp**: Compiled from source during setup
- **BlackHole 2ch**: Virtual audio device (manual installation required)

---

## Installation

### Quick Start

For experienced users who want to get running immediately:

```bash
# 1. Clone the repository
git clone https://github.com/andyj/Notes4Me.git
cd Notes4Me

# 2. Install Node.js dependencies
npm install

# 3. Run automated setup (installs sox, Ollama, whisper.cpp)
./setup.sh

# 4. Install BlackHole (virtual audio device)
# Download from: https://github.com/ExistentialAudio/BlackHole/releases
# Install BlackHole2ch.pkg

# 5. Configure audio routing (see detailed guide below)
# Open Audio MIDI Setup.app → Create Multi-Output Device

# 6. Start Ollama and pull the model
ollama serve &
ollama pull llama3.2

# 7. Run the app
npm start
```

---

### Detailed Setup Guide

#### Step 1: Install Homebrew (if not already installed)

Homebrew is a package manager for macOS that we'll use to install dependencies.

```bash
# Check if Homebrew is installed
which brew

# If not installed, install it:
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Verify installation:**
```bash
brew --version
# Should output: Homebrew 4.x.x
```

---

#### Step 2: Clone the Repository

```bash
git clone https://github.com/andyj/Notes4Me.git
cd Notes4Me
```

---

#### Step 3: Install Node.js Dependencies

```bash
npm install
```

This installs Electron and other JavaScript dependencies defined in `package.json`.

**Expected output:**
```
added 267 packages in 15s
```

**Troubleshooting:**
- If you see permission errors, don't use `sudo`. Instead, fix npm permissions: [npm docs](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally)
- If `npm` is not found, install Node.js: `brew install node`

---

#### Step 4: Run the Automated Setup Script

The `setup.sh` script installs all system dependencies:

```bash
chmod +x setup.sh
./setup.sh
```

**What this script does:**
1. Checks for Homebrew
2. Installs **sox** (audio recording utility)
3. Installs **Ollama** (local LLM runtime)
4. Installs **cmake** (build tool)
5. Clones and compiles **whisper.cpp** from source
6. Downloads the **whisper base.en model** (~75MB)

**Expected duration:** 5-10 minutes (depending on internet speed and CPU)

**Verify installation:**
```bash
# Check sox
sox --version
# Should output: sox: SoX v14.4.2

# Check Ollama
ollama --version
# Should output: ollama version is 0.x.x

# Check whisper.cpp
ls -la whisper.cpp/build/bin/whisper-cli
# Should show the compiled binary
```

**Troubleshooting:**
- If the script fails, check the error message and ensure Homebrew is working: `brew doctor`
- If whisper.cpp compilation fails, ensure you have Xcode Command Line Tools: `xcode-select --install`

---

#### Step 5: Install BlackHole (Virtual Audio Device)

BlackHole is a virtual audio driver that allows Notes4Me to capture system audio.

**Installation:**
1. Download BlackHole 2ch from: https://github.com/ExistentialAudio/BlackHole/releases
2. Download the **BlackHole2ch.pkg** file (NOT the 16ch version)
3. Open the `.pkg` file and follow the installer prompts
4. Restart your Mac after installation (recommended)

**Verify installation:**
```bash
system_profiler SPAudioDataType | grep BlackHole
# Should output: BlackHole 2ch
```

---

#### Step 6: Configure Audio Routing

This is the most critical step for recording system audio. You need to create a "Multi-Output Device" that sends audio to both your speakers AND BlackHole.

**Step-by-step:**

1. Open **Audio MIDI Setup.app**
   - Press `Cmd + Space` and type "Audio MIDI Setup"
   - Or navigate to `/Applications/Utilities/Audio MIDI Setup.app`

2. Create a Multi-Output Device:
   - Click the **+** button in the bottom-left corner
   - Select **"Create Multi-Output Device"**

3. Configure the Multi-Output Device:
   - In the right panel, check the boxes for:
     - ✅ **Your speakers/headphones** (e.g., "MacBook Pro Speakers" or "External Headphones")
     - ✅ **BlackHole 2ch**
   - **Important**: Your speakers should be FIRST in the list (drag to reorder if needed)

4. Set as System Default:
   - Right-click the Multi-Output Device
   - Select **"Use This Device For Sound Output"**
   - Or go to System Settings → Sound → Output and select the Multi-Output Device

5. Test Audio Routing:
   - Play a YouTube video or music
   - You should hear audio normally through your speakers
   - Notes4Me will now be able to record this audio

**Why is this needed?**
- macOS doesn't allow apps to directly capture system audio for privacy reasons
- BlackHole creates a virtual audio device that acts as a "loopback"
- The Multi-Output Device sends audio to BOTH your speakers (so you hear it) AND BlackHole (so Notes4Me can record it)

**Troubleshooting:**
- **No sound after setup**: Ensure your speakers are checked and FIRST in the Multi-Output Device list
- **BlackHole not visible**: Restart your Mac after installing BlackHole
- **Can't set as default**: Use System Settings → Sound → Output instead of Audio MIDI Setup

---

#### Step 7: Start Ollama and Download the AI Model

Ollama is the local LLM runtime that powers meeting summarisation.

**Start Ollama server:**
```bash
ollama serve
```

This starts the Ollama API server at `http://localhost:11434`. Keep this terminal window open.

**In a NEW terminal window, download the AI model:**
```bash
ollama pull llama3.2
```

This downloads the llama3.2 model (~2GB). This is a one-time download.

**Expected output:**
```
pulling manifest
pulling 8eeb52dfb3bb... 100% ▕████████████▏ 2.0 GB
pulling 73b313b5552d... 100% ▕████████████▏  11 KB
pulling 0ba8f0e314b4... 100% ▕████████████▏  12 KB
pulling 56bb8bd477a5... 100% ▕████████████▏  485 B
success
```

**Verify Ollama is running:**
```bash
curl http://localhost:11434/api/tags
```

Should return a JSON response with available models.

**Troubleshooting:**
- If `ollama serve` fails, try: `brew services start ollama` (runs as background service)
- If port 11434 is in use, stop other services: `lsof -ti:11434 | xargs kill`

---

#### Step 8: Run Notes4Me

You're ready to launch the app!

```bash
npm start
```

You should see:
1. A menu bar icon appear in the top-right of your screen
2. The Electron app window may briefly appear and hide
3. Click the menu bar icon to access recording controls

**First-time launch checklist:**
- Menu bar icon appears: ✅
- Click icon → "Start Recording" option visible: ✅
- Click "Settings..." → System Status shows all dependencies green: ✅

---

### Audio Routing Configuration

#### Understanding the Audio Flow

```
┌─────────────────┐
│  Your Meeting   │  (Zoom, Google Meet, etc.)
│  Application    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ macOS Audio     │  System audio output
│    System       │
└────────┬────────┘
         │
         ├─────────────────────────────┐
         │                             │
         ▼                             ▼
┌─────────────────┐          ┌─────────────────┐
│  Your Speakers  │          │  BlackHole 2ch  │
│  (you hear it)  │          │ (app records it)│
└─────────────────┘          └────────┬────────┘
                                      │
                                      ▼
                              ┌─────────────────┐
                              │   Notes4Me      │
                              │  (via sox)      │
                              └─────────────────┘
```

#### Common Audio Routing Issues

**Problem: No audio in recording (silent WAV file)**

**Solution:**
1. Verify Multi-Output Device is selected as system output:
   ```bash
   # Check current output device
   system_profiler SPAudioDataType | grep "Default Output"
   ```
2. Play test audio (YouTube video) and verify you can hear it
3. Check that both speakers and BlackHole are checked in Multi-Output Device
4. Restart the app and try recording again

**Problem: Can't hear audio after setting up Multi-Output Device**

**Solution:**
1. Open Audio MIDI Setup
2. Select the Multi-Output Device
3. Ensure your speakers are:
   - ✅ Checked (enabled)
   - 📍 First in the list (drag to reorder)
   - 🔊 Not muted (check system volume)

**Problem: Recording has echo or distortion**

**Solution:**
1. Check sample rate consistency:
   - Open Audio MIDI Setup
   - Select BlackHole 2ch → Format → 48000.0 Hz
   - Select Multi-Output Device → Format → 48000.0 Hz
   - Select your speakers → Format → 48000.0 Hz
2. Restart the recording

---

## Usage

### Starting the App

```bash
npm start
```

The app runs in the menu bar (top-right corner of your screen). Click the icon to see:
- **Start Recording** - Begin capturing audio
- **Settings...** - Open settings window
- **Quit** - Exit the app

### Recording Your First Meeting

1. **Before the meeting:**
   - Ensure Ollama is running: `ollama serve`
   - Verify Multi-Output Device is your system output
   - Start Notes4Me: `npm start`

2. **During the meeting:**
   - Click menu bar icon → **"Start Recording"**
   - Join your meeting (Zoom, Google Meet, etc.)
   - The menu bar icon will update to show recording status
   - Speak and interact normally

3. **After the meeting:**
   - Click menu bar icon → **"Stop Recording"**
   - The app will automatically:
     - Stop the audio capture
     - Transcribe the recording (~5x real-time)
     - Generate meeting notes (2-3 minutes)
   - Menu bar icon will show progress

4. **View your results:**
   - Open `~/Documents/MeetingRecordings/processed/`
   - Find files with today's date (e.g., `2025-11-19_14-30-00_transcript.txt`)

### Understanding the Output

Notes4Me generates three types of files:

#### 1. Recording (WAV Audio)
- **Location**: `~/Documents/MeetingRecordings/recordings/`
- **Format**: `YYYY-MM-DD_HH-MM-SS_recording.wav`
- **Size**: ~10MB per minute (48kHz, 16-bit stereo)
- **Retention**: Auto-deleted after 7 days (configurable)

**Example:**
```
2025-11-19_14-30-00_recording.wav  (300 MB for 30-min meeting)
```

#### 2. Transcript (Plain Text)
- **Location**: `~/Documents/MeetingRecordings/processed/`
- **Format**: `YYYY-MM-DD_HH-MM-SS_transcript.txt`
- **Content**: Raw speech-to-text output from whisper.cpp
- **Retention**: Kept indefinitely

**Example:**
```txt
Welcome everyone to today's standup meeting. Let's go around and share what
we've been working on. Sarah, would you like to start?

Sure. Yesterday I finished the authentication refactor and pushed it to the
dev branch. Today I'm going to work on the user settings page...
```

#### 3. Meeting Notes (Markdown)
- **Location**: `~/Documents/MeetingRecordings/processed/`
- **Format**: `YYYY-MM-DD_HH-MM-SS_notes.md`
- **Content**: AI-generated structured summary
- **Retention**: Kept indefinitely

**Example structure:**
```markdown
# Meeting Notes

## Action Items
- [ ] Sarah: Complete user settings page by Friday
- [ ] John: Review authentication PR #234
- [ ] Team: Test new login flow in staging

## Meeting Purpose
Daily standup to sync on sprint progress and blockers

## Key Takeaways
- Authentication refactor is complete and ready for review
- User settings page on track for Friday delivery
- Staging environment needs to be updated before testing

## Topics Discussed

### Problems
- Staging environment is outdated (2 weeks behind main)

### Blockers
- Waiting for design team to finalize settings page mockups

### Solutions
- DevOps to update staging tonight
- Using existing design patterns for settings page

## Next Steps
- Deploy staging environment update
- Review and merge authentication PR
- Begin testing new login flow
```

### Settings & Configuration

Open settings by clicking the menu bar icon → **"Settings..."**

#### System Status Tab
- View real-time dependency status (sox, whisper, Ollama, BlackHole)
- Click **"Refresh Status"** to re-check dependencies
- Green checkmarks = ready, Red X = needs attention

#### Settings Tab
- **Output Directory**: Change where recordings are saved (default: `~/Documents/MeetingRecordings`)
- **Retention Period**: How many days to keep recordings (1-30 days, default: 7)
- **Auto-Process**: Automatically transcribe and summarise after recording stops

#### Recordings Tab
- View all recordings with metadata (date, size, processing status)
- Actions per recording:
  - 📂 **Open**: View in Finder
  - ⚙️ **Process**: Manually transcribe/summarise
  - 🗑️ **Delete**: Remove recording and associated files

#### Storage Tab
- View total storage usage
- See counts: recordings, transcripts, notes
- **Cleanup Old Recordings**: Manually trigger retention policy
- **Open Output Folder**: Quick access to recordings directory

---

## Performance

### Benchmarks (M1 MacBook Air, 8GB RAM)

| Recording Length | Transcription Time | Summarisation Time | Total Processing Time |
|-----------------|-------------------|-------------------|----------------------|
| 15 minutes      | ~3 minutes        | ~1.5 minutes      | ~4.5 minutes         |
| 30 minutes      | ~6 minutes        | ~2 minutes        | ~8 minutes           |
| 60 minutes      | ~12 minutes       | ~3 minutes        | ~15 minutes          |

### Performance Notes
- **Transcription**: whisper.cpp base.en model processes at ~5x real-time on Apple Silicon
- **Summarisation**: llama3.2 generates ~50 tokens/second
- **Processing**: Runs in background, doesn't block other work
- **Memory**: ~2GB RAM during transcription, ~4GB during summarisation

### Optimization Tips
- **Use base.en model**: Faster than multilingual models, sufficient for English
- **Close other apps**: Gives more CPU/RAM to processing
- **Disable auto-process**: Process recordings manually during idle time
- **SSD recommended**: Faster file I/O for large WAV files

---

## Troubleshooting

### Installation Issues

#### "Homebrew not found"
```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Add to PATH (Apple Silicon)
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

#### "npm: command not found"
```bash
# Install Node.js via Homebrew
brew install node

# Verify installation
node --version
npm --version
```

#### "whisper.cpp compilation failed"
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install cmake
brew install cmake

# Retry setup
./setup.sh
```

---

### Audio Recording Issues

#### "BlackHole not found in audio devices"
```bash
# Verify BlackHole is installed
system_profiler SPAudioDataType | grep -i blackhole

# If not found, reinstall BlackHole:
# 1. Download from https://github.com/ExistentialAudio/BlackHole/releases
# 2. Install BlackHole2ch.pkg
# 3. Restart your Mac
```

#### "Recording is silent (0 bytes or no speech detected)"
**Common causes:**
1. Multi-Output Device not set as system output
2. BlackHole not included in Multi-Output Device
3. No audio playing during recording

**Solution:**
```bash
# 1. Check current output device
system_profiler SPAudioDataType | grep "Default Output"

# 2. Re-configure Multi-Output Device:
#    - Open Audio MIDI Setup
#    - Verify both speakers and BlackHole 2ch are checked
#    - Set as system default output

# 3. Test with audio playback:
#    - Play a YouTube video
#    - Start recording
#    - Stop after 10 seconds
#    - Check file size: ls -lh ~/Documents/MeetingRecordings/recordings/
#    - Should be ~1MB for 10 seconds
```

#### "Can't hear audio after setup"
```bash
# Verify speakers are enabled in Multi-Output Device
# 1. Open Audio MIDI Setup
# 2. Select Multi-Output Device
# 3. Ensure your speakers are:
#    - Checked (✓)
#    - First in the list (drag to reorder)
# 4. Check system volume (not muted)
```

---

### Transcription Issues

#### "whisper.cpp binary not found"
```bash
# Verify binary exists
ls -la whisper.cpp/build/bin/whisper-cli

# If not found, recompile
cd whisper.cpp
rm -rf build
cmake -B build
cmake --build build
cd ..
```

#### "Whisper model not found"
```bash
# Download base.en model manually
cd whisper.cpp
bash ./models/download-ggml-model.sh base.en
ls -lh models/ggml-base.en.bin  # Should be ~75MB
cd ..
```

#### "Transcription takes too long"
**Normal:** 30-min recording → 6 min transcription
**If slower:**
- Close other apps to free up CPU
- Check Activity Monitor for high CPU usage
- Consider using a smaller model (tiny.en) for faster processing:
  ```bash
  cd whisper.cpp
  bash ./models/download-ggml-model.sh tiny.en
  ```
  Then update `services/transcriber.js` to use `ggml-tiny.en.bin`

---

### Summarisation Issues

#### "Ollama not available"
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If connection refused, start Ollama
ollama serve

# Or run as background service
brew services start ollama
```

#### "llama3.2 model not found"
```bash
# List installed models
ollama list

# If llama3.2 not listed, download it
ollama pull llama3.2

# Verify download
ollama list | grep llama3.2
```

#### "Summarisation fails or produces gibberish"
**Possible causes:**
1. Empty or very short transcript
2. Ollama out of memory
3. Model corruption

**Solution:**
```bash
# 1. Check transcript has content
cat ~/Documents/MeetingRecordings/processed/*_transcript.txt | wc -w
# Should have 100+ words for meaningful summary

# 2. Restart Ollama
pkill ollama
ollama serve

# 3. Re-download model if corrupted
ollama rm llama3.2
ollama pull llama3.2
```

---

### General Issues

#### "App crashes on startup"
```bash
# Check logs
npm start 2>&1 | tee app.log

# Look for specific error messages in app.log
```

#### "High CPU usage"
**During recording:** Normal (sox process)
**During transcription:** Normal (whisper process using 100% CPU)
**Idle:** Should be <5% CPU

If high CPU when idle:
```bash
# Check for stuck processes
ps aux | grep -E "(sox|whisper|ollama)"

# Kill stuck processes
pkill sox
pkill whisper-cli
```

#### "Storage filling up"
```bash
# Check storage usage
du -sh ~/Documents/MeetingRecordings/recordings/
du -sh ~/Documents/MeetingRecordings/processed/

# Manual cleanup (removes recordings older than 7 days)
find ~/Documents/MeetingRecordings/recordings/ -name "*.wav" -mtime +7 -delete

# Or use Settings UI:
# Click "Cleanup Old Recordings" button
```

---

## Privacy & Security

### Data Collection
**Notes4Me collects ZERO data.** Everything happens locally on your Mac.

- ❌ No analytics or telemetry
- ❌ No cloud uploads
- ❌ No external API calls (except to localhost:11434 for Ollama)
- ❌ No user accounts or authentication
- ❌ No network requests to third-party servers

### Data Storage
All data is stored in: `~/Documents/MeetingRecordings/`

**Permissions:**
- Files are owned by your user account
- Standard macOS file permissions (read/write for owner only)
- No root or elevated privileges required

**Retention Policy:**
- **Recordings (WAV)**: Auto-deleted after 7 days (configurable: 1-30 days)
- **Transcripts (TXT)**: Kept indefinitely (manual deletion required)
- **Notes (MD)**: Kept indefinitely (manual deletion required)

### Network Security
Notes4Me only makes network requests to:
- **http://localhost:11434** - Ollama API (local server, not internet)

You can verify this by running the app with network disconnected - it will work normally (assuming Ollama is already running).

### Code Security
- **Sandboxed renderer**: Electron security best practices
- **No nodeIntegration**: Renderer process can't access Node.js APIs
- **contextBridge**: Secure IPC communication only
- **No eval()**: No dynamic code execution
- **Open source**: All code is auditable in this repository

### Threat Model
**Protects against:**
- ✅ Third-party data breaches (no cloud storage)
- ✅ Network interception (no external requests)
- ✅ Vendor lock-in (open source, local data)
- ✅ Subscription price increases (free forever)

**Does NOT protect against:**
- ❌ Physical access to your Mac (files are not encrypted at rest)
- ❌ Malware on your system (standard macOS security applies)
- ❌ Backup leaks (if you back up ~/Documents to cloud services)

**Recommendations for maximum privacy:**
- Use FileVault (full-disk encryption)
- Exclude `~/Documents/MeetingRecordings/` from cloud backups (iCloud, Dropbox, etc.)
- Manually delete sensitive recordings after reviewing notes

---

## FAQ

### General

**Q: Does this work on Windows or Linux?**
A: Currently macOS only. Windows/Linux support is on the roadmap but requires significant changes (different audio capture methods, virtual audio drivers, etc.).

**Q: Does it work on Intel Macs?**
A: Yes, but performance is slower (~3x real-time transcription vs 5x on Apple Silicon).

**Q: Can I use this commercially?**
A: Yes! MIT license allows commercial use. However, check the licenses of dependencies (whisper.cpp, Ollama) if redistributing.

**Q: How much does it cost?**
A: Free forever. No subscriptions, no API fees, no hidden costs. You only need a Mac and disk space.

---

### Recording

**Q: Can I record Zoom/Google Meet/Microsoft Teams?**
A: Yes, as long as you've set up the Multi-Output Device correctly. The app records all system audio.

**Q: Can I record my microphone input (what I'm saying)?**
A: Not currently. Notes4Me records system OUTPUT (what you hear), not microphone INPUT. This is a limitation we plan to address.

**Q: What's the maximum recording length?**
A: No hard limit, but consider:
- Disk space: ~10MB per minute (~600MB for 1 hour)
- Processing time: ~15 minutes for 1-hour recording
- Memory: Large files may cause issues on 8GB RAM systems

**Q: Can I pause and resume a recording?**
A: Not currently. Start a new recording for each distinct session.

---

### Transcription

**Q: How accurate is the transcription?**
A: Very accurate for clear English speech. Whisper base.en model has ~5% word error rate on clean audio. Accuracy degrades with:
- Heavy accents
- Background noise
- Multiple speakers talking over each other
- Poor audio quality (low-bitrate conferencing apps)

**Q: Can I transcribe other languages?**
A: Not with the default base.en model. You can download multilingual models:
```bash
cd whisper.cpp
bash ./models/download-ggml-model.sh base  # Multilingual
```
Then update `services/transcriber.js` to use `ggml-base.bin`

**Q: Can I transcribe existing audio files?**
A: Not directly in the UI, but you can manually:
```bash
cd whisper.cpp
./build/bin/whisper-cli -m models/ggml-base.en.bin -f /path/to/your/audio.wav -otxt
```

---

### Summarisation

**Q: Can I customize the summary format?**
A: Yes! Edit the prompt in `services/summariser.js` (line ~60) to change the structure, add custom sections, or adjust tone.

**Q: Can I use a different AI model?**
A: Yes! Notes4Me works with any Ollama-compatible model:
```bash
ollama pull mistral        # Faster, less detailed
ollama pull llama3.1:70b   # Slower, more detailed (requires 64GB+ RAM)
```
Then update `services/summariser.js` to use your preferred model.

**Q: Do summaries include speaker identification?**
A: Not currently. Whisper doesn't do speaker diarisation. This is a planned feature.

---

### Privacy

**Q: Can someone intercept my recordings over the network?**
A: No. All processing happens locally. The only network request is to `localhost:11434` (Ollama), which never leaves your machine.

**Q: Are recordings encrypted?**
A: No, files are stored as plain WAV/TXT/MD. For encryption at rest, use FileVault (macOS full-disk encryption).

**Q: Can I delete recordings automatically after processing?**
A: Yes! Enable "Auto-Process" in settings, then set retention period to 1 day. Recordings will be deleted 24 hours after creation.

---

### Performance

**Q: Why is transcription slower than advertised?**
A: Performance varies by:
- CPU model (M1 vs M2 vs Intel)
- Available RAM (8GB vs 16GB+)
- System load (other apps using CPU)
- Audio quality (noisy audio takes longer)

**Q: Can I speed up processing?**
A: Yes:
1. Use a smaller whisper model (tiny.en instead of base.en)
2. Close other apps to free up CPU
3. Disable auto-process and run manually during idle time

**Q: Does it use GPU acceleration?**
A: whisper.cpp uses Apple's Metal framework on Apple Silicon for some operations, but primarily uses CPU.

---

## Development

### Project Structure

```
Notes4Me/
├── main.js                 # Electron main process
│                           #  - Creates tray icon
│                           #  - Orchestrates recording pipeline
│                           #  - Manages IPC communication
│
├── preload.js              # Secure IPC bridge
│                           #  - Exposes safe API to renderer
│                           #  - Uses contextBridge
│
├── package.json            # Node.js dependencies & scripts
├── .gitignore              # Git exclusions
├── LICENSE                 # MIT License
├── README.md               # This file
├── setup.sh                # Automated dependency installer
│
├── services/               # Core business logic
│   ├── recorder.js         #  - Audio capture via sox
│   ├── transcriber.js      #  - whisper.cpp integration
│   ├── summariser.js       #  - Ollama API client
│   └── fileManager.js      #  - File operations & cleanup
│
├── utils/                  # Utilities
│   └── audioDevices.js     #  - BlackHole detection
│
├── renderer/               # Settings window UI
│   ├── index.html          #  - Settings window structure
│   ├── styles.css          #  - Dark mode styling
│   └── app.js              #  - Frontend logic & IPC calls
│
├── assets/                 # Application assets
│   ├── icon.png            #  - Menu bar icon (TODO)
│   └── README.md           #  - Asset documentation
│
├── models/                 # Whisper models
│   └── README.md           #  - Model documentation
│
└── whisper.cpp/            # Speech recognition (git submodule)
    └── ...                 #  - Compiled during setup
```

### Development Commands

```bash
# Install dependencies
npm install

# Run in development mode (with DevTools)
npm start

# Build for distribution
npm run build

# Rebuild native modules for Electron
npm run postinstall

# Clean build artifacts
rm -rf dist/ build/ out/
```

### Architecture Overview

#### Main Process (main.js)
- **Tray Icon**: Creates menu bar icon and context menu
- **IPC Handlers**: Responds to renderer requests (startRecording, stopRecording, etc.)
- **Pipeline Orchestration**: Chains recorder → transcriber → summariser
- **Window Management**: Creates and manages settings window

#### Services Layer
- **Recorder**: Spawns sox subprocess, monitors file size, handles cleanup
- **Transcriber**: Spawns whisper.cpp, parses progress, returns transcript path
- **Summariser**: Streams from Ollama API, formats markdown output
- **FileManager**: CRUD operations, retention policy, storage stats

#### Renderer Process (renderer/)
- **Settings UI**: Modern dark-mode interface
- **IPC Client**: Calls main process via window.meetingRecorder API
- **State Management**: Local component state (no framework)

### Building from Source

```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/andyj/Notes4Me.git
cd Notes4Me

# Install and setup
npm install
./setup.sh

# Run
npm start
```

### Creating a Distribution Build

```bash
npm run build
```

This uses electron-builder to create a macOS .app bundle in `dist/`.

**Customization:**
- Edit `package.json` → `build` section for app metadata
- Add app icon: `assets/icon.png` (1024x1024px)
- Code signing: Set `APPLE_ID` and `APPLE_ID_PASSWORD` environment variables

### Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Areas for contribution:**
- Windows/Linux support
- Speaker diarisation (who said what)
- Real-time transcription
- Custom AI prompts
- Export formats (PDF, DOCX)
- Improved error handling
- Unit tests

**Development setup:**
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and test thoroughly
4. Commit with clear messages: `git commit -m "Add speaker diarisation"`
5. Push and create a Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

**Summary:**
- ✅ Commercial use
- ✅ Modification
- ✅ Distribution
- ✅ Private use
- ❌ Liability
- ❌ Warranty

---

## Acknowledgments

This project stands on the shoulders of giants:

- **[whisper.cpp](https://github.com/ggerganov/whisper.cpp)** - Georgi Gerganov's incredible C++ implementation of OpenAI's Whisper
- **[Ollama](https://ollama.ai/)** - Making local LLMs accessible to everyone
- **[BlackHole](https://github.com/ExistentialAudio/BlackHole)** - Virtual audio driver that makes macOS audio routing possible
- **[sox](http://sox.sourceforge.net/)** - The Swiss Army knife of audio manipulation
- **[Electron](https://www.electronjs.org/)** - Cross-platform desktop framework

---

## Support

**Issues & Bug Reports:**
- GitHub Issues: https://github.com/andyj/Notes4Me/issues

**Discussions & Questions:**
- GitHub Discussions: https://github.com/andyj/Notes4Me/discussions

**Security Vulnerabilities:**
- Email: security@andyjarrett.com (or open a private security advisory)

---

## Changelog

### v1.0.0 (Initial Release)
- Core recording, transcription, and summarisation pipeline
- macOS menu bar integration
- Settings UI with dark mode
- Automatic file cleanup
- Privacy-first local processing

---

**Built with ❤️ for privacy-conscious professionals**
