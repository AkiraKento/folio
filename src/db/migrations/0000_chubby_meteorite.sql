CREATE TABLE `annotations` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`group_key` text,
	`kind` text NOT NULL,
	`color` text NOT NULL,
	`quote` text NOT NULL,
	`prefix` text DEFAULT '' NOT NULL,
	`suffix` text DEFAULT '' NOT NULL,
	`start` integer DEFAULT 0 NOT NULL,
	`end` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_ann_note` ON `annotations` (`note_id`);--> statement-breakpoint
CREATE INDEX `ix_ann_group` ON `annotations` (`group_key`);--> statement-breakpoint
CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`deck_id` text NOT NULL,
	`ord` integer NOT NULL,
	`due` integer NOT NULL,
	`stability` real DEFAULT 0 NOT NULL,
	`difficulty` real DEFAULT 0 NOT NULL,
	`elapsed_days` integer DEFAULT 0 NOT NULL,
	`scheduled_days` integer DEFAULT 0 NOT NULL,
	`learning_steps` integer DEFAULT 0 NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`state` integer DEFAULT 0 NOT NULL,
	`last_review` integer,
	`suspended` integer DEFAULT 0 NOT NULL,
	`buried_until` integer,
	`source_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deck_id`) REFERENCES `decks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_cards_note_id` ON `cards` (`note_id`);--> statement-breakpoint
CREATE INDEX `ix_cards_deck_id` ON `cards` (`deck_id`);--> statement-breakpoint
CREATE INDEX `ix_cards_due` ON `cards` (`due`);--> statement-breakpoint
CREATE TABLE `consulta_pos` (
	`deck_query` text PRIMARY KEY NOT NULL,
	`unit_index` integer DEFAULT 0 NOT NULL,
	`scroll_offset` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `decks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`area` text,
	`description` text,
	`source_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `ix_decks_name` ON `decks` (`name`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`sha1` text NOT NULL,
	`bytes` integer NOT NULL,
	`mime` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `ix_media_filename` ON `media` (`filename`);--> statement-breakpoint
CREATE TABLE `note_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`fields` text NOT NULL,
	`templates` text NOT NULL,
	`css` text DEFAULT '' NOT NULL,
	`source_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`note_type_id` text NOT NULL,
	`deck_id` text NOT NULL,
	`fields` text NOT NULL,
	`tags` text NOT NULL,
	`source_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`note_type_id`) REFERENCES `note_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deck_id`) REFERENCES `decks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_notes_deck_id` ON `notes` (`deck_id`);--> statement-breakpoint
CREATE INDEX `ix_notes_note_type_id` ON `notes` (`note_type_id`);--> statement-breakpoint
CREATE TABLE `review_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`rating` integer NOT NULL,
	`state` integer NOT NULL,
	`due` integer NOT NULL,
	`stability` real NOT NULL,
	`difficulty` real NOT NULL,
	`elapsed_days` integer NOT NULL,
	`last_elapsed_days` integer NOT NULL,
	`scheduled_days` integer NOT NULL,
	`review_ms` integer NOT NULL,
	`reviewed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_review_logs_card_id` ON `review_logs` (`card_id`);--> statement-breakpoint
CREATE INDEX `ix_review_logs_reviewed_at` ON `review_logs` (`reviewed_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
