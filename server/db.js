// db.js
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const uri = process.env.MONGO_URI;
let client;
let db;

const connectDB = async () => {
  if (db) return db; // reuse existing connection
  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });
  await client.connect();
  console.log("✅ MongoDB connected");
  db = client.db("AnnotationsDB"); // your database name
  return db;
};

module.exports = { connectDB, client };
