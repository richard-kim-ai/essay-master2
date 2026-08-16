CREATE TABLE `parent_student_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parentId` int NOT NULL,
	`studentId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `parent_student_links_id` PRIMARY KEY(`id`)
);
