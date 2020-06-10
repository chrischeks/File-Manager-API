import { Schema, model } from "mongoose";

export var FolderSchema: Schema = new Schema({
   secret: { 
        folderName: String,
        secret_folder_owner: String,
        sharing: [{
          baseUrl: String,
          secret_shared_with: [],
          comment: String,
          shareDate: {
            type: Date,
            default: Date.now
          },
          shareType: String
        }]
   },
   parentFolderId: String,
   parents: [],
   nameHash: {
     type: String,
     required: true
   },
   sharedFolder: Boolean,
   tenantId: {
     type: String,
     required: true
   },
   shared_with: [],
   folder_owner: String,
   userId: {
     type: String,
     required: true
   }

}, {timestamps: true});



