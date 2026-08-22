CREATE TABLE `data_processing_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`requestType` enum('access','correction','withdraw_ai_learning','delete_learning_data') NOT NULL,
	`status` enum('received','in_review','completed','rejected') NOT NULL DEFAULT 'received',
	`requestNote` text,
	`handlingNote` text,
	`handledBy` int,
	`handledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `data_processing_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `policy_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`policyKey` varchar(80) NOT NULL,
	`title` varchar(160) NOT NULL,
	`version` varchar(32) NOT NULL,
	`content` text NOT NULL,
	`requiredForRoles` varchar(80) NOT NULL,
	`isRequired` int NOT NULL DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`effectiveAt` timestamp NOT NULL DEFAULT (now()),
	`retiredAt` timestamp,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `policy_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teacher_ai_draft_revisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`draftId` int NOT NULL,
	`revisionNumber` int NOT NULL,
	`editorId` int NOT NULL,
	`revisedComment` text NOT NULL,
	`changeSummary` text,
	`learningApproval` enum('pending','approved','rejected','withdrawn') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `teacher_ai_draft_revisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teacher_ai_drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`essayId` int NOT NULL,
	`teacherId` int NOT NULL,
	`profileVersion` int NOT NULL,
	`modelId` varchar(120) NOT NULL,
	`evaluationJson` text,
	`draftComment` text NOT NULL,
	`status` enum('generated','edited','approved','discarded') NOT NULL DEFAULT 'generated',
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teacher_ai_drafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teacher_ai_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teacherId` int NOT NULL,
	`displayName` varchar(100) NOT NULL,
	`tone` enum('encouraging','balanced','direct') NOT NULL DEFAULT 'balanced',
	`feedbackFocus` varchar(160) NOT NULL DEFAULT '논리·근거·표현의 균형',
	`styleInstruction` text,
	`forbiddenPhrases` text,
	`rubricWeights` text,
	`isEnabled` int NOT NULL DEFAULT 0,
	`currentVersion` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teacher_ai_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `teacher_ai_profiles_teacherId_unique` UNIQUE(`teacherId`)
);
--> statement-breakpoint
CREATE TABLE `teacher_ai_style_examples` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teacherId` int NOT NULL,
	`sourceFeedbackId` int,
	`purpose` enum('style_reference','quality_evaluation','training_candidate') NOT NULL DEFAULT 'style_reference',
	`pseudonymizedPrompt` text NOT NULL,
	`approvedFeedback` text NOT NULL,
	`tags` varchar(255),
	`approvalStatus` enum('draft','teacher_approved','admin_approved','rejected','withdrawn') NOT NULL DEFAULT 'draft',
	`approvedAt` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teacher_ai_style_examples_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_policy_consents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`policyKey` varchar(80) NOT NULL,
	`policyVersion` varchar(32) NOT NULL,
	`consentType` enum('required_service','optional_ai_learning','teacher_ai_style','guardian_authorization') NOT NULL,
	`status` enum('accepted','withdrawn') NOT NULL DEFAULT 'accepted',
	`acceptedAt` timestamp NOT NULL DEFAULT (now()),
	`withdrawnAt` timestamp,
	`evidence` varchar(120) NOT NULL DEFAULT 'signup_confirmation',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_policy_consents_id` PRIMARY KEY(`id`)
);
