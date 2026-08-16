ALTER TABLE `question_feedbacks` ADD `adminReply` text;--> statement-breakpoint
ALTER TABLE `question_feedbacks` ADD `status` varchar(30) DEFAULT 'pending' NOT NULL;