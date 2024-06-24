require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const uniqid = require("uniqid");
const { hashPassword, verifyPassword } = require("secure-password-hash");
const app = express();
app.use(express.json());
app.use(cors());

let port = process.env.PORT;

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const nameRegex = /^[a-zA-Z ]+$/;
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
  }
}

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});

const createTodoTable = async () => {
  try {
    let query =
      "CREATE TABLE IF NOT EXISTS todo (sn INT AUTO_INCREMENT UNIQUE, id VARCHAR(30) PRIMARY KEY, title VARCHAR(255) NOT NULL, body TEXT NOT NULL, completed BOOLEAN, dueDate TIMESTAMP, createdDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP, userID VARCHAR(30), FOREIGN KEY (userID) REFERENCES users(id))";
    let connection = await connectDB();
    let [result] = await connection.execute(query);
    connection.end();
    if (!result) throw new Error("There was an error creating the table");
    console.log("Todo Table created or already exist");
    return result;
  } catch (error) {
    console.log(error);
    return error;
  }
};

const createUserTable = async () => {
  try {
    let query =
      "CREATE TABLE IF NOT EXISTS users (sn INT AUTO_INCREMENT UNIQUE, id VARCHAR(30) PRIMARY KEY, seasionID VARCHAR(30), username VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL, password VARCHAR(255) NOT NULL, password_salt VARCHAR(255) NOT NULL)";
    let connection = await connectDB();
    let [result] = await connection.execute(query);
    if (!result) throw new Error("There was an error creating the table");
    console.log("User Table created or already exist");
  } catch (error) {
    console.log(err);
  }
};

createUserTable();
createTodoTable();

const insertIntoTodoTable = async (title, body, dueDate, userID) => {
  try {
    let connection = await connectDB();
    let id = uniqid.time();
    let query = `INSERT INTO todo (id, userID, title, body, dueDate) VALUES (?, ?, ?, ?, ? )`;
    let params = [id, userID, title, body, dueDate];
    let [result] = await connection.execute(query, params);
    connection.end();
    if (!result) throw new Error("There was error saving your post");
    if (result) return result;
  } catch (error) {
    return error;
  }
};

// endpoint to get all user's post
app.get("/todo/:userID", async (req, res) => {
  try {
    console.log("all post requested");
    let { userID } = req.params;
    let query = `SELECT * FROM todo WHERE userID = '${userID}'`;
    if (req.query.q) {
      let search = req.query.q;
      query = `SELECT * FROM todo WHERE userID = ${userID} and title LIKE '%${search}%' OR body LIKE '%${search}%'`;
    }
    let connection = await connectDB();
    let [result] = await connection.execute(query);
    connection.end();
    if (!result) throw new Error("There was error deleting the post");
    console.log(result);
    res.status(200).json({
      status: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      status: false,
      message: error.message,
    });
  }
});

// endpoint to save new post
app.post("/todo/:userID", async (req, res) => {
  let { title, body, dueDate } = req.body;
  let { userID } = req.params;
  try {
    if (!(title && body && dueDate)) throw new Error("All fields are required");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate))
      throw new Error("Date format is wrong");
    // dueDate = dueDate + " 00:00:00";s
    let result = await insertIntoTodoTable(title, body, dueDate, userID);
    if (!result) throw new Error("Error occured saving the task");
    res.status(201).json({
      status: true,
      message: "Added successfully",
      data: result.insertId,
    });
  } catch (error) {
    res.status(400).json({
      status: false,
      message: error.message,
    });
  }
});

// end point to update an existing post
app.patch("/todo/edit/:taskID", async (req, res) => {
  try {
    console.log(req.body);
    let { title, body, dueDate, completed } = req.body;
    // console.log(dueDate);
    if (!(title && body && dueDate))
      throw new Error("Title, description and due Date are required");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate))
      throw new Error("Date is not in the right format");
    // dueDate = dueDate + " 00:00:00";
    let query = `UPDATE todo SET title = ?, body = ?, dueDate = ?, completed = ? WHERE id = ?`;
    let params = [title, body, dueDate, completed, req.params.taskID];
    let connection = await connectDB();
    let [result] = await connection.execute(query, params);
    if (!result) throw new Error("There was an error updating the post");
    connection.end();
    res.status(200).json({
      status: true,
      data: result.affectedRows,
    });
  } catch (error) {
    res.status(400).json({
      status: false,
      message: error.message,
    });
  }
});

// endpoint to delete a post
app.delete("/todo/:taskID", async (req, res) => {
  try {
    let query = `DELETE FROM todo WHERE id = '${req.params.taskID}'`;
    let connection = await connectDB();
    let [result] = await connection.execute(query);
    connection.end();
    if (!result) throw new Error("There was an error deleting the post");
    res.status(200).json({
      status: true,
      message: "Post deleted successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({
      status: false,
      message: error.message,
    });
  }
});

// end point to sign user up
app.post("/signup", async (req, res) => {
  try {
    let { username, email, password } = req.body;
    if (!(username && email && password))
      throw new Error("All fields are required");
    if (!nameRegex.test(username) || username.length < 3)
      throw new Error("Username is invalid");
    if (!emailRegex.test(email)) throw new Error("Email is invalid");
    if (password.length < 4) throw new Error("password is too short");
    let query = `SELECT * FROM users WHERE username = '${username}' OR email = '${email}'`;
    let connection = await connectDB();
    let [result] = await connection.execute(query);
    connection.end();
    if (result.length) throw new Error("Username or email already exist");
    let id = uniqid.time();
    let seasionID = uniqid("", `-${id}`);
    let { hash: hashed, salt: salted } = hashPassword(password);
    query = `INSERT INTO users (id, username, email, password, seasionID, password_salt) VALUES (?,?,?,?,?,?)`;
    let params = [id, username, email, hashed, seasionID, salted];
    connection = await connectDB();
    [result] = await connection.execute(query, params);
    connection.end();
    console.log(result);
    res.status(201).json({
      status: true,
      data: {
        id: id,
        username: username,
        seasionID: seasionID,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: false,
      message: error.message,
    });
  }
});

// endpoint to sign user in
app.post("/signin", async (req, res) => {
  try {
    let { username, password } = req.body;
    console.log(req.body);
    if (!(username && password)) throw new Error("All fields are required");
    if (!(nameRegex.test(username) || emailRegex.test(username)))
      throw new Error("Username or email is not valid");
    let query = `SELECT * FROM users WHERE username = '${username}' `;
    let connection = await connectDB();
    const [result] = await connection.execute(query);
    connection.end();
    console.log(result);
    if (!result.length) throw new Error("Incorrect username or password");
    let passwordMatch = verifyPassword(
      password,
      result[0].password,
      result[0].password_salt
    );
    if (passwordMatch) {
      const data = {
        id: result[0].id,
        username: result[0].username,
        seasionID: result[0].seasionID,
      };
      res.status(200).json({
        status: true,
        data: data,
      });
    }
  } catch (error) {
    res.status(400).json({
      status: false,
      message: error.message,
    });
  }
});
