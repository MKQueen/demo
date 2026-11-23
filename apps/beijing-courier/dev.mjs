import { createServer } from 'vite';

const vite = await createServer({ server: { host: '127.0.0.1', port: 5190, strictPort: false } });
await vite.listen();
vite.printUrls();

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await vite.close();
    process.exit();
  });
}
