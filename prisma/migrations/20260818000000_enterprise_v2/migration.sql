-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'COORDINATOR', 'TEAM_LEAD', 'VOLUNTEER');
CREATE TYPE "VolunteerStatus" AS ENUM ('ACTIVE', 'DEPLOYED', 'AVAILABLE', 'RESTRICTED', 'INACTIVE');
CREATE TYPE "MissionPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "MissionStatus" AS ENUM ('STAGED', 'ACTIVE', 'CONTAINED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "DeploymentStatus" AS ENUM ('ASSIGNED', 'EN_ROUTE', 'ON_SITE', 'CHECKED_IN', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ContactStatus" AS ENUM ('NEW', 'IN_REVIEW', 'RESPONDED', 'RESOLVED', 'ARCHIVED');

-- CreateTable: users
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VOLUNTEER',
    "phone_number" TEXT,
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: volunteers
CREATE TABLE "volunteers" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "full_name" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "registration_channel" TEXT NOT NULL DEFAULT 'inbuilt',
    "consent_given" BOOLEAN NOT NULL DEFAULT true,
    "registration_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "VolunteerStatus" NOT NULL DEFAULT 'AVAILABLE',
    "date_of_birth" TIMESTAMP(3),
    "emergency_contact" TEXT,
    "bio" TEXT,
    "availability_schedule" JSONB,
    "address" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "avatar_url" TEXT,
    "total_hours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "badge_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "volunteers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: skills
