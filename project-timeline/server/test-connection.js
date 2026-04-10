const { Client } = require("pg");

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/project_timeline";

console.log(
  "Testing connection to:",
  connectionString.replace(/:[^:]*@/, ":****@"),
);

const client = new Client({
  connectionString: connectionString,
});

client.connect((err) => {
  if (err) {
    console.error("Connection error:", err.message);
    process.exit(1);
  } else {
    console.log("✓ Connected successfully!");
    client.query("SELECT 1", (err, res) => {
      if (err) {
        console.error("Query error:", err);
      } else {
        console.log("✓ Query result:", res.rows);
      }
      client.end();
      process.exit(0);
    });
  }
});
