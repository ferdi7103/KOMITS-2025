import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { Resend } from 'resend';

dotenv.config();

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Initialize Firebase Admin (uses environment variables automatically if set up)
// In AI Studio, we can initialize with default app if credentials are in env or we can skip for now
// and use the client SDK fetch patterns if we prefer. But admin is cleaner.
if (!admin.apps.length) {
  try {
    admin.initializeApp();
  } catch (error) {
    console.warn("Firebase Admin failed to initialize. Check service account env vars.");
  }
}

const db = admin.apps.length ? admin.firestore() : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const sendWA = async (phone: string, message: string) => {
    const apiKey = process.env.WHATSAPP_API_KEY;
    if (!apiKey) {
      console.log(`[WA MOCK to ${phone}]: ${message}`);
      return;
    }

    try {
      // Example using Fonnte (popular in ID) - Adjust for your provider
      await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { 'Authorization': apiKey },
        body: new URLSearchParams({
          target: phone,
          message: message,
          countryCode: '62' // default for ID
        })
      });
    } catch (error) {
      console.error("WA Send Error:", error);
    }
  };

  // API Route to sync to Google Sheet
  app.post("/api/sync-order", async (req, res) => {
    /* ... existing code ... */
    const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
    
    if (!webhookUrl) {
      console.warn("GOOGLE_SHEET_WEBHOOK_URL is not set. Skipping sheet sync.");
      return res.status(200).json({ status: "skipped", reason: "no_webhook" });
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body),
      });

      if (!response.ok) {
        throw new Error(`Failed to sync to Google Sheets: ${response.statusText}`);
      }

      res.json({ status: "success" });
    } catch (error) {
      console.error("Error syncing to Google Sheets:", error);
      res.status(500).json({ error: "Failed to sync to Google Sheets" });
    }
  });

  // API Route for WA Status Update
  app.post("/api/notify-status", async (req, res) => {
    const { phone, name, status, orderId } = req.body;
    if (!phone || !status) return res.status(400).json({ error: "Missing phone or status" });

    const message = `Halo ${name || 'Pelanggan'}!\n\nStatus pesanan KOMITS 2025 Anda (ID: ${orderId || 'N/A'}) telah diperbarui menjadi: *${status.toUpperCase()}*.\n\nTerima kasih atas pesanan Anda!`;
    
    await sendWA(phone, message);
    res.json({ status: "success" });
  });

  // API Route for Email Confirmation
  app.post("/api/send-confirmation", async (req, res) => {
    const { email, name, orderDetails, orderId } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!resend) {
      console.warn("RESEND_API_KEY is not set. Mocking email send.");
      console.log(`[Email MOCK to ${email}]: Order confirmation for ${name}`);
      return res.json({ status: "skipped", reason: "no_api_key" });
    }

    try {
      const shareUrl = process.env.VITE_APP_URL || "https://ais-pre-o6pnumq2cgch7bp54qy3wz-214655520165.asia-east1.run.app";
      const { data, error } = await resend.emails.send({
        from: 'KOMITS 2025 <onboarding@resend.dev>', // Use verified domain in production
        to: [email],
        subject: `Konfirmasi Pesanan KOMITS 2025 - ID: ${orderId}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #2563eb;">Halo, ${name}!</h2>
            <p>Terima kasih telah memesan merchandise resmi <strong>KOMITS 2025</strong>.</p>
            <p>Pesanan Anda telah kami terima dengan ID: <strong>${orderId}</strong>.</p>
            
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; font-size: 16px;">Detail Pesanan:</h3>
              <p style="margin: 5px 0;">Produk: ${orderDetails.productName}</p>
              <p style="margin: 5px 0;">Ukuran: ${orderDetails.size}</p>
              <p style="margin: 5px 0;">Warna: ${orderDetails.color}</p>
              <p style="margin: 5px 0;">Jumlah: ${orderDetails.quantity} pcs</p>
              <p style="margin: 5px 0;">Total: Rp ${orderDetails.totalAmount.toLocaleString()}</p>
            </div>

            <p>Anda dapat memantau status pesanan Anda melalui link berikut:</p>
            <a href="${shareUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Cek Status Pesanan</a>
            
            <p style="margin-top: 30px; font-size: 12px; color: #666;">Jika Anda tidak merasa melakukan pesanan ini, silakan abaikan email ini.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999; text-align: center;">&copy; 2025 KOMITS - Kepedulian OTM ITS</p>
          </div>
        `,
      });

      if (error) {
        throw error;
      }

      res.json({ status: "success", data });
    } catch (error) {
      console.error("Email Send Error:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // API Route for Public Status Check by Phone
  app.get("/api/order-status/:phone", async (req, res) => {
    const { phone } = req.params;
    if (!phone || !db) return res.status(400).json({ error: "Missing phone" });

    try {
      const snapshot = await db.collection("orders")
        .where("phone", "==", phone)
        .orderBy("createdAt", "desc")
        .limit(5)
        .get();

      if (snapshot.empty) {
        return res.json({ orders: [] });
      }

      const orders = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id.slice(-6).toUpperCase(),
          name: data.name.split(' ')[0] + '***', // Masking name for privacy
          status: data.status,
          productName: data.productName || "Kaos KOMITS 2025",
          size: data.size,
          color: data.color,
          quantity: data.quantity,
          createdAt: data.createdAt?.toDate().toISOString() || null
        };
      });

      res.json({ orders });
    } catch (error) {
      console.error("Status check error:", error);
      res.status(500).json({ error: "Failed to check status" });
    }
  });

  // Background Task: Payment Reminder (Every 24 hours)
  const runReminders = async () => {
    if (!db) return;
    console.log("Checking for payment reminders...");
    try {
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      const snapshot = await db.collection("orders")
        .where("status", "==", "pending")
        .where("paymentProofUrl", "==", "")
        .where("createdAt", "<=", admin.firestore.Timestamp.fromDate(yesterday))
        .get();

      for (const doc of snapshot.docs) {
        const order = doc.data();
        const message = `PENGINGAT PEMBAYARAN: Halo ${order.name}, pesanan Anda (ID: ${doc.id.slice(-6).toUpperCase()}) sudah 24 jam belum selesai pembayarannya. Silakan segera upload bukti transfer ya. Terima kasih!`;
        await sendWA(order.phone, message);
        console.log(`Reminder sent to ${order.phone}`);
      }
    } catch (error) {
      console.error("Reminder job error:", error);
    }
  };

  // Run every 4 hours to check for 24h gaps
  setInterval(runReminders, 1000 * 60 * 60 * 4);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
