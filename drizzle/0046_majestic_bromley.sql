CREATE TABLE `sample_ai_usage_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionToken` varchar(64) NOT NULL,
	`ipHash` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sample_ai_usage_log_id` PRIMARY KEY(`id`)
);
