-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_fromUserId_fkey";

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "fromUserId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
