import { v4 as uuid } from "uuid";
import { v2 as cloudinary } from "cloudinary";
import { getBase64 } from "../lib/helpers";
import { ErrorHandler } from "./errorHandler";

interface File {
  mimetype: string;
  buffer: Buffer;
}

interface CloudinaryResult {
  public_id: string;
  secure_url: string;
}

interface GetCloudinaryResult {
  public_id: string;
  url: string;
}

type UploadFile = {
  files: File[];
  username?: string;
  email?: string;
  isAvatar?: boolean;
  userId?: string;
}

export const uploadFilesToCloudinary = async ({ files, username, email, userId, isAvatar }: UploadFile): Promise<GetCloudinaryResult[] | undefined> => {
  const uploadPromises = files.map((file) => {
    const folder = isAvatar ? `chatss/avatars/${username}-${email}` : `chats/chat/${userId}`;
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        getBase64(file),
        {
          resource_type: "auto",
          public_id: `${folder}/${uuid()}`,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
    });
  });

  try {
    //@ts-ignore
    const results: CloudinaryResult[] = await Promise.all(uploadPromises);

    const formattedResults = results.map((result) => ({
      public_id: result.public_id,
      url: result.secure_url,
    })) as GetCloudinaryResult[];
    return formattedResults;
  } catch (err: any) {
    new ErrorHandler("Error uploading files to cloudinary", 400);
  }
};

export const deleteFilesFromCloudinary = async (publicIds: string[]): Promise<void> => {
  const deletePromises = publicIds.map(publicId => {
    return new Promise<void>((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  });

  try {
    await Promise.all(deletePromises);
  } catch (err: any) {
    throw new ErrorHandler('Error deleting files from Cloudinary', 400);
  }
};