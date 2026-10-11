"""OAuth regression checks in Firefox/Zen using its native Marionette protocol."""
import http.server
import json
import mimetypes
import os
import pathlib
import socket
import subprocess
import tempfile
import threading
import time
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
reset_popup_storage = False
drop_popup_messages = False
deny_session = False
servers = []
browser = None
connection = None


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def respond(self, status, body, content_type='application/json', headers=None):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Access-Control-Allow-Origin', front)
        self.send_header('Access-Control-Allow-Credentials', 'true')
        self.send_header('Access-Control-Allow-Headers', 'content-type')
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        try:
            self.wfile.write(body.encode() if isinstance(body, str) else body)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass  # Closing or navigating the popup cancels outstanding asset requests.

    def do_OPTIONS(self):
        self.respond(204, '')

    def do_GET(self):
        url = urllib.parse.urlsplit(self.path)
        params = urllib.parse.parse_qs(url.query)
        if self.server is servers[0]:
            file = dist / url.path.lstrip('/')
            if not file.is_file():
                file = dist / 'index.html'
            body = file.read_bytes()
            if url.path == '/auth/google/popup' and params.get('complete') == ['1']:
                script = 'sessionStorage.clear();' if reset_popup_storage else ''
                if drop_popup_messages:
                    script += 'BroadcastChannel.prototype.postMessage=function(){};'
                body = body.replace(b'<head>', ('<head><script>' + script + '</script>').encode(), 1)
            self.respond(200, body, mimetypes.guess_type(str(file))[0] or 'application/octet-stream')
        elif self.server is servers[2]:
            target = api + '/auth/google/callback?' + urllib.parse.urlencode({'attempt': params.get('attempt', [''])[0]})
            body = '<button id="confirm" onclick=\'location.replace(' + json.dumps(target) + ')\'>Confirm sign-in</button>'
            self.respond(200, body, 'text/html', {'Cross-Origin-Opener-Policy': 'same-origin'})
        elif url.path == '/auth/google':
            target = provider + '/sign-in?' + urllib.parse.urlencode({'attempt': params.get('popupAttempt', [''])[0]})
            self.respond(302, '', headers={'Location': target})
        elif url.path == '/auth/google/callback':
            attempt = params.get('attempt', [''])[0]
            target = front + '/auth/google/popup?' + urllib.parse.urlencode({'attempt': attempt, 'complete': '1'}) if attempt else front + '/app'
            self.respond(302, '', headers={'Location': target, 'Cross-Origin-Opener-Policy': 'same-origin', 'Set-Cookie': 'test_session=ok; HttpOnly; SameSite=Lax; Path=/'})
        elif url.path == '/auth/profile':
            authenticated = not deny_session and 'test_session=ok' in self.headers.get('Cookie', '')
            data = {'id': 1, 'email': 'test@example.com'} if authenticated else {'message': 'Unauthorized'}
            self.respond(200 if authenticated else 401, json.dumps(data))
        elif url.path == '/word-sets':
            self.respond(200, '[]')
        else:
            self.respond(404, '{}')


