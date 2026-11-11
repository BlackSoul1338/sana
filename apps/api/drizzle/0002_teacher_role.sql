ALTER TYPE "public"."role" ADD VALUE 'teacher';--> statement-breakpoint
ALTER TABLE "evidence" ADD COLUMN "reviewer_role" "role" DEFAULT 'mentor' NOT NULL;