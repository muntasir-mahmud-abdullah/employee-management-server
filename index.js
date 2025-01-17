const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.werzz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const taskCollection = client.db("employeeDB").collection("Tasks");
    const userCollection = client.db("employeeDB").collection("users");

    // users related api
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne({
        ...user,
        role: "employee",
        // timestamp: Date.now(),
      });
      res.send(result);
    });

    // Fetch all tasks
    app.get("/tasks", async (req, res) => {
      try {
        const tasks = await taskCollection.find().toArray();
        res.status(200).json(tasks);
      } catch (error) {
        res.status(500).json({ message: "Error fetching tasks", error });
      }
    });
    // save task in db
    app.post("/tasks", async (req, res) => {
      const { task, hours, date, email } = req.body;

      // Validate input
      if (!task || !hours || !date || !email) {
        return res.status(400).json({ message: "All fields are required" });
      }

      try {
        // const db = getDb();
        const newTask = { task, hours, date, email };
        const result = taskCollection.insertOne(newTask);
        res.status(201).json({ ...newTask, _id: result.insertedId });
      } catch (error) {
        res.status(500).json({ message: "Error adding task", error });
      }
    });

    //get data by email
    app.get("/user-tasks",async(req,res)=>{
      const email = req.query.email;
      const query = {email:email}
      const result= await taskCollection.find(query).toArray();
      res.send(result);
    })


    //delete task in db
    app.delete("/tasks/:id", async (req, res) => {
      const { id } = req.params;
      console.log(id);

      try {
        //     // const db = getDb();
        const result = taskCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Task not found" });
        }

        res.status(200).json({ message: "Task deleted successfully" });
      } catch (error) {
        res.status(500).json({ message: "Error deleting task", error });
      }
    });

    //update task in db

    app.put("/tasks/:id", async (req, res) => {
      const { id } = req.params;
      console.log(id);
      const { task, hours, date } = req.body;

      if (!task || !hours || !date) {
        return res.status(400).json({ message: "All fields are required" });
      }

      try {
        // const db = getDb();
        const result = await taskCollection.updateOne(
          { _id: new ObjectId(id) }, // Filter condition
          { $set: { task, hours, date } } // Update fields
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Task not found" });
        }
        // Retrieve the updated document
        const updatedTask = await taskCollection.findOne({
          _id: new ObjectId(id),
        });
        res.status(200).json(updatedTask);
      } catch (error) {
        console.error("Error updating task:", error);
        res.status(500).json({ message: "Error updating task", error });
      }
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
