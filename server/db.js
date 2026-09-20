import mysql from "mysql2/promise";
import "dotenv/config";
import fs from "node:fs";

const ssl=process.env.DB_SSL==="true"?{
  rejectUnauthorized:true,
  ...(process.env.DB_CA_PATH&&fs.existsSync(process.env.DB_CA_PATH)?{ca:fs.readFileSync(process.env.DB_CA_PATH,"utf8")}:{})
}:undefined;

export const db = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "sakura_motion",
  waitForConnections: true,
  connectionLimit: 10,
  timezone: "+07:00",
  decimalNumbers: true,
  ssl,
});

export async function rows(sql, params = []) {
  const [result] = await db.query(sql, params);
  return result;
}
