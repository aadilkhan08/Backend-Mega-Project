import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
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
    secret: process.env.ACCESS_TOKEN_SECRET,
  })
);

// routes
import userRoutes from "./routes/user.routes.js";

// routes declaration
app.use("/api/v1/users", userRoutes);

export { app };
