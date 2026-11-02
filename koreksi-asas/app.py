import http.server
import socketserver
import webbrowser
import os

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

if __name__ == "__main__":
    url = f"http://localhost:{PORT}/index.html"
    print("=" * 60)
    print("  ASAS Grader - Sistem Otomatis Koreksi Asesmen Siswa")
    print("=" * 60)
    print(f"Menjalankan server lokal di: {url}")
    print("Membuka browser otomatis...")
    webbrowser.open(url)
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        try:
            print("Tekan Ctrl+C di terminal ini untuk menghentikan server.")
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer dihentikan.")
