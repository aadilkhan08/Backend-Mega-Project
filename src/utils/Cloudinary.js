import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadFileCloudinary = async localStoragePath => {
  try {
    if (!localStoragePath) return null;
    const response = await cloudinary.uploader.upload(localStoragePath, {
      resource_type: "auto",
    });
    fs.unlinkSync(localStoragePath);
    return response;
  } catch (error) {
    //  removed the locally saved file if it fails to upload to cloudinary
    fs.unlinkSync(localStoragePath);
  }
};

const deleteFileCloudinary = async publicId => {
  try {
    if (!publicId) return null;
    const response = await cloudinary.uploader.destroy(publicId);
    return response;
  } catch (error) {
    console.log(error?.message || "Failed to delete file from cloudinary");
  }
};

export { uploadFileCloudinary,deleteFileCloudinary };
