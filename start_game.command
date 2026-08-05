#!/bin/sh
cd "$(dirname "$0")"
python3 -m http.server 8000 &
SERVER_PID=$!
(sleep 1; open http://localhost:8000) >/dev/null 2>&1 &
wait $SERVER_PID
