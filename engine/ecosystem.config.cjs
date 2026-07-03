module.exports = {
  apps: [{
    name: 'sdr-totum',
    script: 'src/server.js',
    cwd: __dirname,
    env: { NODE_ENV: 'production' },
    max_restarts: 10,
    restart_delay: 3000,
  }],
};
