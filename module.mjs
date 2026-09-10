// @ts-check
import { module } from "@prisma/composer";
import volunteeropsBackendService from "./service.mjs";

// Composer resolves the existing project by this name within the workspace.
// The compatibility client uses the existing DATABASE_URL/Accelerate database;
// deploying this web service must not provision a replacement database.
export default module("volunteer-ops", ({ provision }) => {
  provision(volunteeropsBackendService, { id: "volunteeropsbackend" });
});
