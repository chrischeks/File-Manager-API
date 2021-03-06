
import { BaseService } from "./baseservice";
import { BasicResponse } from "../dto/output/basicresponse";
import { Status } from '../dto/enums/statusenum';
import { IUploadModel } from '../models/userUpload';
import { NextFunction, Request, Response } from "express";
import { UploadFileDTO } from "../dto/input/uploadfiledto";
import { validateSync } from "class-validator";
import { UpdateFileNameDTO } from "../dto/input/updateFileName";
import { sign } from "jsonwebtoken";
import { readFileSync } from "fs";

const fs = require('fs')
const { promisify } = require('util')

const unlinkAsync = promisify(fs.unlink)


export class FileService extends BaseService {

    public async processServiceFileupload(req, res: Response, next: NextFunction, userId: string, tenantId: string){
        try{
            
            var savedModels = [];
            var savedFiles = [];
            var failed: boolean = true;
            

            for(var i=0; i < req.files.length; i++)  {
                let file = req.files[i];
                let uploadFileModel = req.app.locals.serviceFile({secret: {originalFileName: file.originalname ,fileName: file.filename, fileSize: file.size, fileExtension: file.mimetype}, userId: userId, tenantId: tenantId, nameHash: this.sha256(file.originalname)});
                
                await uploadFileModel.save().then(result => {
                    if(result){
                        failed = false;

                        savedFiles.push({
                            filename: file.originalname,
                            size: file.size,
                            id: result._id,
                            created: result.createdAt,
                            mimetype: file.mimetype,
                            url: process.env.SERVICE_FILE_DOWNLOAD_BASE_URL + '/' +file.filename
                        })
                    }
                    savedModels.push(uploadFileModel);
                 });

                 if(failed){
                     break;
                 }
            }

            if(failed){
               this.deleteSavedFiles(savedModels);
               savedFiles = [];

               this.sendResponse(new BasicResponse(Status.ERROR), req, res);
               return next();
            }else{
                var cert = readFileSync(process.env.JWT_PRIVATE_KEY);
                var token = sign({data: savedFiles}, cert, {issuer: process.env.JWT_ISSUER, algorithm: 'RS256', expiresIn: process.env.SERVICE_UPLOAD_TOKEN_EXPIRY });
                this.sendResponse(new BasicResponse(Status.CREATED, {token: token}), req, res);
            }
            
        } catch (ex){
            console.log(ex);
            this.sendException(ex, new BasicResponse(Status.ERROR), req, res, next);
           
        }
    }

    private deleteSavedFiles(saved: any[]): any {
        saved.forEach(e => {
            e.delete();
        });
    }


    public async processFileupload(req, res: Response, next: NextFunction, userName: string, userId: string, tenantId: string, userEmail: string) {
        try {
            var that = this;
            let sharedWith: string[];
            let parentId: string[];
            let validFolder: boolean = false;
            let sharing: [{}];
            let fileOwner = that.sha256(userEmail);
            let ownFolder = true
            let secretFileOwner = userEmail
            let sharedFile = false

            if (req.body.folderId) {
                await req.app.locals.folder.findOne({
                    _id: req.body.folderId, $or: [
                        { userId: userId },
                        { shared_with: that.sha256(userEmail) }
                    ], tenantId: tenantId
                }).then(folder => {
                    if (folder && folder.userId === userId) {
                        sharing = folder.secret.sharing
                        sharedWith = folder.shared_with;

                    } else if (folder && folder.userId !== userId) {
                        sharing = [{ shareType: "private", secret_shared_with: [folder.secret.secret_folder_owner] }]
                        sharedWith = [folder.folder_owner];
                        ownFolder = false
                    }
                    parentId = folder.parents.concat([req.body.folderId]);
                    validFolder = true;

                }).catch(err => { });

                if (!validFolder) {
                    return this.sendResponse(new BasicResponse(Status.PRECONDITION_FAILED), req, res);
                }
            }
            await this.saveFile(req, res, next, ownFolder, sharing, secretFileOwner, fileOwner, sharedWith, parentId, userId, tenantId, sharedFile)


        }
        catch (ex) {
            this.sendException(ex, new BasicResponse(Status.ERROR, ex), req, res, next);
        }
    }

