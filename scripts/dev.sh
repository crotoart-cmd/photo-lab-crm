#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$ROOT/.tools/node/bin"
export PATH="$ROOT/.tools/node/bin:$PATH"

if [ ! -x "$NODE/node" ]; then
  echo "Chưa có Node. Chạy: curl ... (xem INSTALLATION.md) hoặc cài Node.js từ nodejs.org"
  exit 1
fi

echo "📦 Cài dependencies (lần đầu có thể mất vài phút)..."
(cd "$ROOT/backend" && npm install --no-fund --no-audit)
(cd "$ROOT/frontend" && npm install --no-fund --no-audit)

echo ""
echo "🚀 Khởi động backend (port 5001 — tránh xung đột AirPlay trên macOS)..."
(cd "$ROOT/backend" && npm start) &
BACKEND_PID=$!

sleep 3

echo "🚀 Khởi động frontend (port 3000)..."
(cd "$ROOT/frontend" && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "✅ Đang chạy:"
echo "   Web:  http://localhost:3000"
echo "   API:  http://localhost:5001/api/health"
echo "   Đăng nhập: admin@labstart.local / admin123"
echo ""
echo "Nhấn Ctrl+C để dừng cả hai."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
