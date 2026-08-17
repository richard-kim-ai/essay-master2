CREATE TABLE `curriculum_workbook_answers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`questionId` int NOT NULL,
	`userAnswer` text NOT NULL,
	`isCorrect` int NOT NULL DEFAULT 0,
	`aiFeedback` text,
	`score` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `curriculum_workbook_answers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `curriculum_workbook_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseType` varchar(50) NOT NULL,
	`level` int NOT NULL,
	`lessonIndex` int NOT NULL,
	`questionNumber` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`prompt` text NOT NULL,
	`choicesJson` text,
	`correctAnswer` varchar(255) NOT NULL,
	`explanation` text NOT NULL,
	`questionType` varchar(50) NOT NULL DEFAULT 'subjective',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `curriculum_workbook_questions_id` PRIMARY KEY(`id`)
);
