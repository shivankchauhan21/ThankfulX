/*
  Warnings:

  - Made the column `products` on table `messages` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "_OrganizationToUser" ADD CONSTRAINT "_OrganizationToUser_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_OrganizationToUser_AB_unique";

-- AlterTable
ALTER TABLE "messages" ALTER COLUMN "products" SET NOT NULL;
