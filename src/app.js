import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
const app = express();
// const sizeLimit = process.env.SIZE_LIMIT || "1mb";

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(cookieParser());
app.use(
  session({
    resave: true,
    saveUninitialized: true,
    secret: "adil",
  })
);

// routes
import userRoutes from "./routes/user.routes.js";
import session from "express-session";

// routes declaration
app.use("/api/v1/users", userRoutes);

export { app };
