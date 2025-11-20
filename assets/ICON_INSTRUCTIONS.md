# App Icon Instructions

The app icon (shown in Finder, Dock, and App Switcher) should be **🤖✏️** on a **white circular background**.

## Required Files

Create `icon.png` in this directory with the following specifications:

### Design Specifications
- **Size**: 1024x1024 pixels (will be automatically resized by electron-builder)
- **Background**: White circle
- **Content**: Robot emoji (🤖) and pencil emoji (✏️)
- **Format**: PNG with transparency outside the circle

### Quick Creation Options

#### Option 1: Using Online Tools
1. Go to https://www.canva.com or https://www.figma.com
2. Create a 1024x1024 canvas
3. Add a white circle (fill the canvas)
4. Add text with these emojis: 🤖✏️
5. Center and size appropriately
6. Export as PNG
7. Save as `assets/icon.png`

#### Option 2: Using macOS Preview
1. Open Preview
2. File → New from Clipboard (or create new)
3. Tools → Adjust Size → 1024x1024 pixels
4. Use markup tools to:
   - Draw white filled circle
   - Add text with 🤖✏️ emojis
5. Save as `assets/icon.png`

#### Option 3: Using Command Line (ImageMagick)
```bash
# Install ImageMagick if not already installed
brew install imagemagick

# Create icon (you'll need to add emojis manually after)
convert -size 1024x1024 xc:white \
  -fill white -draw "circle 512,512 512,0" \
  -alpha set -channel A -evaluate multiply 0 +channel \
  -fill white -draw "circle 512,512 512,50" \
  assets/icon.png
```

Then open in an image editor to add the 🤖✏️ text.

### Icon Sizes Generated

electron-builder will automatically generate all required macOS icon sizes:
- 1024x1024 (App Store)
- 512x512 (Retina Display)
- 256x256
- 128x128
- 64x64
- 32x32
- 16x16

All from the single `icon.png` file.

## Current Status

**⚠️ PLACEHOLDER**: The current `icon-placeholder.txt` should be replaced with a proper `icon.png` file following the specifications above.

## Verification

After creating the icon, verify it:

```bash
# Check file exists and size
ls -lh assets/icon.png
file assets/icon.png

# Should show: PNG image data, 1024 x 1024, ...
```

Then rebuild the app to see the new icon:

```bash
npm run build
```

The icon will appear in:
- `dist/mac/Notes4Me.app` (application bundle)
- Finder when viewing the app
- Dock when the app is running
- App Switcher (Cmd+Tab)
