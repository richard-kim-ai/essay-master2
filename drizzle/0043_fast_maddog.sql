CREATE TABLE `sentence_feedback_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`quizId` int NOT NULL,
	`courseType` enum('elementary','middle_high','high_univ','general_adult') NOT NULL,
	`requestHash` varchar(64) NOT NULL,
	`sourceSentence` text NOT NULL,
	`studentSentence` text NOT NULL,
	`feedbackJson` text NOT NULL,
	`modelId` varchar(128),
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sentence_feedback_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `sentence_feedback_cache_requestHash_unique` UNIQUE(`requestHash`)
);