    async saveFile(req, res: Response, next: NextFunction, ownFolder,  sharing, secretFileOwner: string, fileOwner, sharedWith, parentId, userId: string, tenantId: string, sharedFile: boolean) {
        var savedFiles = []
        for (var i = 0; i < req.files.length; i++) {

            let file = req.files[i];

            let uploadFileModel = await req.app.locals.file({ secret: { originalFileName: file.originalname, fileName: file.filename, fileSize: file.size, fileExtension: file.mimetype, secret_file_owner: secretFileOwner, sharing: sharing}, shared_with: sharedWith, parents: parentId, folderId: req.body.folderId, file_owner: fileOwner, userId: userId, sharedFile: sharedFile, tenantId: tenantId, nameHash: this.sha256(file.filename) });
            await uploadFileModel.save().then(result => {
                if (!result) {
                    return this.sendResponse(new BasicResponse(Status.FAILED_VALIDATION), req, res);
                } else {
                    savedFiles.push({
                        secret: {
                            fileName: file.filename,
                            originalFileName: file.originalname,
                            fileExtension: file.mimetype,
                            fileSize: file.size,
                            sharing: result.secret.sharing
                        },
                        _id: result._id,
                        createdAt: result.createdAt,
                        updatedAt: result.updatedAt,
                        folderId: result.folderId,
                        parents: result.parents,
                        fileOwner: result.file_owner,
                        sharedWith: result.shared_with
                    })
                    if (!ownFolder && i == req.files.length-1) {
                        
                        this.sendResponse(new BasicResponse(Status.SUCCESS, ["The share was successful", result._id]), req, res);
                    } else if (savedFiles && i == req.files.length-1) {
                        this.sendResponse(new BasicResponse(Status.CREATED, savedFiles), req, res);
                    }
                }

            }).catch(err => { });

        }
        
    }



    async processDeleteFile(req: Request, res: Response, next: NextFunction, userId: string, tenantId: string){
        try{
            let existingFile = null;

            await req.app.locals.file.findOne({_id: req.params.id, userId: userId, tenantId: tenantId}).then(result => {
                if(result){
                    existingFile = result;
                }
            }).catch(err => {});
            if(existingFile == null){
                this.sendResponse(new BasicResponse(Status.FAILED_VALIDATION, ['Sorry you cannot delete this file']), req, res);
                return next();
            }
            
            let dir = process.env.UPLOAD_PATH+'/'+existingFile.secret.fileName;

            await unlinkAsync(dir)
            await req.app.locals.file.deleteOne({_id: req.params.id, userId:userId, tenantId:tenantId}).then(result =>{
                
                if(result){
                    this.sendResponse(new BasicResponse(Status.SUCCESS_NO_CONTENT),req,res)
                    
                }
            }).catch(err =>{})
  
        } catch (ex){
            this.sendException(ex, new BasicResponse(Status.ERROR, ex), req, res, next);
        }
    }

    public async processListFiles(req, res: Response, next: NextFunction, userId: string, tenantId: string, userEmail: string){
        try{
            let folderId = req.query.id;
            await this.verifyParentFolderId(folderId, userId, tenantId, userEmail, req, res, next)
            
            await this.fetchUserFiles(folderId, userEmail, userId, tenantId, req, res)
            
            }
        catch(ex){
            this.sendException(ex, new BasicResponse(Status.ERROR), req, res, next);
        }
        
    }


