CREATE TABLE `writing_evaluation_record` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`essaySubmissionId` int,
	`parentRecordId` int,
	`metadataJson` text NOT NULL,
	`taskJson` text NOT NULL,
	`originalText` text NOT NULL,
	`revisedText` text,
	`evaluationJson` text NOT NULL,
	`correctionJson` text,
	`decision` varchar(32) NOT NULL,
	`totalScore` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `writing_evaluation_record_id` PRIMARY KEY(`id`)
);