CREATE TABLE "skills" (
    "id" SERIAL NOT NULL,
    "skill_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "demand_level" TEXT NOT NULL DEFAULT 'medium',
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable: volunteer_skills
CREATE TABLE "volunteer_skills" (
    "id" SERIAL NOT NULL,
    "volunteer_id" INTEGER NOT NULL,
    "skill_id" INTEGER NOT NULL,
    "proficiency_level" TEXT NOT NULL DEFAULT 'intermediate',
    "is_certified" BOOLEAN NOT NULL DEFAULT false,
    "certification_date" TIMESTAMP(3),
    "certified_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "volunteer_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable: locations
CREATE TABLE "locations" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT DEFAULT 'USA',
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "osm_id" INTEGER,
    "hazard_level" TEXT NOT NULL DEFAULT 'low',
    "radius_meters" INTEGER NOT NULL DEFAULT 5000,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: events
CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "event_name" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "priority" "MissionPriority" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "location_id" INTEGER NOT NULL,
    "status" "MissionStatus" NOT NULL DEFAULT 'ACTIVE',
    "required_volunteers" INTEGER NOT NULL DEFAULT 10,
    "coordinator_name" TEXT,
    "coordinator_id" INTEGER,
    "required_skills" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable: deployments
CREATE TABLE "deployments" (
    "id" SERIAL NOT NULL,
    "volunteer_id" INTEGER NOT NULL,
    "event_id" INTEGER NOT NULL,
    "assigned_by" INTEGER,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "check_in_time" TIMESTAMP(3),
    "check_in_latitude" DECIMAL(10,7),
    "check_in_longitude" DECIMAL(10,7),
    "check_in_method" TEXT,
    "completed_at" TIMESTAMP(3),
    "status" "DeploymentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: field_reports
CREATE TABLE "field_reports" (
    "id" SERIAL NOT NULL,
    "deployment_id" INTEGER NOT NULL,
    "report_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "report_type" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "text_response" TEXT NOT NULL,
    "media_url" TEXT,
    "file_upload_url" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "submitted_via" TEXT NOT NULL DEFAULT 'mobile_app',
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "verified_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable: communications
CREATE TABLE "communications" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER,
    "channel_id" TEXT NOT NULL DEFAULT 'general',
    "sender_id" INTEGER,
    "sender_name" TEXT NOT NULL,
    "sender_role" TEXT NOT NULL DEFAULT 'coordinator',
    "message" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "message_type" TEXT NOT NULL DEFAULT 'text',
    "media_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable: notifications
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "volunteer_id" INTEGER,
    "event_id" INTEGER,
    "notification_type" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "title" TEXT NOT NULL DEFAULT 'Operational Alert',
    "message" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_by" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable: feedback
CREATE TABLE "feedback" (
    "id" SERIAL NOT NULL,
    "volunteer_id" INTEGER NOT NULL,
    "deployment_id" INTEGER,
    "event_id" INTEGER,
    "feedback_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rating" INTEGER NOT NULL,
    "comments" TEXT NOT NULL,
    "submitted_via" TEXT NOT NULL DEFAULT 'mobile_app',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable: contact_submissions
CREATE TABLE "contact_submissions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "organization" TEXT,
    "inquiry_type" TEXT NOT NULL DEFAULT 'general',
    "status" "ContactStatus" NOT NULL DEFAULT 'NEW',
    "response_notes" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: telemetry_pings
CREATE TABLE "telemetry_pings" (
    "id" SERIAL NOT NULL,
    "volunteer_id" INTEGER NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "altitude" DECIMAL(8,2),
    "battery_level" INTEGER,
    "speed" DECIMAL(6,2),
    "heading" DECIMAL(5,2),
    "is_distress" BOOLEAN NOT NULL DEFAULT false,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telemetry_pings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: audit_logs
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" INTEGER,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: dispatch_jobs
CREATE TABLE "dispatch_jobs" (
    "id" SERIAL NOT NULL,
    "job_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 10,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "dispatch_jobs_pkey" PRIMARY KEY ("id")
);

-- Create Unique Constraints & Indexes
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "volunteers_user_id_key" ON "volunteers"("user_id");
CREATE UNIQUE INDEX "volunteers_email_key" ON "volunteers"("email");
CREATE UNIQUE INDEX "skills_skill_name_key" ON "skills"("skill_name");
CREATE UNIQUE INDEX "volunteer_skills_volunteer_id_skill_id_key" ON "volunteer_skills"("volunteer_id", "skill_id");

CREATE INDEX "idx_volunteers_status" ON "volunteers"("status");
CREATE INDEX "idx_volunteers_geo" ON "volunteers"("latitude", "longitude");
CREATE INDEX "idx_skills_category" ON "skills"("category");
CREATE INDEX "idx_locations_coords" ON "locations"("latitude", "longitude");
CREATE INDEX "idx_events_status_priority" ON "events"("status", "priority");
CREATE INDEX "idx_deployments_volunteer_event" ON "deployments"("volunteer_id", "event_id");
CREATE INDEX "idx_deployments_status" ON "deployments"("status");
CREATE INDEX "idx_field_reports_type_status" ON "field_reports"("report_type", "status");
CREATE INDEX "idx_communications_channel" ON "communications"("channel_id", "created_at");
CREATE INDEX "idx_notifications_volunteer" ON "notifications"("volunteer_id", "status");
CREATE INDEX "idx_contact_status" ON "contact_submissions"("status", "created_at");
CREATE INDEX "idx_telemetry_volunteer_time" ON "telemetry_pings"("volunteer_id", "recorded_at");
CREATE INDEX "idx_audit_entity" ON "audit_logs"("entity_type", "entity_id");
CREATE INDEX "idx_dispatch_jobs_queue" ON "dispatch_jobs"("status", "priority", "created_at");

-- Add Foreign Keys
ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "volunteer_skills" ADD CONSTRAINT "volunteer_skills_volunteer_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "volunteer_skills" ADD CONSTRAINT "volunteer_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_volunteer_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "field_reports" ADD CONSTRAINT "field_reports_deployment_id_fkey" FOREIGN KEY ("deployment_id") REFERENCES "deployments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "communications" ADD CONSTRAINT "communications_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_volunteer_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_volunteer_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_deployment_id_fkey" FOREIGN KEY ("deployment_id") REFERENCES "deployments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "telemetry_pings" ADD CONSTRAINT "telemetry_pings_volunteer_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
