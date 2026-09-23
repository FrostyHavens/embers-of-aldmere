# Bundles index.html + src/*.js into a single self-contained HTML file (dist/embers-of-aldmere.html)
import re, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = open(os.path.join(root, 'index.html')).read()
def inline(m):
    src = m.group(1)
    code = open(os.path.join(root, src)).read()
    return '<script>/* %s */\n%s\n</script>' % (src, code.replace('</script', '<\\/script'))
out = re.sub(r'<script src="([^"]+)"></script>', inline, html)
os.makedirs(os.path.join(root, 'dist'), exist_ok=True)
p = os.path.join(root, 'dist', 'embers-of-aldmere.html')
open(p, 'w').write(out)
print(p, len(out)//1024, 'KB')

# Artifact variant: page content only (skeleton is added by the host)
body = re.search(r'<body>(.*)</body>', out, re.S).group(1)
style = re.search(r'<style>(.*?)</style>', out, re.S).group(1)
style = style.replace('html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }', 'html, body { margin: 0; height: 100%; background: #000; overflow: hidden; color-scheme: dark; }')
art = '<title>Embers of Aldmere</title>\n<style>' + style + '</style>\n' + body
open(os.path.join(root, 'dist', 'artifact.html'), 'w').write(art)
print('artifact', len(art)//1024, 'KB')
