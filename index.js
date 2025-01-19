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
    const messageCollection = client.db("employeeDB").collection("messages");

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

    // log in related for fired
    app.get("/employees/:email", async (req, res) => {
      const email = req.params.email;

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
      const { email, name, amount, month, year } = req.body;

      try {
        const result = await payrollCollection.insertOne({
          email,
          name,
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
        // if (payments.length === 0) {
        //   return [];
        // }

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
      const { name, month } = req.query; // Extract name and month from query params

      try {
        // Build query object
        let query = {};
        if (name) {
          query.name = name; // Filter by employee name
        }
        if (month) {
          query.month = month; // Filter by month
        }

        // Fetch filtered tasks from taskCollection
        const tasks = await taskCollection.find(query).toArray();
        res.status(200).json(tasks);
      } catch (error) {
        console.error("Error fetching tasks:", error);
        res.status(500).json({ message: "Error fetching tasks", error });
      }
    });

    // admin dashboard

    app.get("/verified-employees", async (req, res) => {
      try {
        const employees = await userCollection
          .find({ isVerified: true })
          .toArray();
        res.status(200).json(employees);
      } catch (error) {
        console.error("Error fetching verified employees:", error);
        res
          .status(500)
          .json({ message: "Error fetching verified employees", error });
      }
    });

    app.patch("/employees/:id/make-hr", async (req, res) => {
      const { id } = req.params;

      try {
        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role: "HR" } }
        );

        if (result.modifiedCount > 0) {
          res
            .status(200)
            .json({ message: "Employee promoted to HR successfully" });
        } else {
          res
            .status(404)
            .json({ message: "Employee not found or already an HR" });
        }
      } catch (error) {
        console.error("Error promoting employee to HR:", error);
        res
          .status(500)
          .json({ message: "Error promoting employee to HR", error });
      }
    });

    app.patch("/employees/:id/fire", async (req, res) => {
      const { id } = req.params;

      try {
        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { isFired: true } }
        );

        if (result.modifiedCount > 0) {
          res.status(200).json({ message: "Employee fired successfully" });
        } else {
          res
            .status(404)
            .json({ message: "Employee not found or already fired" });
        }
      } catch (error) {
        console.error("Error firing employee:", error);
        res.status(500).json({ message: "Error firing employee", error });
      }
    });

    //update salary
    app.patch("/employees/:id/salary", async (req, res) => {
      const { id } = req.params;
      const { salary } = req.body;

      if (!salary) {
        return res.status(400).json({ message: "Salary is required" });
      }

      try {
        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { salary: parseFloat(salary) } }
        );

        if (result.modifiedCount > 0) {
          res.status(200).json({ message: "Salary updated successfully" });
        } else {
          res.status(404).json({ message: "Employee not found" });
        }
      } catch (error) {
        console.error("Error updating salary:", error);
        res.status(500).json({ message: "Error updating salary", error });
      }
    });

    // payroll route

    app.get("/payroll", async (req, res) => {
      try {
        const payrollRequests = await payrollCollection.find().toArray();
        console.log(payrollRequests);
        res.status(200).json(payrollRequests);
      } catch (error) {
        console.error("Error fetching payroll requests:", error);
        res
          .status(500)
          .json({ message: "Error fetching payroll requests", error });
      }
    });

    app.patch("/payroll/:id/pay", async (req, res) => {
      const { id } = req.params;
      const paymentDate = new Date().toISOString(); // Get current date

      try {
        const result = await payrollCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { isPaid: true, paymentDate } }
        );

        if (result.modifiedCount > 0) {
          res
            .status(200)
            .json({ message: "Payment processed successfully", paymentDate });
        } else {
          res.status(404).json({ message: "Payment request not found" });
        }
      } catch (error) {
        console.error("Error processing payment:", error);
        res.status(500).json({ message: "Error processing payment", error });
      }
    });

    //Contact us

    app.post("/messages", async (req, res) => {
      const { email, message } = req.body;

      if (!email || !message) {
        return res
          .status(400)
          .json({ message: "Email and message are required" });
      }

      try {
        const newMessage = { email, message, date: new Date(message.date).toLocaleString("en-BD", { timeZone: "Asia/Dhaka" }) };
        const result = await messageCollection.insertOne(newMessage);

        if (result.insertedId) {
          res.status(201).json({ message: "Message sent successfully" });
        } else {
          res.status(500).json({ message: "Failed to send message" });
        }
      } catch (error) {
        console.error("Error saving message:", error);
        res.status(500).json({ message: "Error saving message", error });
      }
    });

    app.get("/messages", async (req, res) => {
      try {
        const messages = await messageCollection.find().sort({ date: -1 }).toArray();
        res.status(200).json(messages);
      } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ message: "Error fetching messages", error });
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
