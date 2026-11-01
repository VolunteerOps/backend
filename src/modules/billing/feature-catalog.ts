// Durations share capabilities; they are not separate feature tiers.
export const featureCatalog={
 version:'2026-10-01',
 essential_free:['account.manage','missions.read','missions.participate','reports.submit','messages.read','support.create','billing.manage','safety.evidence'],
 capabilities:{
  'agent.chat':{entitlements:['resq_pro','resqops_pro'],roles:['VOLUNTEER','COORDINATOR','ORG_ADMIN'],requires_membership:true,requires_model:true},
  'agent.proposals':{entitlements:['resqops_pro'],roles:['COORDINATOR','ORG_ADMIN'],available:false},
  'analytics.export':{entitlements:['resqops_pro'],roles:['COORDINATOR','ORG_ADMIN'],available:true},
 },
 assistant:{bucket:'agent.chat',scope:'PERSONAL_ACROSS_WORKSPACES',reset:'MIDNIGHT_UTC',volunteer_daily_attempts:20,ops_daily_attempts:60,failed_provider_attempts_count:true},
 sponsorship:{seats:3,scope:'SPONSORING_ORGANIZATION_ONLY',requires_active_sponsor:true},
} as const;
