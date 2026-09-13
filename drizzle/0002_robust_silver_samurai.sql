CREATE TABLE `generation_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`principal` text NOT NULL,
	`started_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `generation_started` ON `generation_requests` (`started_at`);--> statement-breakpoint
CREATE INDEX `generation_expiry` ON `generation_requests` (`expires_at`);