CREATE TABLE `question_bank_trash` (
	`id` int AUTO_INCREMENT NOT NULL,
	`originalQuestionId` int NOT NULL,
	`courseType` enum('elementary','middle_high','high_univ','general_adult') NOT NULL,
	`toolType` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`contentData` text NOT NULL,
	`difficulty` enum('easy','medium','hard') NOT NULL DEFAULT 'medium',
	`isActive` int NOT NULL DEFAULT 1,
	`deletedByUserId` int NOT NULL,
	`deletedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `question_bank_trash_id` PRIMARY KEY(`id`)
);
