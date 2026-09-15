ALTER TABLE `arena_rooms` ADD `transport` text DEFAULT 'http-v1' NOT NULL;
--> statement-breakpoint
ALTER TABLE `arena_rooms` ADD `owner_id` text;
--> statement-breakpoint
ALTER TABLE `arena_rooms` ADD `owner_epoch` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `arena_rooms` ADD `lease_until` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `arena_rooms` ADD `checkpointed_at` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE INDEX `arena_rooms_transport` ON `arena_rooms` (`transport`);
--> statement-breakpoint
CREATE INDEX `arena_rooms_lease` ON `arena_rooms` (`lease_until`);
