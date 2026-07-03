const path = require("path");
const fs = require("fs");

function loadEnv(file) {
  const vars = {};
  try {
    fs.readFileSync(file, "utf8")
      .split("\n")
      .forEach((line) => {
        const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
        if (m) vars[m[1].trim()] = m[2].trim();
      });
  } catch {}
  return vars;
}

const env = loadEnv(path.join(__dirname, ".env"));

module.exports = {
  apps: [
    {
      name: "sdr-engine",
      cwd: __dirname,
      script: "src/server.js",
      interpreter: "node",
      env: { NODE_ENV: "production", ...env },
      max_restarts: 5,
      restart_delay: 3000,
      out_file: "logs/out.log",
      error_file: "logs/err.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
