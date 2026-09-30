# ResQ deployment

**Target: Railway.** Use the [production deployment runbook](docs/railway-production-deployment-runbook.md), [seven-stage implementation roadmap](docs/resq-production-implementation-roadmap.md), and [data migration/recovery procedure](docs/railway-data-migration-and-recovery.md).

The current code is not the completed platform. Stage 1 establishes staging infrastructure; Stage 7 performs the approved production cutover after feature, identity, billing, provider, device, scientific and recovery gates pass. Retired hosting instructions have been removed; Prisma ORM remains the schema/data layer.

No cloud service, DNS, runtime secret or database was changed by the documentation consolidation. See the [checkpoint](docs/sentinel-continuation-status.md) for existing implementation and the [documentation audit](docs/resq-documentation-audit.md) for source coverage.
