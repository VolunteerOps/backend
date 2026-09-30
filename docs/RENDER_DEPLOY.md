# Render deployment

Render is the owner's current deployment target. The earlier Compute-only / Render-retired guidance is superseded by the 30 September 2026 scope.

Target **With Intent** workspace, **Volunteer Ops** project. Start with [the detailed Sentinel setup and activation guide](sentinel-setup-and-activation.md#8-prepare-render-with-intent--volunteer-ops), [render.yaml](../render.yaml), and the optional [WeatherNext worker definition](../deploy/render.forecast.yaml).

The definitions propose a pilot environment. They have not been applied to Render, and the seven-step implementation is not production-complete. Inspect existing services before applying resource names. Keep migration-owner credentials separate from the non-owner API/worker role.
