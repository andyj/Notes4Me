# Notes4Me

A privacy-focused macOS menu bar application for recording, transcribing, and summarizing meetings using local AI processing. All data stays on your machine—no cloud uploads, no subscriptions, no privacy compromises.

## Features

- **100% Local Processing**: All recording, transcription, and AI summarization happens on your Mac
- **Menu Bar Integration**: Lightweight tray app that stays out of your way
- **Automatic Transcription**: Converts audio to text using whisper.cpp (5x faster than real-time on Apple Silicon)
- **AI-Powered Summaries**: Generates structured meeting notes with action items, key takeaways, and next steps
- **Smart File Management**: Automatic cleanup of old recordings with configurable retention
- **Privacy First**: No data ever leaves your machine

## Technology Stack

- **Frontend**: Electron 33.x + HTML/CSS/vanilla JavaScript
- **Audio Capture**: sox (Sound eXchange)
- **Transcription**: whisper.cpp (local speech-to-text)
- **AI Summarization**: Ollama (local LLM - llama3.2)
- **Storage**: Node.js fs/path modules + electron-store

## Prerequisites

- **macOS** (tested on Apple Silicon, but should work on Intel Macs)
- **Homebrew** package manager
- **BlackHole 2ch** virtual audio device ([Download](https://github.com/ExistentialAudio/BlackHole))
- **Node.js** 18+ (Electron includes Node.js 20.18.0)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/Notes4Me.git
cd Notes4Me
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Setup Script

The automated setup script installs all required system dependencies:

```bash
./setup.sh
```

This installs:
- **sox** - Audio recording utility
- **Ollama** - Local LLM runtime
- **whisper.cpp** - Speech recognition (compiled from source)
- **whisper base.en model** - English-optimized model (~75MB)

### 4. Configure Audio Routing

To record system audio (e.g., Zoom, Google Meet):

1. Install [BlackHole 2ch](https://github.com/ExistentialAudio/BlackHole)
2. Open **Audio MIDI Setup.app** (in `/Applications/Utilities/`)
3. Click the **+** button → **Create Multi-Output Device**
4. Check both:
   - Your speakers/headphones
   - **BlackHole 2ch**
5. Set this Multi-Output Device as your **system default output**

This routes audio to both your speakers (so you can hear) and BlackHole (so the app can record).

### 5. Start Ollama

```bash
ollama serve
```

In a separate terminal, pull the llama3.2 model:

```bash
ollama pull llama3.2
```

## Usage

### Development Mode

```bash
npm start
```

### Recording a Meeting

1. Click the menu bar icon
2. Select **"Start Recording"**
3. The icon will indicate recording is in progress
4. Join your meeting (Zoom, Google Meet, etc.)
5. When done, click **"Stop Recording"**

The app will automatically:
1. Transcribe the audio (~5x real-time speed)
2. Generate structured meeting notes (2-3 minutes)
3. Save everything to `~/Documents/MeetingRecordings/`

### Viewing Results

- **Recordings**: `~/Documents/MeetingRecordings/recordings/*.wav`
- **Transcripts**: `~/Documents/MeetingRecordings/processed/*_transcript.txt`
- **Meeting Notes**: `~/Documents/MeetingRecordings/processed/*_notes.md`

### Settings Window

Click the menu bar icon → **"Settings..."** to:
- View system dependency status
- Configure output directory
- Set recording retention period (1-30 days)
- Enable/disable auto-processing
- Manage recordings (view, process, delete)
- Check storage usage

## Building for Distribution

```bash
npm run build
```

The packaged app will be in the `dist/` directory.

## Performance

Based on M1 MacBook Air:

| Recording Length | Transcription Time | Summarization Time | Total Processing |
|-----------------|-------------------|-------------------|------------------|
| 30 minutes      | ~6 min            | ~2 min            | ~8 min           |
| 60 minutes      | ~12 min           | ~3 min            | ~15 min          |

Whisper processes at approximately **5x real-time** with the base.en model.

## Privacy & Security

- **No cloud uploads**: All processing happens 100% locally
- **Data retention**: Audio files are auto-deleted after 7 days (configurable)
- **Transcripts preserved**: Transcripts and notes are kept indefinitely
- **Sandboxed renderer**: Electron security best practices with context isolation
- **No telemetry**: This app sends zero data to external servers

## File Storage

All data is stored in `~/Documents/MeetingRecordings/`:

```
MeetingRecordings/
├── recordings/          # WAV files (auto-deleted after retention period)
└── processed/           # Transcripts and meeting notes (kept forever)
```

## Troubleshooting

### "BlackHole not found" error
- Ensure BlackHole 2ch is installed
- Create a Multi-Output Device in Audio MIDI Setup
- Set it as your system default output

### "Ollama not available" error
- Start Ollama: `ollama serve`
- Or install: `brew install ollama`
- Verify: `curl http://localhost:11434/api/tags`

### "whisper.cpp binary not found"
- Run `./setup.sh` to compile whisper.cpp
- Or manually: `brew install cmake && cd whisper.cpp && cmake -B build && cmake --build build`

### Recording is silent
- Ensure Multi-Output Device is set as system default
- Verify BlackHole 2ch is checked in the Multi-Output Device
- Play audio to test routing

## Development

### Project Structure

```
Notes4Me/
├── main.js              # Electron main process (tray, IPC, orchestration)
├── preload.js           # Secure IPC bridge
├── services/            # Core business logic
│   ├── recorder.js      # Audio capture via sox
│   ├── transcriber.js   # whisper.cpp integration
│   ├── summarizer.js    # Ollama API calls
│   └── fileManager.js   # File operations & cleanup
├── utils/               # Utilities
│   └── audioDevices.js  # BlackHole device detection
├── renderer/            # Settings UI
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── assets/              # Icons for menu bar
└── models/              # whisper.cpp models (*.bin)
```

### Key Commands

```bash
npm start              # Start in development mode
npm run build          # Build for distribution
npm run postinstall    # Rebuild native modules for Electron
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Roadmap

- [ ] Real-time transcription display
- [ ] Custom AI prompts for different meeting types
- [ ] Export to PDF/DOCX formats
- [ ] Meeting participant detection
- [ ] Automatic Multi-Output Device creation
- [ ] Windows/Linux support

## Acknowledgments

- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) - Fast, local speech recognition
- [Ollama](https://ollama.ai/) - Easy local LLM deployment
- [BlackHole](https://github.com/ExistentialAudio/BlackHole) - Virtual audio driver for macOS
- [sox](http://sox.sourceforge.net/) - Swiss Army knife of audio manipulation
