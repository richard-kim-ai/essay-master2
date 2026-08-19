CREATE TABLE `workbook_lesson_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseType` enum('elementary','middle_high','high_univ','general_adult') NOT NULL,
	`lessonLevel` int NOT NULL,
	`lessonIndex` int NOT NULL,
	`connectionMode` enum('automatic','manual') NOT NULL DEFAULT 'automatic',
	`theoryContentIdsJson` text NOT NULL,
	`workbookQuestionIdsJson` text NOT NULL,
	`updatedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workbook_lesson_connections_id` PRIMARY KEY(`id`)
);
