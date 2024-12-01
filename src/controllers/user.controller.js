import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { apiResponse } from "../utils/ApiResponse.js";
import {
  uploadFileCloudinary,
  deleteFileCloudinary,
} from "../utils/Cloudinary.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async userId => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.getjwttoken();
    const refreshToken = user.getRefreshjwttoken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new apiError(500, "Token generation failed");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  /*
 Get user details from frontEnd
validation- check if all fields are filled
check if user already exists
check if avatar are uploaded
upload them to cloudinary
create  user object - create entry in database
remove password and refresh token field from response
check for user creation
return res
*/

  const { username, email, fullname, password } = req.body;

  if (
    [username, email, fullname, password].some(field => field?.trim() === "")
  ) {
    throw new apiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new apiError(409, "User already exists");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  let coverLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.cover) &&
    req.files.cover.length > 0
  ) {
    coverLocalPath = req.files.cover[0].path;
  }

  if (!avatarLocalPath) {
    throw new apiError(400, "Avatar is required");
  }

  const avatar = await uploadFileCloudinary(avatarLocalPath);
  const cover = await uploadFileCloudinary(coverLocalPath);

  if (!avatar) {
    throw new apiError(400, "Avatar is required");
  }

  const user = await User.create({
    username: username.toLowerCase(),
    email,
    fullname,
    password,
    avatar: avatar.secure_url,
    cover: cover?.secure_url || "",
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  // console.log(createdUser, 789);

  if (!createdUser) {
    throw new apiError(500, "User creation failed while registing the user");
  }

  return res
    .status(201)
    .json(new apiResponse(200, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  /*
 Get user details from frontEnd (req.body -> data)
validation- username or email
check if user exists
check if password is correct
generate token (access and refresh token)
send cookies
*/

  const { username, email, password } = req.body;
  if (!(username || email)) {
    throw new apiError(400, "Username or Email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new apiError(404, "User not found");
  }

  const passwordValidation = await user.verifyPassword(password);

  if (!passwordValidation) {
    throw new apiError(401, "Password is incorrect");
  }
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "none",
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new apiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refreshToken: undefined },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    sameSite: "None",
    secure: process.env.NODE_ENV === "production",
  };
  res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new apiResponse(200, {}, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.cookies || req.body;
  if (!refreshToken) {
    throw new apiError(401, "Please login to access");
  }
  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded?._id);
    if (!user) {
      throw new apiError(401, "Invalid Refresh Token");
    }

    if (user.refreshToken !== refreshToken) {
      throw new apiError(401, "Refresh Token Is Expired Or Used");
    }

    const options = {
      httpOnly: true,
      sameSite: "None",
      secure: process.env.NODE_ENV === "production",
    };

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new apiResponse(
          200,
          { accessToken, newRefreshToken },
          "Token Refreshed Successfully"
        )
      );
  } catch (error) {
    throw new apiError(401, error?.message || "Invalid Refresh Token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.verifyPassword(currentPassword);

  if (!isPasswordCorrect) {
    throw new apiError(400, "Current password is incorrect");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new apiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new apiResponse(200, req.user, "User details fetched successfully"));
});

const updateUser = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;

  if (!fullname || !email) {
    throw new apiError(400, "Fullname and email are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { fullname, email },
    },
    { new: true }
  ).select("-password");

  if (!user) {
    throw new apiError(500, "User update failed");
  }

  return res
    .status(200)
    .json(new apiResponse(200, user, "User updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new apiError(400, "Avatar Local is required");
  }

  const avatar = await uploadFileCloudinary(avatarLocalPath);

  if (!avatar.secure_url) {
    throw new apiError(400, "Error while uploading avatar");
  }

  const user = await User.findById(req.user?._id).select("-password");

  if (!user) {
    throw new apiError(500, "User avatar update failed");
  }

  const previousAvatarUrl = user.avatar.secure_url;
  user.avatar = avatar.secure_url;
  await user.save({ validateBeforeSave: false });

  if (previousAvatarUrl) {
    await deleteFileCloudinary(previousAvatarUrl);
  }

  return res
    .status(200)
    .json(new apiResponse(200, user, "User avatar updated successfully"));
});

const updateUserCover = asyncHandler(async (req, res) => {
  const coverLocalPath = req.file?.path;

  if (!coverLocalPath) {
    throw new apiError(400, "Cover is required");
  }

  const cover = await uploadFileCloudinary(coverLocalPath);

  if (!cover.secure_url) {
    throw new apiError(400, "Error while uploading cover");
  }

  const user = await User.findById(req.user?._id).select("-password");

  if (!user) {
    throw new apiError(500, "User cover update failed");
  }

  const previousCoverUrl = user.cover.secure_url;
  user.cover = cover.secure_url;
  await user.save({ validateBeforeSave: false });

  if (previousCoverUrl) {
    await deleteFileCloudinary(previousCoverUrl);
  }

  return res
    .status(200)
    .json(new apiResponse(200, user, "User cover updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new apiError(400, "Username is required");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscriberCount: { $size: "$subscribers" },
        subscribedToCount: { $size: "$subscribedTo" },
        isSubscribed: {
          $cond: {
            $if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullname: 1,
        username: 1,
        avatar: 1,
        cover: 1,
        email: 1,
        createdAt: 1,
        subscriberCount: 1,
        subscribedToCount: 1,
        isSubscribed: 1,
        subscribers: 0,
        subscribedTo: 0,
      },
    },
  ]);

  console.log(channel);

  if (!channel || channel.length === 0) {
    throw new apiError(404, "Channel does not exist");
  }

  return res
    .status(200)
    .json(
      new apiResponse(200, channel[0], "User channel fetched successfully")
    );
});

const getUserWatchHistory = asyncHandler(async (req, res) => {
  const user = User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullname: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              // $first: "$owner", another way to get the first element
              owner: { $arrayElemAt: ["$owner", 0] },
            },
          },
        ],
      },
    },
  ]);

  if (!user || user.length === 0) {
    throw new apiError(404, "No videos found in watch history");
  }

  return res
    .status(200)
    .json(
      new apiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully"
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateUser,
  updateUserAvatar,
  updateUserCover,
  getUserChannelProfile,
};
