CREATE TABLE "alert_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"on_new_issue" boolean DEFAULT true NOT NULL,
	"on_regression" boolean DEFAULT true NOT NULL,
	"on_spike" boolean DEFAULT false NOT NULL,
	"email" text,
	"slack_webhook_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"issue_id" bigint NOT NULL,
	"project_id" integer NOT NULL,
	"type" text NOT NULL,
	"channel" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alert_rules_project_uq" ON "alert_rules" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "notifications_issue_sent_idx" ON "notifications" USING btree ("issue_id","sent_at");