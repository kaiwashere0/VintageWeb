module.exports = {
  apps: [
    {
      name: 'vintage-club-web',
      script: 'server.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        PORT: 7635,
        HOST: '0.0.0.0',
        SITE_MODE: 3
      }
    }
  ]
};