    public async updateFileName(req: Request, res: Response, next: NextFunction, userId: string, tenantId: string){
        try{
            
            let dto = new UpdateFileNameDTO(req.body.originalFileName.trim());
            let errors = await this.validateExistingFileDetail(dto);
            if(this.hasErrors(errors)){
                await this.sendResponse(new BasicResponse(Status.FAILED_VALIDATION, errors), req, res);
                return next();
            } 
            
            let existingFile = null;
            const fileId = req.params.id

            await req.app.locals.file.findOne({_id: fileId, userId: userId, tenantId: tenantId}, {userId:0, tenantId: 0, __v:0, nameHash: 0}).then(result => {
                if(result){
                    existingFile = result;
                }
            }).catch(err => {});
            existingFile.secret.originalFileName = dto.originalFileName;
            existingFile.nameHash = this.sha256(dto.originalFileName);
            
            let responseObj = null;
            await existingFile.save().then(result => {
    
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



    public async processMoveFile(req: Request, res: Response, next: NextFunction, userEmail, userId: string, tenantId: string){
        try{
            const parentFolderId = req.body.id;
            await this.verifyParentFolderId(parentFolderId, userId, tenantId, userEmail, req, res, next)
            
            let existingFile = null;
            const fileId = req.params.id
            await req.app.locals.file.findOne({_id: fileId, userId: userId, tenantId: tenantId}, {userId:0, tenantId: 0, __v:0, nameHash: 0}).then(result => {
                if(result){
                    existingFile = result;
                }
            }).catch(err => {});
            existingFile.folderId = parentFolderId
            
            let responseObj = null;
            await existingFile.save().then(result => {
    
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
            console.log(ex);
            this.sendException(ex, new BasicResponse(Status.ERROR, ex), req, res, next);
        }
    } 


    

    public async downloadUserFile(req: Request, res: Response, next: NextFunction, userId: string, tenantId: string){
        try{
            let existingFile = null;

            await req.app.locals.file.findOne({_id: req.params.id, userId: userId, tenantId: tenantId}).then(result => {
                if(result){
                    existingFile = result;
                }
            }).catch(err => {});

            if(existingFile == null){
                this.sendResponse(new BasicResponse(Status.NOT_FOUND), req, res);
                return next();
            }
            
            let dir = process.env.UPLOAD_PATH+'/'+existingFile.secret.fileName;

            res.download(dir, existingFile.secret.originalFileName);
  
        } catch (ex){
            console.log(ex);
            this.sendException(ex, new BasicResponse(Status.ERROR, ex), req, res, next);
        }
    }


    public async mqttUserFileDownload(req: Request, res: Response, next: NextFunction){
        try{
            let existingFile = null;

            await req.app.locals.file.findOne({_id: req.params.id}).then(result => {
                if(result){
                    existingFile = result;
                }
            }).catch(err => {});

            if(existingFile == null){
                this.sendResponse(new BasicResponse(Status.NOT_FOUND), req, res);
                return next();
            }
            
            let dir = process.env.UPLOAD_PATH+'/'+existingFile.secret.fileName;

            res.download(dir, existingFile.secret.originalFileName);
  
        } catch (ex){
            console.log(ex);
            this.sendException(ex, new BasicResponse(Status.ERROR, ex), req, res, next);
        }
    }

    public async downloadServiceFile(req: Request, res: Response, next: NextFunction, userId: string, tenantId: string){
        try{
            let existingFile = null;

            await req.app.locals.serviceFile.findOne({_id: req.params.id, tenantId: tenantId}).then(result => {
                if(result){
                    existingFile = result;
                }
            }).catch(err => {});

            if(existingFile == null){
                this.sendResponse(new BasicResponse(Status.NOT_FOUND), req, res);
                return next();
            }
            
            let dir = process.env.SERVICE_UPLOAD_PATH+'/'+existingFile.secret.fileName;
            res.download(dir, existingFile.secret.originalFileName);
  
        } catch (ex){
            console.log(ex);
            this.sendException(ex, new BasicResponse(Status.ERROR, ex), req, res, next);
        }
    }




    public async viewUserFile(req: Request, res: Response, next: NextFunction, userId: string, tenantId: string, userEmail: string){
        try{
            let existingFile = null;
            var that = this

            await req.app.locals.file.findOne({_id: req.params.id, $or: [ { userId: userId }, { shared_with: that.sha256(userEmail)}], tenantId: tenantId}).then(result => {
                if(result){
                    existingFile = result;
                }
            }).catch(err => {});

            if(existingFile == null){
                this.sendResponse(new BasicResponse(Status.NOT_FOUND), req, res);
                return next();
            }
            
            let dir = process.env.UPLOAD_PATH+'/';

            var options = {
                root:  dir,
                dotfiles: 'deny',
                headers: {
                    'x-timestamp': Date.now(),
                    'x-sent': true
                }
              };
            
              var fileName = existingFile.secret.fileName;
              res.sendFile(fileName, options);
  
        } catch (ex){
            this.sendException(ex, new BasicResponse(Status.ERROR, ex), req, res, next);
        }
    }


    public async viewServiceFile(req: Request, res: Response, next: NextFunction, tenantId: string){
        try{
            let existingFile = null;
            await req.app.locals.serviceFile.findOne({_id: req.params.id, tenantId: tenantId}).then(result => {
                if(result){
                    existingFile = result;
                }
            }).catch(err => {});

            if(existingFile == null){
                this.sendResponse(new BasicResponse(Status.NOT_FOUND), req, res);
                return next();
            }
            const dir = process.env.SERVICE_UPLOAD_PATH+'/';
            const options = {
                root:  dir,
                dotfiles: 'deny',
                headers: {
                    'x-timestamp': Date.now(),
                    'content-disposition':  `attachment; filename=${existingFile.secret.originalFileName}`,
                    'x-sent': true
                }
              };
            
              const fileName = existingFile.secret.fileName;
              res.sendFile(fileName, options);
  
        } catch (ex){
            this.sendException(ex, new BasicResponse(Status.ERROR, ex), req, res, next);
        }
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
    


    public async sharedWithMe(req, res: Response, next: NextFunction, userEmail: string, userId: string, tenantId: string){
        var that = this;
        let queryParams = {};
        if(req.params.id === 'all'){
            queryParams = {$or:[{folderId : null}, {sharedFile: true}], shared_with: that.sha256(userEmail), tenantId : tenantId}
        }else{
            queryParams = {folderId : req.params.id , $or: [ { userId: userId }, { shared_with: that.sha256(userEmail)}], tenantId : tenantId}
        }
        await req.app.locals.file.find(queryParams, {userId:0, tenantId: 0, __v:0, nameHash: 0}).then(result=> {
            if(result && result.length > 0){
                this.sendResponse(new BasicResponse(Status.SUCCESS, result), req, res);
            }else{
                this.sendResponse(new BasicResponse(Status.SUCCESS, []), req, res);
            }
        }).catch(err =>{
                this.sendResponse(new BasicResponse(Status.ERROR), req, res);
        })
    }


    public async fetchSharedFolderFiles(req, res: Response, tenantId: string){
        
        await req.app.locals.file.find({folderId: req.params.id, tenantId : tenantId}, {userId:0, tenantId: 0, __v:0, nameHash: 0}).then(result=> {
            if(result && result.length > 0){
                this.sendResponse(new BasicResponse(Status.SUCCESS, result), req, res);
            }else{
                this.sendResponse(new BasicResponse(Status.SUCCESS, []), req, res);
            }
        }).catch(err =>{
                this.sendResponse(new BasicResponse(Status.ERROR), req, res);
        })
    }


    async fetchUserFiles(folderId: string, userEmail, userId: string, tenantId: string, req: Request, res: Response){
        var that = this;
        let queryParams = {};
        if(folderId == null){
            queryParams = {folderId: null, userId: userId, tenantId : tenantId }
        }else{
            queryParams = {folderId : folderId , $or: [ { userId: userId }, { shared_with: that.sha256(userEmail)}], tenantId : tenantId}
        }
        await req.app.locals.file.find(queryParams, {userId:0, tenantId: 0, __v:0, nameHash: 0}).then(result=> {
            if(result && result.length > 0){
                this.sendResponse(new BasicResponse(Status.SUCCESS, result), req, res);
            }else{
                this.sendResponse(new BasicResponse(Status.SUCCESS, []), req, res);
            }
        }).catch(err =>{
                this.sendResponse(new BasicResponse(Status.ERROR), req, res);
        }   )
    }



    async validateExistingFileDetail(dto: UpdateFileNameDTO) {
        let errors = validateSync(dto, { validationError: { target: false }} );
        if(this.hasErrors(errors)){
            return errors;
        }
 
        if (this.checkOriginalFileName(dto)) {
            errors.push(this.getEmptyOriginalFileNameError());
        }
 
        return errors;
    }

    checkOriginalFileName(dto: UpdateFileNameDTO): any {
        return (dto.originalFileName === undefined || dto.originalFileName.length === 0 || dto.originalFileName === ""|| dto.originalFileName === null)
    }
 


    

    async findfilesWithSameNameForUser(file, fileName, userId, tenantId, folderId?) {
        var found = 0;
        await file.countDocuments({ 'nameHash' : this.sha256(fileName), 'folderId': folderId, 'tenantId' : tenantId, 'userId': userId }).then(e => {
            found = e;
        });
        return found;
 
    }


    async verifyParentFolderId(parentFolderId: string, userId: string, tenantId: string, userEmail, req, res, next){
        if(parentFolderId){
            let existingFile = null;
            let that =this
            await req.app.locals.folder.findOne({_id: parentFolderId, $or: [ { userId: userId }, { shared_with: that.sha256(userEmail)}], tenantId: tenantId}).then(result => {
                if(result){
                    existingFile = result;
                }
            }).catch(err => {});
    
            if(existingFile == null) {
                this.sendResponse(new BasicResponse(Status.NOT_FOUND),req, res);
                return next();
            }
        }
    } 
    

}
 