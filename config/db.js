const mysql = require("mysql2");

const connection = mysql.createConnection({
  host: "localhost",
  user: "newuser", // 👈 'root' বদলে 'newuser' করে দেওয়া হলো
  password: "1234", // আপনার নতুন ইউজারের পাসওয়ার্ড
  database: "online_notes_system",
});

connection.connect((err) => {
  if (err) {
    console.log("Database connection failed: ", err);
  } else {
    console.log("Database Connected Successfully!");
  }
});

module.exports = connection;
