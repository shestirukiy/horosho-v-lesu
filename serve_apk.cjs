const http = require('http');
const fs = require('fs');

const file = 'H:/HoroshoVLesu/Repo/horosho-v-lesu/public/HoroshoVLesu.apk';

const server = http.createServer((req, res) => {
  if (fs.existsSync(file)) {
    const stat = fs.statSync(file);
    res.writeHead(200, {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': 'attachment; filename="HoroshoVLesu.apk"',
      'Content-Length': stat.size,
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(file).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(8899, '0.0.0.0', () => {
  console.log('APK_SERVER_READY_AT_http://192.168.0.106:8899/HoroshoVLesu.apk');
});
