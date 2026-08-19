CREATE TABLE `evaluation_model_configs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `modelId` varchar(160) NOT NULL,
  `endpoint` varchar(1024) NOT NULL,
  `allowedDomainsJson` text NOT NULL,
  `encryptedApiKey` text NOT NULL,
  `timeoutMs` int NOT NULL DEFAULT 15000,
  `isActive` int NOT NULL DEFAULT 1,
  `createdBy` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `evaluation_model_configs_id` PRIMARY KEY(`id`)
);

CREATE TABLE `writing_evaluation_records` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `feedbackId` int,
  `modelId` varchar(160) NOT NULL,
  `correctionStatus` enum('completed','fallback','failed') NOT NULL,
  `fallbackUsed` int NOT NULL DEFAULT 0,
  `providerError` varchar(512),
  `latencyMs` int NOT NULL DEFAULT 0,
  `tokenUsage` int NOT NULL DEFAULT 0,
  `estimatedCostMicrousd` int NOT NULL DEFAULT 0,
  `confidence` decimal(5,4),
  `heuristicOverallScore` int,
  `modelOverallScore` int,
  `sourceVerificationFailed` int NOT NULL DEFAULT 0,
  `resultJson` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `writing_evaluation_records_id` PRIMARY KEY(`id`)
);

CREATE TABLE `evaluation_model_operations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `modelId` varchar(160) NOT NULL,
  `status` enum('completed','fallback','failed') NOT NULL,
  `latencyMs` int NOT NULL DEFAULT 0,
  `tokenUsage` int NOT NULL DEFAULT 0,
  `estimatedCostMicrousd` int NOT NULL DEFAULT 0,
  `errorSummary` varchar(512),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `evaluation_model_operations_id` PRIMARY KEY(`id`)
);

CREATE TABLE `evaluation_review_queue` (
  `id` int AUTO_INCREMENT NOT NULL,
  `evaluationRecordId` int NOT NULL,
  `userId` int NOT NULL,
  `reasonsJson` text NOT NULL,
  `status` enum('open','reviewing','resolved') NOT NULL DEFAULT 'open',
  `assignedAdminId` int,
  `resolutionNote` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolvedAt` timestamp,
  CONSTRAINT `evaluation_review_queue_id` PRIMARY KEY(`id`)
);

CREATE TABLE `evaluation_appeals` (
  `id` int AUTO_INCREMENT NOT NULL,
  `evaluationRecordId` int NOT NULL,
  `userId` int NOT NULL,
  `reason` text NOT NULL,
  `requestedAction` varchar(64) NOT NULL,
  `status` enum('submitted','under_review','accepted','rejected','resolved') NOT NULL DEFAULT 'submitted',
  `adminId` int,
  `adminNote` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `evaluation_appeals_id` PRIMARY KEY(`id`)
);
