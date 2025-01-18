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
    const paymentCollection = client.db("employeeDB").collection("payments");
    const payrollCollection = client.db("employeeDB").collection("payrolls");
    const workCollection = client.db("employeeDB").collection("works");

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
      const { task, hours, date, email, name } = req.body;

      // Validate input
      if (!task || !hours || !date || !email || !name) {
        return res.status(400).json({ message: "All fields are required" });
      }

      try {
        // const db = getDb();
        const monthNames = [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ];
        const month = monthNames[new Date(date).getMonth()];
        const newTask = { task, hours, date, email, name, month };
        const result = taskCollection.insertOne(newTask);
        res.status(201).json({ ...newTask, _id: result.insertedId });
      } catch (error) {
        res.status(500).json({ message: "Error adding task", error });
      }
    });

    //get data by email
    app.get("/user-tasks", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await taskCollection.find(query).toArray();
      res.send(result);
    });

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

    app.get("/payments", async (req, res) => {
      const email = req.query.email;
      const page = parseInt(req.query.page) || 1;
      const limit = 5; // Items per page
      const skip = (page - 1) * limit;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      try {
        const paymentsQuery = paymentCollection
          .find({ email }) // Filter by email
          .sort({ year: 1, month: 1 }) // Sort by year and month in ascending order
          .skip(skip) // Pagination: skip items
          .limit(limit); // Pagination: limit items

        const payments = await paymentsQuery.toArray();
        const totalPayments = await paymentCollection.countDocuments({ email });

        const totalPages = Math.ceil(totalPayments / limit);

        res.status(200).json({
          payments,
          totalPages,
        });
      } catch (error) {
        console.error("Error fetching payment history:", error);
        res
          .status(500)
          .json({ message: "Error fetching payment history", error });
      }
    });

    //get all employee

    app.get("/employees", async (req, res) => {
      try {
        const employees = await userCollection
          .find({ role: { $ne: "Admin" } }) // Exclude Admins
          .project({
            name: 1,
            email: 1,
            bank_account_no: 1,
            salary: 1,
            isVerified: 1,
          })
          .toArray();

        res.status(200).json(employees);
      } catch (error) {
        console.error("Error fetching employees:", error);
        res.status(500).json({ message: "Error fetching employees", error });
      }
    });

    //update employee isverified field
    app.put("/employees/:id/verify", async (req, res) => {
      const { id } = req.params;
      const { isVerified } = req.body; // New verified status
      console.log(id, isVerified);

      try {
        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { isVerified } }
        );

        res
          .status(200)
          .json({ message: "Verification status updated", result });
      } catch (error) {
        console.error("Error updating verification status:", error);
        res
          .status(500)
          .json({ message: "Error updating verification status", error });
      }
    });

    //create payment request

    app.post("/payroll", async (req, res) => {
      const { email, amount, month, year } = req.body;

      try {
        const result = await payrollCollection.insertOne({
          email,
          amount,
          month,
          year,
          status: "Pending", // Default status
        });

        res.status(200).json({ message: "Payment request created", result });
      } catch (error) {
        console.error("Error creating payment request:", error);
        res
          .status(500)
          .json({ message: "Error creating payment request", error });
      }
    });
    //details/:slug
    app.get("/employees/:email", async (req, res) => {
      const email = req.params.email; // Decode the email from the slug

      try {
        const employee = await userCollection.findOne({ email });

        if (!employee) {
          return res.status(404).json({ message: "Employee not found" });
        }

        res.status(200).json(employee);
      } catch (error) {
        console.error("Error fetching employee details:", error);
        res
          .status(500)
          .json({ message: "Error fetching employee details", error });
      }
    });

    app.get("/payments/:email", async (req, res) => {
      const email = req.params.email; // Decode the email
      // console.log(email);

      try {
        const payments = await paymentCollection
          .find({ email }) // Filter payments by email
          .sort({ year: 1, month: 1 }) // Sort by year and month
          .toArray();
        console.log(payments);
        if (payments.length === 0) {
          return res.status(404).json({ message: "No payment history found" });
        }

        res.status(200).json(payments);
      } catch (error) {
        console.error("Error fetching payment history:", error);
        res
          .status(500)
          .json({ message: "Error fetching payment history", error });
      }
    });

    // hr work manangement

    app.get("/progress", async (req, res) => {
      const { name, month } = req.query; // Extract name and month from query parameters

      try {
        let query = {};

        // Add filters to the query
        if (name) {
          query.name = name; // Filter by employee name
        }
        if (month) {
          query.month = month; // Filter by month
        }

        const workRecords = await workCollection.find(query).toArray();
        console.log(workRecords);
        res.status(200).json(workRecords);
      } catch (error) {
        console.error("Error fetching progress records:", error);
        res
          .status(500)
          .json({ message: "Error fetching progress records", error });
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
