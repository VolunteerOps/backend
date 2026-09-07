// @ts-check
import node from "@prisma/composer/node";
import { compute } from "@prisma/composer-prisma-cloud";
import { postgres, dataContract } from "@prisma/composer-prisma-cloud/orm";
import volunteeropsBackendContractJson from "./src/generated/prisma8/contract.json" with { type: "json" };

export default compute({
  name: "volunteerops-backend",
  deps: { db: postgres(dataContract(volunteeropsBackendContractJson)) },
  build: node({ module: import.meta.url, dir: "dist", entry: "index.js" }),
});
