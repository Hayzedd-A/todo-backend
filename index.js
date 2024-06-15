require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const uniqid = require("uniqid");
const app = express();
app.use(express.json());

let port = process.env.PORT;
async function connectDB() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    console.log("connected to database successfully");
    return connection;
  } catch (err) {
    console.log("there is error connecting to the database: ", err);
    throw err;
  }
}

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});

const createTable = async () => {
  let connection = await connectDB();
  connection
    .execute(
      "CREATE TABLE IF NOT EXISTS todo (id VARCHAR(30) PRIMARY KEY, title VARCHAR(255) NOT NULL, body TEXT NOT NULL, completed BOOLEAN, dueDate TIMESTAMP, createdDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
    )
    .then(([result]) => {
      //   console.log(result);
      console.log("Table created or already exist");
    })
    .catch((err) => {
      console.log(err);
    });
};
createTable();

const insertIntoTable = async (title, body, dueDate) => {
  let connection = await connectDB();
  let id = uniqid.time();
  let query = `INSERT INTO todo (id, title, body, dueDate) VALUES ('${id}', '${title}', '${body}', '${dueDate}' )`;
  return connection
    .execute(query)
    .then((result) => {
      connection.end();
      return result;
    })
    .catch((err) => {
      if (err) {
        console.log("error occured", err);
      }
    });
};
// insertIntoTable("title", "body", "2024-09-10 00:00:00");

app.post("/todo", async (req, res) => {
  let { title, body, dueDate } = req.body;
  if (!(title && body && dueDate)) {
    res.status(400).send({
      message: "Title, description and dueDate are required",
    });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    res.status(400).json({
      status: false,
      message: "Date is not in the right format",
    });
    return;
  }
  dueDate = dueDate + " 00:00:00";
  let result = await insertIntoTable(title, body, dueDate);
  if (!result) {
    res.status(400).send({
      message: "Error occured saving the task",
    });
    return;
  }
  res.status(201).json({
    status: true,
    message: "Added successfully",
    data: result.insertId,
  });
});

app.get("/todo", async (req, res) => {
  let query = "SELECT * FROM todo";
  if (req.query.q) {
    console.log("its a search operation", req.query.q);
    query = `SELECT * FROM todo WHERE title LIKE '%${req.query.q}%' OR body LIKE '%${req.query.q}%'`;
  }
  let connection = await connectDB();
  connection
    .execute(query)
    .then(([result]) => {
      connection.end();
      res.status(200).json({
        status: true,
        data: result,
      });
    })
    .catch((err) => {
      console.log(err);
    });
});

app.patch("/todo/:id/edit", async (req, res) => {
  let { title, body, completed, dueDate } = req.body;
  if (!(title && body && dueDate && completed)) {
    res.status(400).send({
      message: "Title, description and dueDate are required",
    });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    res.status(400).json({
      status: false,
      message: "Date is not in the right format",
    });
    return;
  }
  dueDate = dueDate + " 00:00:00";
  let query = `UPDATE todo SET title = '${title}', body = '${body}', dueDate = '${dueDate}', completed = '${completed}' WHERE id = '${req.params.id}'`;
  let connection = await connectDB();
  connection
    .execute(query)
    .then(([result]) => {
      connection.end();
      res.status(200).json({
        status: true,
        data: result.affectedRows,
      });
    })
    .catch((err) => {
      console.log(err);
    });
});
