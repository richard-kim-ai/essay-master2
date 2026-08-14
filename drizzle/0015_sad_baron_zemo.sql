ALTER TABLE `users` MODIFY COLUMN `role` enum('user','teacher','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `teacherLevel` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` ADD `teacherId` int;