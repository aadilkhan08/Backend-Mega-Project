import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    const { accessToken } = req.cookies;
    console.log("hello");

    if (!accessToken) {
      return next(new apiError("User Please login to Access", 401));
    }
    const { id } = jwt.verify(accessToken, "adil");
   
     const user = await User.findById(id)
    req.user = user;

    next();
  } catch (error) {
    throw new apiError(401, error?.message || "Unauthorized");
  }
});
