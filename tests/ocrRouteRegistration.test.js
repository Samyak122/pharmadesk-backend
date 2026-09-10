const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const app = require('../src/app');

function request(path, method = 'POST') {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const request = http.request({
        host: '127.0.0.1',
        port,
        path,
        method,
      }, (response) => {
        response.resume();
        response.once('end', () => {
          server.close(() => resolve(response.statusCode));
        });
      });
      request.once('error', (error) => server.close(() => reject(error)));
      request.end();
    });
  });
}

test('registers OCR health, extract, and confirm under /api/ocr', async () => {
  assert.equal(await request('/api/ocr/health', 'GET'), 200);
  assert.equal(await request('/api/ocr/extract'), 401);
  assert.equal(await request('/api/ocr/confirm'), 401);
});

test('does not register the duplicate /api/ocr/api/ocr/extract path', async () => {
  assert.equal(await request('/api/ocr/api/ocr/extract'), 404);
});
