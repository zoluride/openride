'use strict';
const http = require('node:http');

if (process.env.NODE_ENV === 'production') {
  throw new Error('Developer hub is disabled in production.');
}

const page = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ZOLU Developer Hub</title>
<style>
body{background:#101827;color:white;font:17px/1.6 system-ui;max-width:700px;margin:50px auto;padding:24px}
a{display:block;background:#243247;color:white;padding:20px;margin:16px 0;border-radius:12px;text-decoration:none}
small{color:#cbd5e1}
</style>
<h1>ZOLU Developer Hub</h1>
<p>Development only. Keep forwarded ports private.</p>
<a data-port="8081" target="_blank" rel="noopener noreferrer">Driver — 8081</a>
<a data-port="8082" target="_blank" rel="noopener noreferrer">Rider — 8082</a>
<a data-port="8083" target="_blank" rel="noopener noreferrer">Admin — 8083</a>
<small>Apps must be started separately. This hub does not bypass login or approve documents.</small>
<script>
document.querySelectorAll('[data-port]').forEach(function(link) {
  const url = new URL(location.origin);
  if (url.hostname.includes('-8084.')) {
    url.hostname = url.hostname.replace('-8084.', '-' + link.dataset.port + '.');
    url.port = '';
  } else {
    url.port = link.dataset.port;
  }
  link.href = url.href;
});
</script>
</html>`;

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(page);
});
server.on('error', error => {
  console.error(error.message);
  process.exit(1);
});
server.listen(8084, '0.0.0.0', () => {
  console.log('ZOLU Developer Hub listening on port 8084');
});
