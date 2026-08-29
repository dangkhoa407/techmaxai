const mysql = require("mysql2/promise");
require("dotenv").config({ path: ".env.local" });

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "techmax_app",
  });
  const [rows] = await connection.query("SELECT id, fullname, email, level FROM users WHERE email = 'techmax@gmail.com'");
  console.log("Users with email techmax@gmail.com:", rows);
  await connection.end();
}

run().catch(console.error);
