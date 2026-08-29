module.exports = {
  apps: [
    {
      name: "techmax-api",
      script: "server/index.js",
      env: {
        NODE_ENV: "production",
        API_PORT: "4000"
      }
    },
    {
      name: "techmax-web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
