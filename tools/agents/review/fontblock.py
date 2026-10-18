#!/usr/bin/env python3
"""The page links a render-blocking Google Fonts stylesheet before the inline game script. When that request hangs
(slow / captive network) the script — and therefore the whole game — does not run until it finishes or fails.
Simulated by redirecting the font CSS to a local server that answers after N seconds.
DS_OUT=build/review python3 tools/agents/review/fontblock.py"""
import os, time, threading, http.server, socketserver
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build/review'), 'index.html'))
class Slow(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        time.sleep(float(self.path.strip('/') or 0))
        self.send_response(200); self.send_header('Content-Type', 'text/css'); self.end_headers(); self.wfile.write(b'/* fonts */')
    def log_message(self, *a): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), Slow); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch()
    for delay in (0, 6):
        pg = b.new_page(viewport={'width': 844, 'height': 390})
        def h(route, request, d=delay):
            time.sleep(d)   # hold the request (sync API: blocks the dispatcher, which is what a hung request does to the page)
            route.fulfill(status=200, content_type='text/css', body='/* fonts */')
        pg.route('**/fonts.googleapis.com/**', h)
        t0 = time.time(); pg.goto(URL, wait_until='commit')
        pg.wait_for_function('() => window.DS && DS.UI && DS.UI.root && DS.UI.root.classList.contains("on")', timeout=60000)
        print('font CSS answers after %d s → menu visible after %.1f s' % (delay, time.time() - t0))
        pg.close()
    b.close()
srv.shutdown()
