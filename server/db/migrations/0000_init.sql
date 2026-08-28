CREATE TABLE `day_log` (
	`date` text PRIMARY KEY NOT NULL,
	`sessions_count` integer DEFAULT 0 NOT NULL,
	`minutes` real DEFAULT 0 NOT NULL,
	`mean_note` real,
	`constructs_json` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `exam_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`part_notes_json` text DEFAULT '{}' NOT NULL,
	`passed` integer,
	`verdict_json` text DEFAULT '{}' NOT NULL,
	`seed` integer NOT NULL,
	`repeated_seed` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`construct` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_slug_unique` ON `games` (`slug`);--> statement-breakpoint
CREATE TABLE `plan_days` (
	`date` text PRIMARY KEY NOT NULL,
	`prescribed_json` text NOT NULL,
	`completed_json` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`game_slug` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`duration_ms` integer NOT NULL,
	`difficulty` real NOT NULL,
	`raw_score` real NOT NULL,
	`accuracy` real NOT NULL,
	`note` real,
	`note_source` text,
	`seed` integer NOT NULL,
	`mode` text NOT NULL,
	`metrics_json` text DEFAULT '{}' NOT NULL,
	`device_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`synced_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_game_started` ON `sessions` (`game_slug`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_sessions_started` ON `sessions` (`started_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`idx` integer NOT NULL,
	`item_type` text NOT NULL,
	`difficulty` real NOT NULL,
	`item_json` text NOT NULL,
	`response_json` text,
	`correct` integer NOT NULL,
	`rt_ms` integer NOT NULL,
	`presented_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_trials_session` ON `trials` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_trials_item_type` ON `trials` (`item_type`);