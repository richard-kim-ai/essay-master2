CREATE TABLE `app_secret_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(128) NOT NULL,
	`encryptedValue` text,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_secret_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_secret_config_settingKey_unique` UNIQUE(`settingKey`)
);
