import { Document } from "mongoose";
import { IUserFolder } from "../interfaces/userFolder";

export interface IFolderModel extends IUserFolder, Document {
  //custom methods for your model would be defined here
}