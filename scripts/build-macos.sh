#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
swift build --package-path macos -c release
app="$PWD/dist/Harness Bridge.app"
mkdir -p "$app/Contents/MacOS"
cp macos/.build/release/HarnessBridge "$app/Contents/MacOS/HarnessBridge"
cat > "$app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>dev.harnessbridge.status</string>
<key>CFBundleName</key><string>Harness Bridge</string>
<key>CFBundleExecutable</key><string>HarnessBridge</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.1.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSMinimumSystemVersion</key><string>14.0</string>
<key>LSUIElement</key><true/>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
codesign --force --sign - "$app"
printf '%s\n' "$app"
