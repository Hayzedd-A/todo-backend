require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const bodyParser = require("body-parser");
const cors = require("cors");
const uniqid = require("uniqid");
const { hashPassword, verifyPassword } = require("secure-password-hash");
const app = express();
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

let port = process.env.PORT;
async function connectDB() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      port: process.env.DB_PORT,
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
      "CREATE TABLE IF NOT EXISTS todo (sn INT AUTO_INCREMENT UNIQUE, id VARCHAR(30) PRIMARY KEY, title VARCHAR(255) NOT NULL, body TEXT NOT NULL, completed BOOLEAN, dueDate TIMESTAMP, createdDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP, userID VARCHAR(30), FOREIGN KEY (userID) REFERENCES users(id))"
    )
    .then(([result]) => {
      //   console.log(result);
      console.log("Todo Table created or already exist");
    })
    .catch((err) => {
      console.log(err);
    });
};

const createUserTable = async () => {
  let connection = await connectDB();
  connection
    .execute(
      "CREATE TABLE IF NOT EXISTS users (sn INT AUTO_INCREMENT UNIQUE, id VARCHAR(30) PRIMARY KEY, seasionID VARCHAR(30), username VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL, password VARCHAR(255) NOT NULL, password_salt VARCHAR(255) NOT NULL)"
    )
    .then(([result]) => {
      //   console.log(result);first
      console.log("User Table created or already exist");
    })
    .catch((err) => {
      console.log(err);
    });
};
createUserTable();
createTable();

const insertIntoTable = async (title, body, dueDate, userID) => {
  let connection = await connectDB();
  let id = uniqid.time();
  let query = `INSERT INTO todo (id, userID, title, body, dueDate) VALUES (?, ?, ?, ?, ? )`;
  let params = [id, userID, title, body, dueDate];
  return connection
    .execute(query, params)
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

app.post("/todo/:id", async (req, res) => {
  let { title, body, dueDate } = req.body;
  let userID = req.params.id;
  if (!(title && body && dueDate)) {
    res.status(400).json({
      status: false,
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
  let result = await insertIntoTable(title, body, dueDate, userID);
  if (!result) {
    res.status(400).json({
      status: false,
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

// app.get("/todo/:id", async (req, res) => {
//   let query = `SELECT * FROM todo WHERE userID = '${req.params.id}'`;
//   console.log(query);
//   let connection = await connectDB();
//   connection
//     .execute(query)
//     .then(([result]) => {
//       connection.end();
//       res.status(200).json({
//         status: true,
//         data: result,
//       });
//     })
//     .catch((err) => {
//       console.log(err);
//     });
// });

app.get("/todo/:userID", async (req, res) => {
  console.log("homepage requested");
  let { userID } = req.params;
  let query = `SELECT * FROM todo WHERE userID = '${userID}'`;
  if (req.query.q) {
    console.log("its a search operation", req.query.q);
    query = `SELECT * FROM todo WHERE userID = ${userID} and title LIKE '%${req.query.q}%' OR body LIKE '%${req.query.q}%'`;
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

app.patch("/todo/edit/:taskID", async (req, res) => {
  console.log(req.body);
  let { title, body, completed, dueDate } = req.body;
  if (!(title && body && dueDate)) {
    res.status(400).json({
      status: false,
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
  let query = `UPDATE todo SET title = ?, body = ?, dueDate = ?, completed = ? WHERE id = ?`;
  let params = [title, body, dueDate, completed, req.params.taskID];
  let connection = await connectDB();
  connection
    .execute(query, params)
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

app.delete("/todo/:id", async (req, res) => {
  let query = `DELETE FROM todo WHERE id = '${req.params.id}'`;
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

// endpoint for user signin
app.post("/signin", async (req, res) => {
  let { username, password } = req.body;
  if (!(username && password)) {
    res.status(400).json({
      status: false,
      message: "Username and password are required",
    });
    return;
  }
  let hashedPassword = hashPassword;
  let query = `SELECT * FROM users WHERE username = '${username}' `;
  let connection = await connectDB();
  connection
    .execute(query)
    .then(([result]) => {
      connection.end();
      console.log(result);
      if (result.length) {
        let passwordMatch = verifyPassword(
          password,
          result[0].password,
          result[0].password_salt
        );
        if (passwordMatch) {
          let data = {
            id: result[0].id,
            username: result[0].username,
            seasionID: result[0].seasionID,
          };
          res.status(200).json({
            status: true,
            data: data,
          });
        } else {
          res.status(401).json({
            status: false,
            message: "Invalid username or password",
          });
        }
      } else {
        res.status(401).json({
          status: false,
          message: "Invalid username or password",
        });
      }
    })
    .catch((err) => {
      console.log(err);
    });
});

// endpoint for user signup
app.post("/signup", async (req, res) => {
  console.log(req.body);
  let { username, email, password } = req.body;
  if (!(username && email && password)) {
    res.status(400).json({
      status: false,
      message: "email, Username  and password are required",
    });
    return;
  }
  let query = `SELECT * FROM users WHERE username = '${username}' OR email = '${email}'`;
  let connection = await connectDB();
  connection.execute(query).then(async ([result]) => {
    connection.end();
    if (result.length) {
      res.status(400).json({
        status: false,
        message: "Username or email already exist",
      });
      return;
    } else {
      let id = uniqid.time();
      let seasionID = uniqid("", `-${id}`);
      let { hash: hashed, salt: salted } = hashPassword(password);

      query = `INSERT INTO users (id, username, email, password, seasionID, password_salt) VALUES (?,?,?,?,?,?)`;
      let params = [id, username, email, hashed, seasionID, salted];
      connection = await connectDB();
      connection
        .execute(query, params)
        .then(([result]) => {
          // connection.execute
          connection.end();
          res.status(201).json({
            status: true,
            data: {
              id: id,
              username: username,
              seasionID: seasionID,
            },
          });
        })
        .catch((err) => {
          console.log(err);
          res.status(400).json({
            status: false,
            message: "Error occured saving the user",
          });
        });
    }
  });
});
