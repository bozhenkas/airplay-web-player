#!/bin/bash
# Simple startup script for AirPlay Web Player
set -e
PORT=${PORT:-3000}

# install root deps
if [ ! -d node_modules ]; then
  echo "Installing server dependencies..."
  npm install
fi

# install client deps
if [ ! -d client/node_modules ]; then
  echo "Installing client dependencies..."
  (cd client && npm install)
fi

# build client if not built
if [ ! -d client/build ]; then
  echo "Building client..."
  (cd client && npm run build)
fi

# check ffprobe
if ! command -v ffprobe >/dev/null 2>&1; then
  echo "ffprobe not found. Please install FFmpeg package." >&2
fi

# start server
node server/index.js &
SERVER_PID=$!

# try to open browser
sleep 2
URL="http://localhost:$PORT"
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
  open "$URL" >/dev/null 2>&1 &
fi

wait $SERVER_PID
