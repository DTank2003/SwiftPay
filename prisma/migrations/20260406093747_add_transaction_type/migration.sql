-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('P2P', 'TOP_UP');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "type" "TransactionType" NOT NULL DEFAULT 'P2P';
