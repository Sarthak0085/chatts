import { v4 as uuid } from "uuid";
import { v2 as cloudinary } from "cloudinary";
import { getBase64, getSockets } from "../lib/helpers";
import { ErrorHandler } from "./errorHandler";
import { Request } from "express";

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
  caption?: string;
  message_type?: string;
}

export const emitEvent = (req: Request, event: string, users: any, data?: any) => {
  const io = req.app.get("io");
  const usersSockets = getSockets(users as any);
  io.to(usersSockets).emit(event, data);
}

export const uploadFilesToCloudinary = async ({ files, username, email, userId, isAvatar, message_type }: UploadFile): Promise<GetCloudinaryResult[] | undefined> => {
  const uploadPromises = files.map((file) => {
    const folder = isAvatar ? `chatss/avatars/${username}-${email}` : `chats/chat/${userId}-${message_type}`;
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
    console.log(results);

    const formattedResults = results.map((result) => ({
      public_id: result.public_id,
      url: result.secure_url,
    })) as GetCloudinaryResult[];
    console.log(formattedResults);
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