CREATE TABLE `learning_tool_mistakes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`questionBankId` int NOT NULL,
	`courseType` varchar(50) NOT NULL,
	`toolType` varchar(64) NOT NULL,
	`userAnswer` text NOT NULL,
	`score` int NOT NULL,
	`aiFeedback` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `learning_tool_mistakes_id` PRIMARY KEY(`id`)
);
