# Recorder Live Monitor UI

## Summary

Add a real-time web UI to `listen.mjs` that shows recorded operations as they happen during a recording session. Uses SSE (Server-Sent Events) for zero-dependency, instant push updates.

## Architecture

```
listen.mjs
  ├─ CDP connection to OneKey (unchanged)
  ├─ Inject click/input listeners (unchanged)
  ├─ NEW: Embedded HTTP server (port 3210)
  │    ├─ GET /         → Inline HTML page (operation table)
  │    └─ GET /events   → SSE endpoint, pushes each new step
  ├─ On each STEP: console message
  │    ├─ Save steps.json (unchanged)
  │    ├─ Terminal output (unchanged)
  │    └─ NEW: Broadcast via SSE to browser
  └─ NEW: Auto-open browser on start, close server on exit
```

## HTML Page

- **Header**: Recording status (green pulsing dot), step count, elapsed time
- **Table columns**: #, Type (CLICK/INPUT with color badge), Element (tag + testid), Content (text or value), Position (x, y), Time (relative)
- **Behavior**: Auto-scroll to bottom on new step, highlight flash on new row
- **Footer**: "Press Ctrl+C in terminal to stop recording"

## Changes to listen.mjs

1. Import `createServer` from `node:http`, `exec` from `node:child_process`
2. Add `MONITOR_HTML` template string with full HTML/CSS/JS
3. Add `startMonitorServer()` — creates HTTP server on port 3210 with `/` and `/events` routes
4. Maintain `sseClients[]` — push new steps to all connected SSE clients
5. On recording start: auto-open `http://localhost:3210` in default browser
6. On SIGINT/timeout: close HTTP server, then exit

## Unchanged

- Event injection logic (click/input listeners)
- steps.json incremental save
- Terminal log output
- Screenshot capture after each step
- Recording directory structure

## Constraints

- Zero new dependencies (Node.js built-in `http` module only)
- Single file change (listen.mjs)
- Port 3210 (avoids conflict with dashboard on 5050)
