CREATE TYPE "public"."assignment_source" AS ENUM('manual', 'match');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."task_kind" AS ENUM('business_challenge');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."evidence_kind" AS ENUM('link', 'screenshot', 'interview', 'report');--> statement-breakpoint
CREATE TYPE "public"."evidence_status" AS ENUM('pending', 'approved', 'rejected', 'adjusted');--> statement-breakpoint
CREATE TYPE "public"."org_kind" AS ENUM('company', 'group');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('student', 'mentor', 'business');--> statement-breakpoint
CREATE TYPE "public"."subject_type" AS ENUM('team', 'profile', 'org');--> statement-breakpoint
CREATE TYPE "public"."bcb_draft_status" AS ENUM('collecting', 'composed', 'published');--> statement-breakpoint
CREATE TYPE "public"."bcb_message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."match_application_status" AS ENUM('pending', 'accepted', 'declined', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."match_feedback_verdict" AS ENUM('positive', 'needs_work');--> statement-breakpoint
CREATE TYPE "public"."sprint_project_status" AS ENUM('active', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."sprint_task_status" AS ENUM('todo', 'in_progress', 'submitted', 'done');--> statement-breakpoint
CREATE TYPE "public"."sprint_stage_key" AS ENUM('idea', 'problem', 'interviews', 'prototype', 'testing');--> statement-breakpoint
CREATE TYPE "public"."sprint_stage_status" AS ENUM('open', 'submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"source" "assignment_source" NOT NULL,
	"status" "assignment_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "task_skills" (
	"task_id" uuid NOT NULL,
	"skill_slug" text NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	CONSTRAINT "task_skills_task_id_skill_slug_pk" PRIMARY KEY("task_id","skill_slug")
);
--> statement-breakpoint
ALTER TABLE "task_skills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "task_kind" NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"status" "task_status" DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"readiness" integer DEFAULT 0 NOT NULL,
	"topic" text NOT NULL,
	"difficulty" smallint NOT NULL,
	"est_hours" integer NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_ref" text,
	"created_by" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_readiness_chk" CHECK ("tasks"."readiness" between 0 and 100),
	CONSTRAINT "tasks_difficulty_chk" CHECK ("tasks"."difficulty" between 1 and 3)
);
--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"team_id" uuid,
	"submitted_by" uuid NOT NULL,
	"kind" "evidence_kind" NOT NULL,
	"url" text,
	"storage_path" text,
	"note" text DEFAULT '' NOT NULL,
	"status" "evidence_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"review_comment" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evidence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" "org_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orgs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"role" "role" NOT NULL,
	"org_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ref_roles" (
	"slug" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ref_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ref_skills" (
	"slug" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"difficulty" smallint NOT NULL,
	CONSTRAINT "ref_skills_difficulty_chk" CHECK ("ref_skills"."difficulty" between 1 and 3)
);
--> statement-breakpoint
ALTER TABLE "ref_skills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "team_members" (
	"team_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"role_slug" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_team_id_profile_id_pk" PRIMARY KEY("team_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "team_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "team_skills" (
	"team_id" uuid NOT NULL,
	"skill_slug" text NOT NULL,
	"level" smallint NOT NULL,
	CONSTRAINT "team_skills_team_id_skill_slug_pk" PRIMARY KEY("team_id","skill_slug"),
	CONSTRAINT "team_skills_level_chk" CHECK ("team_skills"."level" between 1 and 3)
);
--> statement-breakpoint
ALTER TABLE "team_skills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"org_id" uuid,
	"weekly_hours" integer DEFAULT 10 NOT NULL,
	"interests" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "point_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" "subject_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"module" text NOT NULL,
	"rule_id" text NOT NULL,
	"points" integer NOT NULL,
	"explanation" text NOT NULL,
	"evidence_id" uuid,
	"actor_id" uuid,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "point_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bcb_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"turn" integer NOT NULL,
	"fields" jsonb NOT NULL,
	"readiness" integer NOT NULL,
	"questions" jsonb NOT NULL,
	"changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bcb_analyses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bcb_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"raw_text" text NOT NULL,
	"status" "bcb_draft_status" DEFAULT 'collecting' NOT NULL,
	"turn_count" integer DEFAULT 0 NOT NULL,
	"readiness" integer DEFAULT 0 NOT NULL,
	"card" jsonb,
	"summary" text,
	"requirements" jsonb,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"task_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bcb_drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bcb_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"role" "bcb_message_role" NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bcb_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "match_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"status" "match_application_status" DEFAULT 'pending' NOT NULL,
	"score" integer NOT NULL,
	"fit" jsonb NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"created_by" uuid NOT NULL,
	"decided_by" uuid,
	"decision_comment" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "match_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evidence_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"verdict" "match_feedback_verdict" NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sprint_task_templates" (
	"slug" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"stage_key" "sprint_stage_key" NOT NULL,
	"default_skill_slug" text,
	"description" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sprint_task_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sprint_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"code" text NOT NULL,
	"evidence_id" uuid,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sprint_achievements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sprint_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"title" text NOT NULL,
	"idea" text NOT NULL,
	"assignment_id" uuid,
	"status" "sprint_project_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sprint_projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sprint_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"stage_key" "sprint_stage_key" NOT NULL,
	"order" smallint NOT NULL,
	"status" "sprint_stage_status" DEFAULT 'open' NOT NULL,
	"planned_at" date NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sprint_stages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sprint_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"template_slug" text,
	"title" text NOT NULL,
	"stage_key" "sprint_stage_key" NOT NULL,
	"assignee_id" uuid,
	"skill_slug" text,
	"status" "sprint_task_status" DEFAULT 'todo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sprint_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_skills" ADD CONSTRAINT "task_skills_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_skills" ADD CONSTRAINT "task_skills_skill_slug_ref_skills_slug_fk" FOREIGN KEY ("skill_slug") REFERENCES "public"."ref_skills"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_org_id_orgs_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_submitted_by_profiles_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_role_slug_ref_roles_slug_fk" FOREIGN KEY ("role_slug") REFERENCES "public"."ref_roles"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_skills" ADD CONSTRAINT "team_skills_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_skills" ADD CONSTRAINT "team_skills_skill_slug_ref_skills_slug_fk" FOREIGN KEY ("skill_slug") REFERENCES "public"."ref_skills"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_events" ADD CONSTRAINT "point_events_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_events" ADD CONSTRAINT "point_events_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bcb_analyses" ADD CONSTRAINT "bcb_analyses_draft_id_bcb_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."bcb_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bcb_analyses" ADD CONSTRAINT "bcb_analyses_message_id_bcb_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."bcb_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bcb_drafts" ADD CONSTRAINT "bcb_drafts_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bcb_drafts" ADD CONSTRAINT "bcb_drafts_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bcb_drafts" ADD CONSTRAINT "bcb_drafts_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bcb_messages" ADD CONSTRAINT "bcb_messages_draft_id_bcb_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."bcb_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_applications" ADD CONSTRAINT "match_applications_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_applications" ADD CONSTRAINT "match_applications_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_applications" ADD CONSTRAINT "match_applications_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_applications" ADD CONSTRAINT "match_applications_decided_by_profiles_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_feedback" ADD CONSTRAINT "match_feedback_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_feedback" ADD CONSTRAINT "match_feedback_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_feedback" ADD CONSTRAINT "match_feedback_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_feedback" ADD CONSTRAINT "match_feedback_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_task_templates" ADD CONSTRAINT "sprint_task_templates_default_skill_slug_ref_skills_slug_fk" FOREIGN KEY ("default_skill_slug") REFERENCES "public"."ref_skills"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_achievements" ADD CONSTRAINT "sprint_achievements_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_achievements" ADD CONSTRAINT "sprint_achievements_project_id_sprint_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."sprint_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_achievements" ADD CONSTRAINT "sprint_achievements_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_projects" ADD CONSTRAINT "sprint_projects_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_projects" ADD CONSTRAINT "sprint_projects_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_projects" ADD CONSTRAINT "sprint_projects_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_stages" ADD CONSTRAINT "sprint_stages_project_id_sprint_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."sprint_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_tasks" ADD CONSTRAINT "sprint_tasks_project_id_sprint_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."sprint_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_tasks" ADD CONSTRAINT "sprint_tasks_template_slug_sprint_task_templates_slug_fk" FOREIGN KEY ("template_slug") REFERENCES "public"."sprint_task_templates"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_tasks" ADD CONSTRAINT "sprint_tasks_assignee_id_profiles_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_tasks" ADD CONSTRAINT "sprint_tasks_skill_slug_ref_skills_slug_fk" FOREIGN KEY ("skill_slug") REFERENCES "public"."ref_skills"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assignments_task_team_uq" ON "assignments" USING btree ("task_id","team_id");--> statement-breakpoint
CREATE INDEX "assignments_team_idx" ON "assignments" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "tasks_status_readiness_idx" ON "tasks" USING btree ("status","readiness");--> statement-breakpoint
CREATE INDEX "tasks_owner_idx" ON "tasks" USING btree ("owner_org_id");--> statement-breakpoint
CREATE INDEX "evidence_status_idx" ON "evidence" USING btree ("status","module");--> statement-breakpoint
CREATE INDEX "evidence_subject_idx" ON "evidence" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "evidence_team_idx" ON "evidence" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "profiles_org_idx" ON "profiles" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "team_members_profile_idx" ON "team_members" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "point_events_idem_uq" ON "point_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "point_events_subject_idx" ON "point_events" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "point_events_evidence_idx" ON "point_events" USING btree ("evidence_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bcb_analyses_draft_turn_uq" ON "bcb_analyses" USING btree ("draft_id","turn");--> statement-breakpoint
CREATE INDEX "bcb_drafts_org_idx" ON "bcb_drafts" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bcb_messages_draft_seq_uq" ON "bcb_messages" USING btree ("draft_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "match_applications_live_uq" ON "match_applications" USING btree ("team_id","task_id") WHERE "match_applications"."status" in ('pending', 'accepted');--> statement-breakpoint
CREATE INDEX "match_applications_task_idx" ON "match_applications" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_feedback_evidence_uq" ON "match_feedback" USING btree ("evidence_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sprint_achievements_project_code_uq" ON "sprint_achievements" USING btree ("project_id","code");--> statement-breakpoint
CREATE INDEX "sprint_projects_team_idx" ON "sprint_projects" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sprint_stages_project_key_uq" ON "sprint_stages" USING btree ("project_id","stage_key");--> statement-breakpoint
CREATE INDEX "sprint_tasks_project_idx" ON "sprint_tasks" USING btree ("project_id");--> statement-breakpoint
CREATE VIEW "public"."v_leaderboard" WITH (security_invoker = true) AS (
  select subject_type, subject_id, sum(points)::bigint as total,
         rank() over (partition by subject_type order by sum(points) desc)::bigint as rank
  from point_events
  group by subject_type, subject_id
);