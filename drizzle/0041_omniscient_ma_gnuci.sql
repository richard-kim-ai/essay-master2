CREATE TABLE `lesson_theory_content` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contentScope` enum('THEORY_LESSON') NOT NULL DEFAULT 'THEORY_LESSON',
	`courseType` enum('elementary','middle_high','high_univ','general_adult') NOT NULL,
	`lessonLevel` int NOT NULL,
	`theoryCategory` varchar(32) NOT NULL,
	`theorySubcategory` varchar(128) NOT NULL,
	`exampleMode` enum('TEXTBOOK_SIMILAR','TEXTBOOK_PLUS_NEW') NOT NULL DEFAULT 'TEXTBOOK_PLUS_NEW',
	`title` varchar(255) NOT NULL,
	`contentData` text NOT NULL,
	`sourceNote` varchar(255) DEFAULT '논술의 기초 정리본 기반 재구성',
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lesson_theory_content_id` PRIMARY KEY(`id`)
);
