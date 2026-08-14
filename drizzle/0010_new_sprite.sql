CREATE TABLE `dynamic_curriculum` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseType` enum('elementary','middle_high') NOT NULL,
	`level` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`topicsJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dynamic_curriculum_id` PRIMARY KEY(`id`)
);
