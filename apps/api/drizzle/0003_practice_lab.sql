CREATE TYPE "public"."pl_attempt_status" AS ENUM('checked', 'sent', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "pl_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"title" text NOT NULL,
	"condition" text NOT NULL,
	"materials" text DEFAULT '' NOT NULL,
	"difficulty" smallint NOT NULL,
	"criteria" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pl_assignments_difficulty_chk" CHECK ("pl_assignments"."difficulty" between 1 and 3)
);
--> statement-breakpoint
ALTER TABLE "pl_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pl_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"attempt_no" integer NOT NULL,
	"answer" text NOT NULL,
	"ai_check" jsonb,
	"status" "pl_attempt_status" DEFAULT 'checked' NOT NULL,
	"evidence_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pl_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pl_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"topics" text[] NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "pl_modules_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "pl_modules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pl_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"topic" text NOT NULL,
	"text" text NOT NULL,
	"options" text[] NOT NULL,
	"correct" smallint NOT NULL,
	"explanation" text NOT NULL,
	CONSTRAINT "pl_questions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "pl_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pl_quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"correct" integer NOT NULL,
	"total" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pl_quiz_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pl_assignments" ADD CONSTRAINT "pl_assignments_module_id_pl_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."pl_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pl_assignments" ADD CONSTRAINT "pl_assignments_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pl_attempts" ADD CONSTRAINT "pl_attempts_assignment_id_pl_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."pl_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pl_attempts" ADD CONSTRAINT "pl_attempts_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pl_attempts" ADD CONSTRAINT "pl_attempts_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pl_questions" ADD CONSTRAINT "pl_questions_module_id_pl_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."pl_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pl_quiz_attempts" ADD CONSTRAINT "pl_quiz_attempts_module_id_pl_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."pl_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pl_quiz_attempts" ADD CONSTRAINT "pl_quiz_attempts_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pl_assignments_module_idx" ON "pl_assignments" USING btree ("module_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pl_attempts_no_uq" ON "pl_attempts" USING btree ("assignment_id","profile_id","attempt_no");--> statement-breakpoint
CREATE INDEX "pl_attempts_profile_idx" ON "pl_attempts" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "pl_questions_module_idx" ON "pl_questions" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "pl_quiz_attempts_profile_idx" ON "pl_quiz_attempts" USING btree ("profile_id","module_id");