import { Schema, model } from "mongoose";

export var UploadSchema: Schema = new Schema({
   secret: { 
        originalFileName: String,
        fileName: String,
        fileSize: Number,
        fileExtension: String,
        secret_file_owner: String,
        sharing: [{
          baseUrl: String,
          secret_shared_with:[String],
          comment: String,
          shareDate: {
            type: Date,
            default: Date.now
          },
          shareType: String
        }]
    },
    shared_with: [String],
    file_owner: String,
    folderId: String,
    parents :[],
   nameHash: {
     type: String,
     required: true
   },
   sharedFile: Boolean,
   tenantId: {
     type: String,
     required: true
   },
   userId: {
     type: String,
     required: true
   }

}, {timestamps: true});



