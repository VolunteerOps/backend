// @ts-check
import { module } from "@prisma/composer";
import { postgres, dataContract } from "@prisma/composer-prisma-cloud/orm";
import volunteeropsBackendContractJson from "./src/prisma/contract.json" with { type: "json" };
import volunteeropsBackendService from "./service.mjs";

export default module("volunteerops-backend", ({ provision }) => {
  const database = provision(postgres({ name: "database", contract: dataContract(volunteeropsBackendContractJson), config: "./prisma.config.ts" }));
  provision(volunteeropsBackendService, { id: "volunteeropsbackend", deps: { db: database } });
});
