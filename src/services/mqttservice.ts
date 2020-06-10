import { BaseService } from "./baseservice";
import { BasicResponse } from "../dto/output/basicresponse";
import { Status } from '../dto/enums/statusenum';
import { NextFunction, Request, Response } from "express";
var mqtt = require('mqtt')

export class MttpService extends BaseService {

    public async processCommunication(req: Request, res: Response, next: NextFunction) {
        var that = this;
        let senderMessage = req.body.message
        req.app.locals.client.on('connect', function () {

            req.app.locals.client.publish('topic1/#', senderMessage, function (err) {
                that.sendResponse(new BasicResponse(Status.SUCCESS_NO_CONTENT), req, res);
                next()
            });
        });

    }


    public async publicFileDownload(req: Request, res: Response, next: NextFunction){
        try{
            let existingFile = null;

            await req.app.locals.file.findById(req.params.id).then(result => {
                if(result){
                    existingFile = result;
                }
            }).catch(err => {});

            if(existingFile == null){
                this.sendResponse(new BasicResponse(Status.NOT_FOUND), req, res);
                return next();
            }
            
            let dir = process.env.PUBLIC_UPLOAD_PATH+'/'+existingFile.secret.fileName;

            res.download(dir, existingFile.secret.originalFileName);
  
        } catch (ex){
            console.log(ex);
            this.sendException(ex, new BasicResponse(Status.ERROR, ex), req, res, next);
        }
    }

}