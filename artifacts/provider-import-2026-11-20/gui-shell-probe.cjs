// Local-only diagnostic GET of the DSH web GUI to inspect its shell for iframe/sandbox markers.
const http = require('http');
const url = process.argv[2] || 'http://127.0.0.1:57591/';
http.get(url, { headers: { accept: 'text/html' } }, res => {
  let body = '';
  res.on('data', c => { body += c; if (body.length > 400000) res.destroy(); });
  res.on('end', () => {
    console.log(`status=${res.statusCode} bytes=${body.length}`);
    console.log(body.slice(0, 6000));
  });
}).on('error', e => console.log('ERR', e.message));
