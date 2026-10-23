# Principium Peptides — single Node 24 process with SQLite on a persistent disk.
# The build context must include the approved config/business.json and config/catalog.json for live
# mode; without them site-live/ is not generated and live mode refuses to start (fail closed).
FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY . .
RUN npm run build
EXPOSE 10000
# Starts as root only to take ownership of the mounted disk, then drops to the "node" user.
CMD ["node", "deploy/entrypoint.mjs"]
