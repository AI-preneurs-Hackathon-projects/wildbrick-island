CREATE TABLE `arena_creations` (
	`id` text PRIMARY KEY NOT NULL,
	`blueprint` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `arena_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`snapshot` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `arena_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`principal` text NOT NULL,
	`room_id` text NOT NULL,
	`player_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`rate_start` integer NOT NULL,
	`rate_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `arena_sessions_expiry` ON `arena_sessions` (`expires_at`);