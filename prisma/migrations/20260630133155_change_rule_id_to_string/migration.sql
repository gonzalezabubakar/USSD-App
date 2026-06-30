/*
  Warnings:

  - The primary key for the `expertrule` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE `expertrule` DROP PRIMARY KEY,
    MODIFY `rule_id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`rule_id`);

-- CreateIndex
CREATE INDEX `ExpertRule_crop_name_idx` ON `ExpertRule`(`crop_name`);
