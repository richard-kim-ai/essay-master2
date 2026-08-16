CREATE TABLE `question_bank` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseType` enum('elementary','middle_high','high_univ','general_adult') NOT NULL,
	`toolType` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`contentData` text NOT NULL,
	`difficulty` enum('easy','medium','hard') NOT NULL DEFAULT 'medium',
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `question_bank_id` PRIMARY KEY(`id`)
);
