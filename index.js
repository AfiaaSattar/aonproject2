import "dotenv/config";
import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();
const upload = multer({ dest: "uploads/" });

app.use(express.json());

// ✅ POST /import/customers
app.post("/import/customers", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const validRows = [];
    const invalidRows = [];

    for (const row of rows) {
      const { fullName, email, phone, city, joinedAt } = row;

      // ✅ Validate fields
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

    // ✅ Insert many rows at once
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

// ✅ GET /customers
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

// ✅ Start server
app.listen(3000, () => console.log("Server running on port 3000"));
