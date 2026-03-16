import json
import os
import urllib.request
from http.server import BaseHTTPRequestHandler

LINEAR_API_KEY = os.environ.get('LINEAR_API_KEY', '')

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length))
            issue_id = body.get('issueId')
            state_id = body.get('stateId')

            if issue_id and state_id and LINEAR_API_KEY:
                query = f'mutation {{ issueUpdate(id: "{issue_id}", input: {{ stateId: "{state_id}" }}) {{ success }} }}'
                data = json.dumps({'query': query}).encode()
                req = urllib.request.Request(
                    'https://api.linear.app/graphql',
                    data=data,
                    headers={
                        'Authorization': LINEAR_API_KEY,
                        'Content-Type': 'application/json'
                    }
                )
                try:
                    urllib.request.urlopen(req, timeout=5)
                except Exception as e:
                    print(f'Linear API error: {e}')

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
