// @ts-check
import node from "@prisma/composer/node";
import { compute } from "@prisma/composer-prisma-cloud";

export default compute({
  name: "volunteerops-backend",
  // Existing API routes receive their database/JWT/S3 configuration through
  // project runtime variables. Migration ownership remains with Prisma 8.
  deps: {},
  build: node({ module: import.meta.url, dir: "dist", entry: "index.js" }),
});
