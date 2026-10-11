CREATE TABLE `certificate_archives` (
	`id` int AUTO_INCREMENT NOT NULL,
	`certificateId` int NOT NULL,
	`mimeType` varchar(32) NOT NULL,
	`bytes` int NOT NULL,
	`imageData` mediumtext NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `certificate_archives_id` PRIMARY KEY(`id`),
	CONSTRAINT `certificate_archives_certificateId_unique` UNIQUE(`certificateId`)
);
