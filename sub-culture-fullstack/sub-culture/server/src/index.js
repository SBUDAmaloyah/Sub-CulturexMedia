const cfg = require('./config');
const { createApp } = require('./app');

const server = createApp().listen(cfg.port, () => {
  console.log(`Sub Culture running on http://localhost:${cfg.port}`);
  console.log(`  client:  ${cfg.clientDir}`);
  console.log(`  db:      ${cfg.dbPath}`);
  console.log(`  uploads: ${cfg.uploadDir}`);
  console.log('  scores:  ' + Object.entries(cfg.scores.providers).map(([k, v]) => `${k}=${v}`).join(' '));
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
