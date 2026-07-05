module.exports = {
  apps: [{
    name: 'sdr-totum',
    script: 'src/server.js',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
      LANG: 'C.UTF-8',
      LC_ALL: 'C.UTF-8',
    },
    max_restarts: 10,
    restart_delay: 3000,
  }],
};
