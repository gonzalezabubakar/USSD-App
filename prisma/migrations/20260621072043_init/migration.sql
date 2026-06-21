-- CreateTable
CREATE TABLE `Farmer` (
    `farmer_id` INTEGER NOT NULL AUTO_INCREMENT,
    `full_name` VARCHAR(191) NOT NULL,
    `phone_number` VARCHAR(191) NOT NULL,
    `region` VARCHAR(191) NULL,
    `district` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Farmer_phone_number_key`(`phone_number`),
    PRIMARY KEY (`farmer_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Crop` (
    `crop_id` INTEGER NOT NULL AUTO_INCREMENT,
    `crop_name` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`crop_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Farm` (
    `farm_id` INTEGER NOT NULL AUTO_INCREMENT,
    `farmer_id` INTEGER NOT NULL,
    `crop_id` INTEGER NOT NULL,
    `farm_size` DOUBLE NULL,

    PRIMARY KEY (`farm_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExpertRule` (
    `rule_id` INTEGER NOT NULL AUTO_INCREMENT,
    `symptom_keyword` VARCHAR(191) NOT NULL,
    `diagnosis` VARCHAR(191) NOT NULL,
    `recommendation` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`rule_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdvisoryLog` (
    `log_id` INTEGER NOT NULL AUTO_INCREMENT,
    `farm_id` INTEGER NOT NULL,
    `reported_symptom` VARCHAR(191) NOT NULL,
    `diagnosis` VARCHAR(191) NOT NULL,
    `recommendation` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`log_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Farm` ADD CONSTRAINT `Farm_farmer_id_fkey` FOREIGN KEY (`farmer_id`) REFERENCES `Farmer`(`farmer_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Farm` ADD CONSTRAINT `Farm_crop_id_fkey` FOREIGN KEY (`crop_id`) REFERENCES `Crop`(`crop_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdvisoryLog` ADD CONSTRAINT `AdvisoryLog_farm_id_fkey` FOREIGN KEY (`farm_id`) REFERENCES `Farm`(`farm_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
