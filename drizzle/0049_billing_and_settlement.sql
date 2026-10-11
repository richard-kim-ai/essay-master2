CREATE TABLE `payment_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`planKey` varchar(40) NOT NULL,
	`amountKrw` int NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'KRW',
	`status` enum('pending','paid','failed','cancelled','refunded') NOT NULL DEFAULT 'pending',
	`provider` varchar(32) NOT NULL,
	`providerOrderId` varchar(80) NOT NULL,
	`providerPaymentKey` varchar(200),
	`isTest` int NOT NULL DEFAULT 0,
	`failureReason` varchar(255),
	`paidAt` timestamp,
	`refundedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_orders_providerOrderId_unique` UNIQUE(`providerOrderId`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`planKey` varchar(40) NOT NULL,
	`status` enum('active','cancelled','expired') NOT NULL DEFAULT 'active',
	`currentPeriodStart` timestamp NOT NULL,
	`currentPeriodEnd` timestamp NOT NULL,
	`aiEvaluationsLimit` int NOT NULL,
	`orderId` int,
	`cancelledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teacher_settlement_rates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`activityType` varchar(40) NOT NULL,
	`unitAmountKrw` int NOT NULL,
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teacher_settlement_rates_id` PRIMARY KEY(`id`),
	CONSTRAINT `teacher_settlement_rates_activityType_unique` UNIQUE(`activityType`)
);
--> statement-breakpoint
CREATE TABLE `teacher_settlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teacherId` int NOT NULL,
	`periodMonth` varchar(7) NOT NULL,
	`itemsJson` text NOT NULL,
	`grossKrw` int NOT NULL,
	`withholdingPct` varchar(8) NOT NULL,
	`withholdingKrw` int NOT NULL,
	`netKrw` int NOT NULL,
	`status` enum('draft','confirmed','paid') NOT NULL DEFAULT 'draft',
	`note` text,
	`confirmedBy` int,
	`confirmedAt` timestamp,
	`paidBy` int,
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teacher_settlements_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_teacher_settlements_teacher_month` UNIQUE(`teacherId`,`periodMonth`)
);
