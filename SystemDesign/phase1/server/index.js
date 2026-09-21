import express from "express";
import dotenv from "dotenv";
import connectDB from "./lib/db.js";
import User from "./model/user.model.js";
import Redis from "ioredis";
import rateLimiter from "./middleware/ratelimit.js";
import sendEmail from "./lib/sendEmail.js";
import emailQueue from "./queue.js";

dotenv.config();

const port = process.env.PORT || 5000;

const app = express();

app.use(express.json());

export const redis = new Redis(process.env.REDIS_URL);

app.get("/", (req, res) => {
  return res.status(200).json({
    message: `hello from ${process.env.SERVER_NAME}`});
});

app.post("/create", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    await redis.del("user:all");
    const user = await User.create({
      name,
      email,
      password,
    });

    await emailQueue.add("send-email",{email})

    return res.status(201).json({
      message: "User created successfully",
      user,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

app.get("/get",rateLimiter, async (req, res) => {
  const user = await User.find({});

  return res.json(user);
});

app.get("/get-with-redis", async (req, res) => {
  const cached = await redis.get("user:all");

  if (cached) {
    const user = JSON.parse(cached);
    return res.json(user);
  }

  const user = await User.find({});
  await redis.set("user:all", JSON.stringify(user));

  return res.json(user);
});

app.post("/send-otp", async (req, res) => {
  const { email } = req.body;

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await redis.set(`otp:${email}`, otp, "EX", 30 );

  return res.json({ otp });
});
app.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  const cachedOtp = await redis.get(`otp:${email}`);
  if (!cachedOtp) {
    return res
      .status(400)
      .json({ message: "otp not found or has been expired" });
  }

  if (cachedOtp != otp) {
    return res.status(400).json({ message: "incorrect otp" });
  }
  await redis.del(`otp:${email}`)
  return res.json({ message: "otp verified" });
});

app.listen(port, () => {
  connectDB();
  console.log(`server started at : ${port}`);
});

