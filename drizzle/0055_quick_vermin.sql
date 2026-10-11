ALTER TABLE `progress` ADD `courseType` enum('elementary','middle_high','high_univ','general_adult');--> statement-breakpoint
ALTER TABLE `progress` ADD `curriculumSource` enum('static','dynamic');--> statement-breakpoint
ALTER TABLE `progress` ADD `level` int;--> statement-breakpoint
ALTER TABLE `progress` ADD CONSTRAINT `uq_progress_learning_module` UNIQUE(`userId`,`courseType`,`curriculumSource`,`curriculumId`);