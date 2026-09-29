"""Serve the platform and arbitrate buzzer presses on the local network."""
import json
import os
import queue
import re
import socket
import threading
import time
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("GAME_PLATFORM_PORT", "8000"))
rooms = {}
rooms_lock = threading.Lock()
listeners = {}


def fresh_state():
    return {"winner": None, "locked": False, "timer": None, "round": 0, "pressedAt": None}


def room_state(code):
    return rooms.setdefault(code, fresh_state())


def broadcast(code):
    payload = json.dumps(room_state(code), ensure_ascii=False)
    for channel in list(listeners.get(code, [])):
        channel.put(payload)


def local_ip():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("192.0.2.1", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, *_args):
        pass

    def send_json(self, value, status=200):
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def buzzer_path(self):
        match = re.fullmatch(r"/api/buzzer/(\d{4})(?:/(events|press|lock|reset|timer|start))?", urlparse(self.path).path)
        return match.groups() if match else (None, None)

    def do_GET(self):
        code, action = self.buzzer_path()
        if code:
            if action != "events":
                with rooms_lock:
                    self.send_json(room_state(code))
                return
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache, no-transform")
            self.send_header("Connection", "keep-alive")
            self.send_header("X-Accel-Buffering", "no")
            self.end_headers()
            channel = queue.Queue()
            with rooms_lock:
                listeners.setdefault(code, []).append(channel)
                channel.put(json.dumps(room_state(code), ensure_ascii=False))
            try:
                while True:
                    try:
                        payload = channel.get(timeout=15)
                        self.wfile.write(f"data: {payload}\n\n".encode("utf-8"))
                    except queue.Empty:
                        self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, OSError):
                pass
            finally:
                with rooms_lock:
                    if channel in listeners.get(code, []):
                        listeners[code].remove(channel)
            return
        if urlparse(self.path).path in ("/", "/index.html"):
            index = (ROOT / "index.html").read_text(encoding="utf-8")
            index = index.replace("</head>", '<script>window.LOCAL_BUZZER_ENABLED=true;</script></head>', 1)
            body = index.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def do_POST(self):
        code, action = self.buzzer_path()
        if not code or action not in {"press", "lock", "reset", "timer", "start"}:
            self.send_json({"error": "not found"}, 404)
            return
        try:
            length = min(int(self.headers.get("Content-Length", "0")), 4096)
            data = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self.send_json({"error": "invalid request"}, 400)
            return
        changed = False
        with rooms_lock:
            state = room_state(code)
            if action == "press":
                player_id = str(data.get("playerId", ""))
                if player_id and not state["locked"] and not state["winner"]:
                    state["winner"] = player_id
                    state["pressedAt"] = int(time.time() * 1000)
                    changed = True
            elif action == "lock":
                state["locked"] = bool(data.get("locked"))
                changed = True
            elif action == "reset":
                state.update({"winner": None, "pressedAt": None, "round": state["round"] + 1})
                changed = True
            elif action == "timer":
                duration = data.get("duration")
                state["timer"] = {"duration": duration, "startedAt": int(time.time() * 1000)} if duration in (10, 30) else None
                changed = True
            elif action == "start":
                state = fresh_state()
                rooms[code] = state
                changed = True
            result = dict(state)
            if changed:
                broadcast(code)
        self.send_json(result)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    server.daemon_threads = True
    address = local_ip()
    print("منصة الألعاب تعمل على الشبكة المحلية:")
    print(f"  http://{address}:{PORT}")
    print("افتح هذا العنوان على جهاز المنظّم، وشاركه مع اللاعبين عبر رمز الغرفة أو QR.")
    print("للإيقاف اضغط Ctrl+C")
    webbrowser.open(f"http://{address}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
