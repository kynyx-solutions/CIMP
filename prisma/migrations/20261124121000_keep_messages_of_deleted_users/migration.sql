-- Removing an office user no longer deletes the messages they sent: the sender link is cleared
-- and the stored sender name keeps the conversation readable.
ALTER TABLE "Message" DROP CONSTRAINT "Message_senderId_fkey";
ALTER TABLE "Message" ALTER COLUMN "senderId" DROP NOT NULL;
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_senderId_fkey";
ALTER TABLE "ChatMessage" ALTER COLUMN "senderId" DROP NOT NULL;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
