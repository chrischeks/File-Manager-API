
import { BaseService } from "./baseservice";
import { BasicResponse } from "../dto/output/basicresponse";
import { Status } from '../dto/enums/statusenum';
import { IFolderModel } from '../models/userFolder';
import { NextFunction, Request, Response } from "express";
import { ShareFolderDTO } from '../dto/input/shareFolderDTO';
import { validateSync } from "class-validator";
import * as fs from "fs";
const qs = require('qs') ;
import * as https from "https"




export class ShareFolderService extends BaseService {

    public async processFolderShare(req: Request, res: Response, next: NextFunction, userId: string, tenantId: string, userFirstname: string, userEmail: string){
        try{
            let existingFolder = null;
            await req.app.locals.folder.findOne({_id: req.params.id, userId: userId, tenantId: tenantId}).then(result => {
                if(result){
                    existingFolder = result;
                }
            }).catch(err => {
                console.log(err);
            });

            if(existingFolder == null) {
                this.sendResponse(new BasicResponse(Status.NOT_FOUND),req, res);
                return next();
            }
            
            let dto = new ShareFolderDTO(req.body.baseUrl, req.body.shared_with, req.body.comment, req.body.shareType, req.params.id );
            
            let validationErrors = await this.validateShareFolderDetails( dto, req, existingFolder);

            if(this.hasErrors(validationErrors)){
                this.sendResponse(new BasicResponse(Status.FAILED_VALIDATION, validationErrors),req, res);
                return next();
            }

            var that = this;
            let shared_with = dto.shared_with.map( function(e) {
                return that.sha256(e);
            });
            
           
            let sharedWith = Array.from(new Set(dto.shared_with));
            let sharing = {baseUrl: dto.baseUrl, comment: dto.comment, shareType: dto.shareType, secret_shared_with: sharedWith};
            existingFolder.secret.sharing.push(sharing);
            existingFolder.shared_with = await this.merge(existingFolder.shared_with, shared_with);
            existingFolder.sharedFolder = true;
            let recipients = req.body.shared_with
            let nameOfFolder = existingFolder.secret.folderName

            //await this.copyShareDetails(existingFolder, req, res, next, userId, tenantId)
            this.verifyRecipient(existingFolder, req, res, next, recipients, userFirstname, userEmail, nameOfFolder);
                     
           
        
        } catch (ex){
            console.log(ex);
            this.sendException(ex, new BasicResponse(Status.ERROR), req, res, next);
        }
              
    }
    


    async validateShareFolderDetails(dto: ShareFolderDTO, req: Request, existingFile){
        let errors = validateSync(dto, { validationError: { target: false }} );
        if(this.hasErrors(errors)){
            return errors;
        }

        if(this.isPrivateShareTypeAndRecipientIsEmpty(dto)){
            errors.push(this.getRecipientRequiredWhenShareTypePrivateError());
        }
        
        return errors;
    }

    isPrivateShareTypeAndRecipientIsEmpty(dto: ShareFolderDTO): any {
        return (dto.shareType === 'private' && (dto.shared_with === undefined || dto.shared_with.length === 0))
    }





    async copyShareDetails(shareDetail, req: Request, res: Response, next: NextFunction, userId: string, tenantId: string){
        try{ 
            let existingFolder = null;
            await req.app.locals.folder.findOne({parentFolderId:req.params.id, userId: userId, tenantId: tenantId},{userId:0, tenantId:0, nameHash: 0, __v:0}).then(result => {
                if(result){
                    existingFolder = result;
                }
            }).catch(err => {});
            existingFolder.secret.sharing = shareDetail.secret.sharing
            existingFolder.shared_with = shareDetail.shared_with
            
            let responseObj = null;
            await existingFolder.save().then(result => {
                if(!result){
                    responseObj = new BasicResponse(Status.ERROR);
                }else{
                    responseObj = new BasicResponse(Status.SUCCESS, result);
                }
            }).catch(err => {
                responseObj = new BasicResponse(Status.ERROR, err);
            });
            
            this.sendResponse(responseObj, req, res);
            return next();
  
        } catch (ex){
            this.sendException(ex, new BasicResponse(Status.ERROR, ex), req, res, next);
        }
    }
  }
