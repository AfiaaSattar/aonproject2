import "dotenv/config";
import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const PORT = process.env.PORT || 3000;
const app = express();
const prisma = new PrismaClient();

// Use multer with memory storage to avoid disk writes (important for serverless environments)
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Server is live..." });
});

// POST /import/customers
app.post("/import/customers", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Read workbook from the uploaded file buffer
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const validRows = [];
    const invalidRows = [];

    for (const row of rows) {
      const { fullName, email, phone, city, joinedAt } = row;

      // Validate required fields
      if (!fullName || !email || !phone || !city || !joinedAt) {
        invalidRows.push(row);
        continue;
      }

      validRows.push({
        fullName,
        email,
        phone,
        city,
        joinedAt: new Date(joinedAt),
      });
    }

    // Insert valid rows, skip duplicates
    await prisma.customer.createMany({
      data: validRows,
      skipDuplicates: true,
    });

    res.json({
      message: "Import completed",
      imported: validRows.length,
      skipped: invalidRows.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to import customers" });
  }
});

// GET /customers
app.get("/customers", async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { id: "desc" },
    });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: "Unable to fetch customers" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
