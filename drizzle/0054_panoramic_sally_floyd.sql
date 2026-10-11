ALTER TABLE `essay_submission` ADD `clientId` varchar(80);--> statement-breakpoint
ALTER TABLE `essay_submission` ADD `syncRevision` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `essay_submission` ADD `aiFeedbackId` int;--> statement-breakpoint
ALTER TABLE `essay_submission` ADD CONSTRAINT `essay_submission_clientId_unique` UNIQUE(`clientId`);