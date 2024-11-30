import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    const { accessToken } = req.cookies;

    if (!accessToken) {
      return next(new apiError("User Please login to Access", 401));
    }
    const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded?._id).select(
      "-password -refreshToken"
    );
    if (!user) {
      throw new apiError(401, "Invalid token");
    }
    req.user = user;
    next();
  } catch (error) {
    throw new apiError(401, error?.message || "Unauthorized");
  }
});
