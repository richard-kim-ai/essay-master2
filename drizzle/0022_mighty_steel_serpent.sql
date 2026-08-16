CREATE TABLE `question_feedbacks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`questionId` int NOT NULL,
	`isHelpful` int NOT NULL,
	`reportType` varchar(50),
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `question_feedbacks_id` PRIMARY KEY(`id`)
);
