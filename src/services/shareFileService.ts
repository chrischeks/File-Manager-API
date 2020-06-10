
import { BaseService } from "./baseservice";
import { BasicResponse } from "../dto/output/basicresponse";
import { Status } from '../dto/enums/statusenum';
import { IUploadModel } from '../models/userUpload';
import { NextFunction, Request, Response } from "express";
import { ShareFileDTO } from '../dto/input/shareFiledto';
import { validateSync } from "class-validator";
import * as fs from "fs";





export class ShareFileService extends BaseService {

    public async processFileShare(req: Request, res: Response, next: NextFunction, userId: string, tenantId: string, userFirstname: string, userEmail: string) {
        try {
            let existingFile = null;
            await req.app.locals.file.findOne({ _id: req.params.id, userId: userId, tenantId: tenantId }).then(result => {
                if (result) {
                    existingFile = result;
                }
            }).catch(err => {
                console.log(err);
            });

            if (existingFile == null) {
                this.sendResponse(new BasicResponse(Status.NOT_FOUND), req, res);
                return next();
            }

            let dto = new ShareFileDTO(req.body.baseUrl, req.body.shared_with, req.body.comment, req.body.shareType);

            let validationErrors = await this.validateShareFileDetails(dto, req, existingFile);

            if (this.hasErrors(validationErrors)) {
                this.sendResponse(new BasicResponse(Status.FAILED_VALIDATION, validationErrors), req, res);
                return next();
            }
            
            if (dto.shareType === "public") {

                const privateFile = process.env.UPLOAD_PATH + '/' + existingFile.secret.fileName;
                const publicFile = process.env.PUBLIC_UPLOAD_PATH + '/' + existingFile.secret.fileName;

                let copyError = false;

                await fs.copyFile(privateFile, publicFile, (err) => {
                    if (err) {
                        copyError = true;
                    };
                });

                if (copyError) {
                    this.sendResponse(new BasicResponse(Status.NOT_FOUND), req, res);
                    return next();
                }

            }

            var that = this;
            let shared_with = dto.shared_with.map(function (e) {
                return that.sha256(e);
            });

            let sharedWith = Array.from(new Set(dto.shared_with));
            let sharing = {baseUrl: dto.baseUrl, comment: dto.comment, shareType: dto.shareType, secret_shared_with: sharedWith};
            existingFile.secret.sharing.push(sharing);
            existingFile.shared_with = await this.merge(existingFile.shared_with, shared_with);
            let recipients = req.body.shared_with
            existingFile.sharedFile = true;
            let nameOfFile = existingFile.secret.originalFileName
            this.verifyRecipient(existingFile, req, res, next, recipients, userFirstname, userEmail, nameOfFile );
            
        } catch (ex) {
            console.log(ex);
            this.sendException(ex, new BasicResponse(Status.ERROR), req, res, next);
        }

    }






    public async downloadSharedFile(req: Request, res: Response, next: NextFunction, userEmail: string, tenantId: string) {
        try {
            let existingFile = null;
            let that = this

            await req.app.locals.file.findOne({ _id: req.params.id, shared_with: that.sha256(userEmail), tenantId: tenantId }).then(result => {
                if (result) {
                    existingFile = result;
                }
            }).catch(err => { });

            if (existingFile == null) {
                this.sendResponse(new BasicResponse(Status.NOT_FOUND), req, res);
                return next();
            }

            let dir = process.env.UPLOAD_PATH + '/' + existingFile.secret.fileName;

            res.download(dir, existingFile.secret.originalFileName);

        } catch (ex) {
            console.log(ex);
            this.sendException(ex, new BasicResponse(Status.ERROR, ex), req, res, next);
        }
    }



    public async viewSharedFile(req: Request, res: Response, next: NextFunction, user_email: string, tenantId: string) {
        try {
            let existingFile = null;
            let that = this

            await req.app.locals.file.findOne({ _id: req.params.id, shared_with: that.sha256(user_email), tenantId: tenantId }).then(result => {
                if (result) {
                    existingFile = result;
                }
            }).catch(err => { });

            if (existingFile == null) {
                this.sendResponse(new BasicResponse(Status.NOT_FOUND), req, res);
                return next();
            }

            let dir = process.env.UPLOAD_PATH + '/';

            var options = {
                root: dir,
                dotfiles: 'deny',
                headers: {
                    'x-timestamp': Date.now(),
                    'x-sent': true
                }
            };

            var fileName = existingFile.secret.fileName;
            res.sendFile(fileName, options);

        } catch (ex) {
            this.sendException(ex, new BasicResponse(Status.ERROR, ex), req, res, next);
        }
    }





    async validateShareFileDetails(dto: ShareFileDTO, req: Request, existingFile) {
        let errors = validateSync(dto, { validationError: { target: false } });
        if (this.hasErrors(errors)) {
            return errors;
        }

        if (this.isPrivateShareTypeAndRecipientIsEmpty(dto)) {
            errors.push(this.getRecipientRequiredWhenShareTypePrivateError());
        }

        return errors;
    }

    isPrivateShareTypeAndRecipientIsEmpty(dto: ShareFileDTO): any {
        return (dto.shareType === 'private' && (dto.shared_with === undefined || dto.shared_with.length === 0))
    }

    
}
