/*
  Warnings:

  - A unique constraint covering the columns `[complaintId]` on the table `Complaint` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Complaint_complaintId_key" ON "Complaint"("complaintId");
