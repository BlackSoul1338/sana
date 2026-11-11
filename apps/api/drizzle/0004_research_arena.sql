CREATE TYPE "public"."ra_item_kind" AS ENUM('argument', 'source', 'question');--> statement-breakpoint
CREATE TYPE "public"."ra_role" AS ENUM('coordinator', 'researcher', 'critic', 'editor');--> statement-breakpoint
CREATE TYPE "public"."ra_stance" AS ENUM('for', 'against');--> statement-breakpoint
CREATE TYPE "public"."ra_workspace_status" AS ENUM('active', 'submitted', 'approved');--> statement-breakpoint
CREATE TABLE "ra_conclusions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"final_position" text NOT NULL,
	"statements" jsonb NOT NULL,
	"assessment" jsonb,
	"evidence_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ra_conclusions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ra_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" "ra_item_kind" NOT NULL,
	"text" text NOT NULL,
	"url" text,
	"thread_id" uuid,
	"stance" "ra_stance",
	"link_ids" uuid[] DEFAULT '{}' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ra_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ra_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ra_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ra_roles" (
	"workspace_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"role" "ra_role" NOT NULL,
	CONSTRAINT "ra_roles_workspace_id_profile_id_pk" PRIMARY KEY("workspace_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "ra_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ra_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"question" text NOT NULL,
	"context" text DEFAULT '' NOT NULL,
	"rubric" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ra_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ra_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ra_threads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ra_workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"initial_position" text NOT NULL,
	"status" "ra_workspace_status" DEFAULT 'active' NOT NULL,
	"summary" jsonb,
	"summary_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ra_workspaces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ra_conclusions" ADD CONSTRAINT "ra_conclusions_workspace_id_ra_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."ra_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ra_conclusions" ADD CONSTRAINT "ra_conclusions_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ra_conclusions" ADD CONSTRAINT "ra_conclusions_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ra_items" ADD CONSTRAINT "ra_items_workspace_id_ra_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."ra_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ra_items" ADD CONSTRAINT "ra_items_thread_id_ra_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."ra_threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ra_items" ADD CONSTRAINT "ra_items_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ra_messages" ADD CONSTRAINT "ra_messages_workspace_id_ra_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."ra_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ra_messages" ADD CONSTRAINT "ra_messages_thread_id_ra_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."ra_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ra_messages" ADD CONSTRAINT "ra_messages_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ra_roles" ADD CONSTRAINT "ra_roles_workspace_id_ra_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."ra_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ra_roles" ADD CONSTRAINT "ra_roles_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ra_tasks" ADD CONSTRAINT "ra_tasks_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ra_threads" ADD CONSTRAINT "ra_threads_workspace_id_ra_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."ra_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ra_threads" ADD CONSTRAINT "ra_threads_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ra_workspaces" ADD CONSTRAINT "ra_workspaces_task_id_ra_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."ra_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ra_workspaces" ADD CONSTRAINT "ra_workspaces_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ra_workspaces" ADD CONSTRAINT "ra_workspaces_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ra_conclusions_version_uq" ON "ra_conclusions" USING btree ("workspace_id","version");--> statement-breakpoint
CREATE INDEX "ra_items_ws_idx" ON "ra_items" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "ra_messages_ws_time_idx" ON "ra_messages" USING btree ("workspace_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ra_threads_ws_idx" ON "ra_threads" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ra_workspaces_task_team_uq" ON "ra_workspaces" USING btree ("task_id","team_id");--> statement-breakpoint
CREATE INDEX "ra_workspaces_team_idx" ON "ra_workspaces" USING btree ("team_id");