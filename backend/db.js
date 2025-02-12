const mysql = require("mysql2");
const dotenv = require("dotenv");
dotenv.config();

const maxRetries = 5;
let attempt = 0;

const pool = mysql.createPool({
  host: process.env.DB_HOST || "db",
  user: process.env.DB_USER || "user",
  password: process.env.DB_PASS || "password",
  database: process.env.DB_NAME || "blog",
  connectionLimit: 10,
});

const getConnection = () => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        reject(err);
      } else {
        resolve(connection);
      }
    });
  });
};

const connectWithRetry = () => {
  getConnection()
    .then((connection) => {
      console.log("Connected to MySQL");
      connection.release();
    })
    .catch((err) => {
      console.log("Database connection failed, retrying...", err);
      if (attempt < maxRetries) {
        attempt++;
        setTimeout(connectWithRetry, 5000);
      } else {
        console.error("Database connection failed after several attempts.");
        process.exit(1);
      }
    });
};

connectWithRetry();
module.exports = pool;
