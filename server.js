const express = require("express");
const app = express();
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const bcrypt = require("bcrypt"); // 💡 পাসওয়ার্ড সুরক্ষার জন্য
const session = require("express-session"); // 💡 লগইন সেশন মনে রাখার জন্য
const db = require("./config/db");

// ==========================================================================
// ১. মিডলওয়্যার ও সেশন কনফিগারেশন
// ==========================================================================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// সেশন সেটআপ (ইউজার লগইন ট্র্যাকিং)
app.use(
  session({
    secret: "rohan_secret_key_1432", // তোমার প্রজেক্টের সিক্রেট কি
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // ২৪ ঘণ্টা লগইন সেশন একটিভ থাকবে
  }),
);

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const dir = "./uploads";
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

// ==========================================================================
// ২. মাল্টার (Multer) কনফিগারেশন
// ==========================================================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

// ==========================================================================
// ৩. API ROUTE: ইউজার সাইন-আপ (পাসওয়ার্ড হ্যাশিংসহ)
// ==========================================================================
app.post("/api/signup", async (req, res) => {
  const { fullname, email, password } = req.body;

  if (!fullname || !email || !password) {
    return res.status(400).send("All fields are required!");
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql =
      "INSERT INTO users (fullname, email, password) VALUES (?, ?, ?)";
    db.query(sql, [fullname, email, hashedPassword], (err, result) => {
      if (err) {
        console.error("Database Signup Error: ", err);
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(400).send("This email is already registered!");
        }
        return res.status(500).send("Database failure.");
      }
      console.log(
        `User '${fullname}' registered successfully with hashed password!`,
      );
      res.redirect("/login.html");
    });
  } catch (error) {
    res.status(500).send("Server Error during password hashing.");
  }
});

// ==========================================================================
// ৪. API ROUTE: ইউজার লগইন (সেশন ট্র্যাকিং ও পাসওয়ার্ড ম্যাচিং)
// ==========================================================================
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send("Please fill in all fields!");
  }

  const sql = "SELECT * FROM users WHERE email = ?";
  db.query(sql, [email], async (err, results) => {
    if (err) {
      console.error("Database Login Error: ", err);
      return res.status(500).send("Server Error!");
    }

    if (results.length === 0) {
      return res.status(400).send("User not found!");
    }

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      req.session.user = {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
      };
      console.log(`User '${user.fullname}' logged in via secure session.`);
      res.redirect("/index.html");
    } else {
      res.status(400).send("Incorrect Password! Please try again.");
    }
  });
});

// ==========================================================================
// ৫. API ROUTE: প্রোটেক্টেড রুট (লগইন না করে কেউ নোট আপলোড করতে পারবে না)
// ==========================================================================
app.post("/api/notes", upload.single("noteFile"), (req, res) => {
  if (!req.session.user) {
    return res
      .status(401)
      .send("Unauthorized! Please login first to upload notes.");
  }

  const { title, subject, semester, description, payment, price } = req.body;
  const finalPrice = payment === "free" ? 0 : price;
  const filePath = req.file ? `/uploads/${req.file.filename}` : null;

  const sql =
    "INSERT INTO notes (title, subject, semester, description, type, price, file_path) VALUES (?, ?, ?, ?, ?, ?, ?)";
  db.query(
    sql,
    [title, subject, semester, description, payment, finalPrice, filePath],
    (err, result) => {
      if (err) {
        console.error("Database Insert Error: ", err);
        return res.status(500).send("Database Error!");
      }
      console.log("Note uploaded safely under active session.");
      res.redirect("/index.html");
    },
  );
});

// ==========================================================================
// API ROUTE: ডেটাবেস থেকে সব নোট ফ্রন্ট-এন্ডে পাঠানো (হোম পেজের জন্য)
// ==========================================================================
app.get("/api/get-notes", (req, res) => {
  const sql = "SELECT * FROM notes ORDER BY id DESC";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Database Fetch Error: ", err);
      return res.status(500).json({ error: "Could not fetch notes" });
    }
    res.json(results);
  });
});

// ==========================================================================
// API ROUTE: লগইন করা ইউজারের ডাটা ফ্রন্ট-এন্ডে পাঠানো (সেশন চেক)
// ==========================================================================
app.get("/api/current-user", (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// ==========================================================================
// API ROUTE: ইউজার লগআউট (Logout) করা
// ==========================================================================
app.get("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).send("Could not log out.");
    res.redirect("/login.html");
  });
});

// ==========================================================================
// API ROUTE: শুধুমাত্র লগইন করা ইউজারের আপলোড করা নোটগুলো নিয়ে আসা
// ==========================================================================
app.get("/api/my-notes", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Unauthorized! Please login first." });
  }
  const sql = "SELECT * FROM notes ORDER BY id DESC";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Database Fetch Error: ", err);
      return res.status(500).json({ error: "Could not fetch your notes" });
    }
    res.json(results);
  });
});

// ==========================================================================
// API ROUTE: কোনো নোট ডিলিট করা (Delete Route)
// ==========================================================================
app.delete("/api/delete-note/:id", (req, res) => {
  if (!req.session.user) return res.status(401).send("Unauthorized!");
  const noteId = req.params.id;

  const selectSql = "SELECT file_path FROM notes WHERE id = ?";
  db.query(selectSql, [noteId], (err, results) => {
    if (err) return res.status(500).send("Database Error");

    if (results.length > 0 && results[0].file_path) {
      const absolutePath = path.join(__dirname, results[0].file_path);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }

    const deleteSql = "DELETE FROM notes WHERE id = ?";
    db.query(deleteSql, [noteId], (err, result) => {
      if (err)
        return res.status(500).send("Could not delete note from database");
      res.send("Note deleted successfully!");
    });
  });
});

// ==========================================================================
// 💡 ডেমো পেমেন্ট সাকসেসফুল হলে পারচেজ টেবিলে ডেটা সেভ করা
// ==========================================================================
app.post("/api/demo-pay", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Please login first to buy!" });
  }
  const userId = req.session.user.id;
  const { noteId } = req.body;

  const sql = "INSERT INTO purchases (user_id, note_id) VALUES (?, ?)";
  db.query(sql, [userId, noteId], (err, result) => {
    if (err) {
      console.error("Payment Record Error: ", err);
      return res.status(500).json({ error: "Payment failed in database." });
    }
    res.json({ success: true, message: "Demo Payment Successful!" });
  });
});

// ==========================================================================
// 💡 ইউজার এ পর্যন্ত কোন কোন পেইড নোট কিনেছে তার লিস্ট আনা
// ==========================================================================
app.get("/api/my-purchases", (req, res) => {
  if (!req.session.user) return res.json([]);
  const userId = req.session.user.id;
  const sql = "SELECT note_id FROM purchases WHERE user_id = ?";
  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json([]);
    const purchasedIds = results.map((row) => row.note_id);
    res.json(purchasedIds);
  });
});

// ==========================================================================
// ৬. নোড সার্ভার লিসেনিং পোর্ট (ডায়নামিক পোর্ট কনফিগারেশন)
// ==========================================================================
const PORT = process.env.PORT || 3000; // 💡 লাইভ হোস্টিং সার্ভারের জন্য এটা জরুরি
app.listen(PORT, () => {
  console.log(`\n=========================================================`);
  console.log(`🚀 Secure Server running smoothly on Port: ${PORT}`);
  console.log(`=========================================================`);
});