try:
    for host in ['localhost', 'localhost', '127.0.0.1']:
        server = http.server.ThreadingHTTPServer((host, 0), Handler)
        servers.append(server)
    front, api, provider = [f'http://{host}:{server.server_port}' for host, server in zip(['localhost', 'localhost', '127.0.0.1'], servers)]
    for server in servers:
        threading.Thread(target=server.serve_forever, daemon=True).start()
    artifacts = pathlib.Path(tempfile.mkdtemp(prefix='vocab-gecko-check-'))
    dist = artifacts / 'dist'
    assert dist.resolve().parent == artifacts.resolve()
    subprocess.run(['bun', 'run', 'build', '--outDir', str(dist), '--emptyOutDir'], cwd=ROOT, env=dict(os.environ, VITE_API_BASE_URL=api), check=True, stdout=subprocess.DEVNULL)
    profile = artifacts / 'profile'
    profile.mkdir()
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    prefs = {'marionette.port': port, 'browser.shell.checkDefaultBrowser': False, 'browser.startup.homepage_override.mstone': 'ignore', 'zen.welcome-screen.seen': True, 'datareporting.policy.dataSubmissionPolicyBypassNotification': True}
    (profile / 'user.js').write_text(''.join('user_pref(' + json.dumps(key) + ', ' + json.dumps(value) + ');\n' for key, value in prefs.items()))
    executable = os.environ.get('FIREFOX_PATH', r'C:\Program Files\Zen Browser\zen.exe' if os.name == 'nt' else 'firefox')
    browser = subprocess.Popen([executable, '--no-remote', '--headless', '--marionette', '--profile', str(profile)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=0x08000000 if os.name == 'nt' else 0)
    for _ in range(150):
        try:
            connection = socket.create_connection(('127.0.0.1', port), timeout=1)
            break
        except OSError:
            time.sleep(.1)
    if connection is None:
        raise RuntimeError('Browser did not start Marionette; check FIREFOX_PATH')
    connection.settimeout(20)

    def read():
        length = b''
        while not length.endswith(b':'):
            part = connection.recv(1)
            if not part:
                raise RuntimeError('Browser connection closed')
            length += part
        size = int(length[:-1])
        body = b''
        while len(body) < size:
            part = connection.recv(size - len(body))
            if not part:
                raise RuntimeError('Browser connection closed')
            body += part
        return json.loads(body)

    read()
    command_id = 0

    def command(name, params=None):
        global command_id
        command_id += 1
        body = json.dumps([0, command_id, name, params or {}]).encode()
        connection.sendall(str(len(body)).encode() + b':' + body)
        response = read()
        if response[2]:
            raise RuntimeError(json.dumps(response[2]))
        result = response[3]
        return result.get('value', result) if isinstance(result, dict) else result

    def execute(script):
        return command('WebDriver:ExecuteScript', {'script': script, 'args': [], 'newSandbox': False, 'sandbox': None})

    def click(selector):
        element = command('WebDriver:FindElement', {'using': 'css selector', 'value': selector})
        command('WebDriver:ElementClick', {'id': element['element-6066-11e4-a52e-4f735466cecf']})

    def wait_for(script):
        for _ in range(50):
            if execute(script):
                return
            time.sleep(.1)
        raise AssertionError('Timed out: ' + script + '\n' + execute('return document.body.innerText'))

    session = command('WebDriver:NewSession', {'capabilities': {'alwaysMatch': {'acceptInsecureCerts': True}}})
    print('Browser:', session['capabilities']['browserName'], session['capabilities']['browserVersion'], flush=True)
    command('WebDriver:Navigate', {'url': front + '/register'})
    parent = command('WebDriver:GetWindowHandle')
    execute("localStorage.setItem('i18nextLng','en')")

    for scenario in ['normal', 'lost storage and messages', 'rejected session']:
        reset_popup_storage = scenario == 'lost storage and messages'
        drop_popup_messages = reset_popup_storage
        deny_session = scenario == 'rejected session'
        command('WebDriver:DeleteAllCookies')
        command('WebDriver:Navigate', {'url': front + '/register'})
        wait_for('return !!document.querySelector(\'button[aria-label="Sign up with Google"]\')')
        execute('window.__nativeOpen=window.open;window.open=function(...args){return window.__popup=window.__nativeOpen.apply(this,args)}')
        click('button[aria-label="Sign up with Google"]')
        for _ in range(30):
            handles = command('WebDriver:GetWindowHandles')
            if len(handles) > 1:
                break
            time.sleep(.1)
        popup = next(handle for handle in handles if handle != parent)
        command('WebDriver:SwitchToWindow', {'handle': popup})
        wait_for('return !!document.querySelector("#confirm")')
        command('WebDriver:SwitchToWindow', {'handle': parent})
        time.sleep(2.2)
        assert execute('return window.__popup.closed'), 'Test must sever the opener reference'
        assert execute('return location.pathname') == '/register', 'Sign-in must wait for the provider callback'
        assert not execute('return document.body.innerText.includes("Cancel Google sign-in")')
        command('WebDriver:SwitchToWindow', {'handle': popup})
        click('#confirm')
        command('WebDriver:SwitchToWindow', {'handle': parent})
        if scenario in ['normal', 'lost storage and messages']:
            wait_for('return location.pathname === "/app"')
            wait_for('return document.body.innerText.includes("Table builder")')
        elif scenario == 'rejected session':
            wait_for('return document.body.innerText.includes("Google sign-in failed")')
            assert execute('return location.pathname') == '/register'
        assert popup not in command('WebDriver:GetWindowHandles'), 'OAuth popup did not close'
        print('PASS:', scenario, flush=True)
    print('Gecko OAuth regression checks passed', flush=True)
finally:
    if connection:
        connection.close()
    if browser:
        browser.terminate()
        try:
            browser.wait(timeout=5)
        except subprocess.TimeoutExpired:
            browser.kill()
    for server in servers:
        server.shutdown()
