import { Document } from "mongoose";
import { IServiceFile } from "../interfaces/serviceFile";

export interface IServiceFileModel extends IServiceFile, Document {
  //custom methods for your model would be defined here
}