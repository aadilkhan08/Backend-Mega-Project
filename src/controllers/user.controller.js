import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { apiResponse } from "../utils/ApiResponse.js";
import { uploadFileCloudinary } from "../utils/Cloudinary.js";

const generateAccessAndRefreshToken = async userId => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
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
  // console.log("Recieved Email Is: ", email);

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
  // const coverLocalPath = req.files?.cover[0]?.path;
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
    secure: true,
  };
  // console.log("AccessToken is: ", accessToken);
  // console.log("RefreshToken is: ", refreshToken);
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
  console.log("Access And Refresh Token Are: ", accessToken, refreshToken);
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
    secure: process.env.NODE_ENV === "production",
  };
  return res.cookie
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new apiResponse(200, {}, "User logged out successfully"));
});

export { registerUser, loginUser, logoutUser };
