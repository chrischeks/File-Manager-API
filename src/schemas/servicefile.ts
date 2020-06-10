import { Schema, model  } from "mongoose";

export var ServiceFileSchema: Schema = new Schema({
   secret: { 
        originalFileName: String,
        fileName: String,
        fileSize: Number,
        fileExtension: String,
        sharing: [{
          baseUrl: String,
          recipient: String,
          comment: String,
          shareDate: {
            type: Date,
            default: Date.now
          },
          shareType: String
        }]
    },
   nameHash: {
     type: String,
     required: true
   },
   tenantId: {
     type: String,
     required: true
   },
   userId: {
     type: String,
     required: true
   }

}, {timestamps: true});



