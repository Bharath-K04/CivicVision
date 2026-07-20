// ComplaintApi.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import bodyParser from 'body-parser';
const prisma = new PrismaClient();
const router = express.Router();

router.use(bodyParser.json());

// Generate unique grievance ID
function generateComplaintId(dept) {
  const timestamp = Date.now().toString().slice(-5);
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${dept.slice(0, 3).toUpperCase()}-${timestamp}-${rand}`;
}

// Mock complaint route
router.post('/mock-complaint', async (req, res) => {
  const { department = "General", description = "", location = "", city = "Unknown" } = req.body;

  const complaintId = generateComplaintId(department);

  try {
    // Store in DB
    await prisma.complaint.create({
      data: {
        city,
        department,
        description,
        location,
        complaintId
      }
    });

    console.log(`📥 Complaint saved: ${complaintId}`);

    res.status(200).json({
      status: 'success',
      department,
      complaintId
    });

  } catch (error) {
    console.error("❌ Failed to store complaint:", error);
    res.status(500).json({
      status: 'error',
      message: 'Could not store complaint in database.'
    });
  }
});

export default router;
