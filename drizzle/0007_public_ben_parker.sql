ALTER TABLE "battles" ALTER COLUMN "challenge_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "battles" ADD COLUMN "mode" text DEFAULT 'scheduled' NOT NULL;--> statement-breakpoint
ALTER TABLE "battles" ADD COLUMN "category" text DEFAULT 'Verkaufe dein Produkt oder deine Leistung in 15 Sekunden' NOT NULL;--> statement-breakpoint
ALTER TABLE "battles" ADD COLUMN "brand_a_video_url" text;--> statement-breakpoint
ALTER TABLE "battles" ADD COLUMN "brand_b_video_url" text;--> statement-breakpoint
ALTER TABLE "battles" ADD COLUMN "brand_a_submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "battles" ADD COLUMN "brand_b_submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "battles" ADD COLUMN "production_deadline" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "battles" ADD COLUMN "voting_ends_at" timestamp with time zone;