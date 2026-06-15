const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "btlv8zm3hhf6kqhebt5m-mysql.services.clever-cloud.com",
  user: "ujr5bwaq2td6trpo",
  password: "QE4Z0Hk730z0v6Z1Y5a4",
  database: "btlv8zm3hhf6kqhebt5m",
  port: 3306,
});

db.connect((err) => {
  if (err) {
    console.error("❌ Online Database Connection Failed: ", err.message);
    return;
  }
  console.log(
    "✅ Successfully connected to Online MySQL Database on Clever Cloud!",
  );
});

module.exports = db;
