# Backend architecture and implementation — current entry point

The backend blueprint has been consolidated into the [ResQ seven-stage production roadmap](resq-production-implementation-roadmap.md). That guide includes the original operational modules, PostgreSQL queue/spatial/search/analytics capabilities, full Sentinel scope and all three frontend repositories, plus independent volunteer signup, recruitment and RevenueCat Pro access.

Use the [Railway runbook](railway-production-deployment-runbook.md) for hosting and [migration/recovery guide](railway-data-migration-and-recovery.md) for data preservation. The previous backend-only roadmap, local-JWT examples, global API authorization and hosting diagrams are superseded. Prisma ORM and one canonical migration history remain; Firebase is the identity provider and scoped database authorization governs operations.

The [documentation audit](resq-documentation-audit.md) records the source topics and their new stages. No implementation is declared complete by this consolidation.
