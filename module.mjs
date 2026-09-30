// @ts-check
import { module } from "@prisma/composer";
import volunteeropsBackendService from "./service.mjs";

// Composer resolves the existing project by this name within the workspace.
// The compatibility client now requires a direct managed PG18/PostGIS URL.
// Compute connectivity must be verified before an approved cutover; no database is provisioned here.
export default module("volunteer-ops", ({ provision }) => {
  provision(volunteeropsBackendService, { id: "volunteeropsbackend" });
});
