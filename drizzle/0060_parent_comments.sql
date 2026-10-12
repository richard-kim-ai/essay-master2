CREATE TABLE `parent_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`parentId` int NOT NULL,
	`parentName` varchar(100),
	`comment` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `parent_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_parent_comments_studentId_createdAt` ON `parent_comments` (`studentId`,`createdAt`);