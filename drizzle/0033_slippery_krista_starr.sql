CREATE TABLE `learning_group_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`studentId` int NOT NULL,
	`addedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `learning_group_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `learning_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`groupType` enum('class','group') NOT NULL DEFAULT 'class',
	`courseType` enum('elementary','middle_high','high_univ','general_adult'),
	`description` text,
	`teacherId` int,
	`isActive` int NOT NULL DEFAULT 1,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `learning_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `preferredTeacherId` int;