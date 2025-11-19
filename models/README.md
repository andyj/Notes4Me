# Models

Whisper.cpp model files storage.

## Setup

Download the base.en model after running setup.sh:

```bash
cd whisper.cpp
bash ./models/download-ggml-model.sh base.en
cp models/ggml-base.en.bin ../models/
```

Note: Model files are excluded from git due to large size (see .gitignore).
