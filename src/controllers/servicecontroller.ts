import { NextFunction, Request, Response, Router } from "express";
import { BaseController } from "./basecontroller";
import { FileService } from '../services/fileservice';
import multer = require("multer");
import { BasicResponse } from "../dto/output/basicresponse";
import { Status } from "../dto/enums/statusenum";
import crypto = require('crypto');


var storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, process.env.SERVICE_UPLOAD_PATH);
  },
  filename: function(req, file, cb) {
    var prefix = crypto.randomBytes(16).toString("hex");
    cb(null, prefix + '-' +Date.now());
  }
});
const upload = multer({ storage: storage , limits: {
  fileSize: +process.env.SERVICE_UPLOAD_MAX_FILE_SIZE
} }).array('files', +process.env.SERVICE_UPLOAD_MAX_NUMBER_FILES);



export class ServiceController extends BaseController {

  public loadRoutes(prefix: String, router: Router) {

    this.initUploadFileRoute(prefix, router);
    this.initDownloadFileRoute(prefix, router);
    this.initViewFileRoute(prefix, router);
  }
 
  public initUploadFileRoute(prefix: String, router: Router): any {
 
    router.post(prefix+"/upload_files" , [this.authorize.bind(this) ] , (req, res: Response, next: NextFunction) => {
        var that = this;
        upload(req, res, function (err) {
          let uploadError: BasicResponse = that.getUploadError(true, req, err);
          if(that.hasUploadError(uploadError)){
            that.sendResponse(uploadError, req, res, next);
          }else {
            new FileService().processServiceFileupload(req, res, next, that.user_id, that.user_tenantId);
          }
            
        });
      
    });
  }

  public initDownloadFileRoute(prefix: String, router: Router): any {

    router.get(prefix+ "/download_file/:id", [this.authorize.bind(this)], (req, res: Response, next: NextFunction) =>{
      new FileService().downloadServiceFile(req, res, next, this.user_id, this.user_tenantId);
    })
  }


  public initViewFileRoute(prefix: String, router: Router): any {

    router.get(prefix + "/view_file/:id", [this.authorize.bind(this)], (req, res: Response, next: NextFunction) => {
      new FileService().viewServiceFile(req, res, next, this.user_tenantId);
    })
  }


  constructor() {
    super();
  }


}

