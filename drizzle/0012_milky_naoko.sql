ALTER TABLE `ai_auto_feedback` MODIFY COLUMN `courseType` enum('elementary','middle_high','high_univ','general_adult') NOT NULL;--> statement-breakpoint
ALTER TABLE `certificate` MODIFY COLUMN `courseType` enum('elementary','middle_high','high_univ','general_adult') NOT NULL;--> statement-breakpoint
ALTER TABLE `curriculum` MODIFY COLUMN `courseType` enum('elementary','middle_high','high_univ','general_adult') NOT NULL;--> statement-breakpoint
ALTER TABLE `dynamic_curriculum` MODIFY COLUMN `courseType` enum('elementary','middle_high','high_univ','general_adult') NOT NULL;--> statement-breakpoint
ALTER TABLE `dynamic_curriculum` ADD `thumbnailUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `dynamic_curriculum` ADD `aiSummary` text;