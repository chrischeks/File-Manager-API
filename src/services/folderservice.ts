import { BaseService } from "./baseservice";
import { BasicResponse } from "../dto/output/basicresponse";
import { Status } from '../dto/enums/statusenum';

import { NextFunction, Request, Response } from "express";
import { validateSync } from "class-validator";

import { FolderDTO } from "../dto/input/createfolderdto";
import { IFolderModel } from '../models/userFolder';
import { UpdateFolderNameDTO } from '../dto/input/updateFolderDTO';
import { UpdateFileNameDTO } from '../dto/input/updateFileName';

const zipper = require('zip-a-folder');
const fs = require('fs')
const { promisify } = require('util')

const unlinkAsync = promisify(fs.unlink)


export class FolderService extends BaseService{

    public async processCreateFolder(req, res: Response, next: NextFunction, userId: string, userName: string, tenantId: string, userEmail: string){
        try{
            
            let dto = new FolderDTO(req.body.folderName, req.body.parentFolderId);
            
            let errors = await this.validateFolderDetails( dto, req, userId, tenantId, userEmail);
            
            if(this.hasErrors(errors)){
               
                this.sendResponse(new BasicResponse(Status.FAILED_VALIDATION, errors),req, res);
                return next();
            }
            
            await this.saveNewUploadedFolderDetails(dto, userId, userName, tenantId, userEmail, req, res, next);
            return next();
               
        
        } catch (ex){
            console.log(ex)
            this.sendException(ex, new BasicResponse(Status.ERROR), req, res, next);
        }
    }


    public async processDeleteFolder(req, res: Response, next: NextFunction, userId: string, tenantId: string) {
        try {
            let file = await this.deleteFolderFile(req, res, next, userId, tenantId)
            let folder = await this.deleteSubFolder(req, res, next, userId, tenantId)
            let parentFolder = await this.deleteparentFolder(req, res, next, userId, tenantId)

            if (file === null && folder === null && parentFolder === null) {

                this.sendResponse(new BasicResponse(Status.FAILED_VALIDATION, ["Sorry you cannot delete this folder"]), req, res);
                return next();
            } else {
                this.sendResponse(new BasicResponse(Status.SUCCESS_NO_CONTENT), req, res);
            }
        }
        catch (ex) {
            this.sendException(ex, new BasicResponse(Status.ERROR), req, res, next);
        }

    }


    public async deleteparentFolder(req, res: Response, next: NextFunction, userId: string, tenantId: string) {

        let existingFolder = null
        await req.app.locals.folder.findOne({ _id: req.params.id, userId: userId, tenantId: tenantId }).then(folder => {
            if (folder._id) {

                existingFolder = folder
            }
        }).catch(err => { })

        if (existingFolder) {

            await req.app.locals.folder.deleteOne({ _id: req.params.id, userId: userId, tenantId: tenantId })
        }
        return existingFolder

    }
        
    


    async deleteSubFolder(req: Request, res: Response, next: NextFunction, userId: string, tenantId: string){
        
        let existingFolder = null
        await req.app.locals.folder.findOne({parents: req.params.id, userId:userId, tenantId:tenantId}).then(folder =>{
    
            if(folder._id){
                
                existingFolder = folder
            }
        }).catch(err =>{})
       
        if (existingFolder) {
           
            await req.app.locals.folder.deleteMany({parents: req.params.id, userId:userId, tenantId:tenantId})
        }
        return existingFolder
    }


    async deleteFolderFile(req: Request, res: Response, next: NextFunction, userId: string, tenantId: string) {
        let existingFile = null

        await req.app.locals.file.find({ parents: req.params.id, userId: userId, tenantId: tenantId }).then(file => {

            if (file[0]._id) {

                existingFile = file
            }
        }).catch(err => { })

        if (existingFile) {
            for (var i = 0; i < existingFile.length; i++) {

                let dir = process.env.UPLOAD_PATH + '/' + existingFile[i].secret.fileName;
                await unlinkAsync(dir)
            }

            await req.app.locals.file.deleteMany({ parents: req.params.id, userId: userId, tenantId: tenantId })
        }
        return existingFile
    }






   public async processDownloadFolder(req: Request, res: Response, next: NextFunction, userId: string, tenantId: string, userEmail: string) {
        try {
            var result = null
            var that = this
            await req.app.locals.file.find({ parents: req.params.id, $or: [{ userId: userId }, { shared_with: that.sha256(userEmail) }], tenantId: tenantId }).then(file => {
                if (file[0]._id) {
                    result = file;
                }

            }).catch(() => {
                this.sendResponse(new BasicResponse(Status.PRECONDITION_FAILED, ["You are not allowed to download a folder without a file or an invalid folder"]), req, res);
            })

            await this.downloadLogic(result, userId, tenantId, userEmail, req, res)

        } catch (ex) {
            this.sendResponse(new BasicResponse(Status.ERROR, ex), req, res);
        }
    }



    async downloadLogic(result, userId: string, tenantId: string, userEmail: string, req: Request, res: Response) {
        for (let i = 0; i < result.length; i++) {

            let folderPath = ""
            const currentFileId = result[i]._id
            const curentFileParents = result[i].parents.concat(currentFileId)

            for (let j = 0; j < curentFileParents.length; j++) {

                if (curentFileParents[j] !== curentFileParents[curentFileParents.length - 1]) {
                    var filePath = ""
                    let that = this
                    await req.app.locals.folder.findOne({ _id: curentFileParents[j], $or: [{ userId: userId }, { shared_with: that.sha256(userEmail) }], tenantId: tenantId }).then(result => {

                        let folderName = result.secret.folderName + "/"
                        folderPath += folderName;
                        
                        if (!fs.existsSync(folderPath)) {
                            fs.mkdirSync( folderPath, { recursive: true });
                        }
                        
                        filePath = folderPath

                    }).catch({})
                } else {
                    var that = this
                    let lastIdOfParentsArray = curentFileParents[curentFileParents.length - 1]
                    await req.app.locals.file.findOne({ _id: lastIdOfParentsArray, $or: [{ userId: userId }, { shared_with: that.sha256(userEmail) }], tenantId: tenantId }).then(result => {
                        folderPath += result.secret.originalFileName;
                        const src = process.env.UPLOAD_PATH + '/' + result.secret.fileName;
                        const dest = filePath + result.secret.originalFileName

                        fs.copyFileSync(src, dest);
                    }).catch({})
                }
            }

        }
        const zipFolderSrc = filePath.split('/')[0]
        const zippedFile =  zipFolderSrc + '.zip'
        await zipper.zip(zipFolderSrc,  zippedFile)
        await res.download(zippedFile)
    }

    async validateFolderDetails(dto, req: Request, userId: string, tenantId : string, userEmail: string) {
        let errors = validateSync(dto, { validationError: { target: false }} );
        if(this.hasErrors(errors)){
            return errors;
        }

        let folder = 0;
        if(dto.parentFolderId ){
           
            folder = await this.findfolderbyId(req.app.locals.folder, dto.parentFolderId , userId, tenantId, userEmail);
            if(folder == 0){        
                errors.push(this.getInvalidFolderError());
                return errors;
            }
        }

 
        let duplicate = 0;
        if(dto.parentFolderId ){
            duplicate = await this.findfolderWithSameNameInParentFolderForUser(req.app.locals.folder, dto.parentFolderId , dto.folderName, userId, tenantId, userEmail);
        }else {
            duplicate = await this.findfolderWithSameNameForUser(req.app.locals.folder, dto.folderName, userId, tenantId);
        }
        
        if(duplicate > 0){
            errors.push(this.getFolderDuplicateError(dto.folderName));
        }
 
        return errors;
    }

    async findfolderbyId( folderModel, parentFolderId, userId, tenantId, userEmail) {
        var found = 0;
        var that = this;

        await folderModel.countDocuments({ _id : parentFolderId, $or: [
            {userId: userId},
            {shared_with: that.sha256(userEmail)}
        ], tenantId : tenantId }).then(e => {
            found = e;
        });
        return found;
    }

    async findfolderWithSameNameForUser( folderModel, folderName, userId, tenantId) {
        var found = 0;
        await folderModel.countDocuments({ nameHash : this.sha256(folderName), userId : userId, tenantId : tenantId }).then(e => {
            found = e;
        });
        return found;
    }

    async findfolderWithSameNameInParentFolderForUser( folderModel, parentFolderId , folderName, userId, tenantId, userEmail) {
        var found = 0;
        var that = this;
        await folderModel.countDocuments({ parentFolderId: parentFolderId , nameHash : this.sha256(folderName), $or: [
            {userId: userId},
            {shared_with: that.sha256(userEmail)}
        ], tenantId : tenantId }).then(e => {
            found = e;
        });
        return found;
    }

    async saveNewUploadedFolderDetails(dto : FolderDTO, userId: string, userName: string, tenantId: string, userEmail: string,  req: Request, res: Response, next: NextFunction) {
        var that = this;
        let sharedWith = null;
        let parentId = [];
        let validFolder: boolean = false;
        let sharing;
        let folderOwner = that.sha256(userEmail);
        var ownFolder = true
        let secretFolderOwner = userEmail
        let sharedFolder = false

        if(dto.parentFolderId){
            await req.app.locals.folder.findOne({_id: dto.parentFolderId, $or: [
                {userId: userId},
                {shared_with: that.sha256(userEmail)}
            ], tenantId: tenantId}).then(folder => {
                if (folder && folder.userId === userId) {
                    sharing = folder.secret.sharing
                    sharedWith = folder.shared_with;
                    
                } else if (folder && folder.userId !== userId) {
                    sharing = [{shareType: "private", secret_shared_with: [folder.secret.secret_folder_owner]}]
                    sharedWith = [folder.folder_owner];
                    ownFolder = false
                    
                }
                parentId = folder.parents.concat([req.body.parentFolderId]);
                validFolder = true;
    
            }).catch(err => {
            });

            if(!validFolder){
               this.sendResponse(new BasicResponse(Status.PRECONDITION_FAILED), req, res);
            }

        }

        

        let uploadFolderModel : IFolderModel = req.app.locals.folder({secret: {folderName: dto.folderName.trim(), sharing: sharing, secret_folder_owner: secretFolderOwner}, folder_owner: folderOwner, shared_with: sharedWith, parentFolderId : dto.parentFolderId, parents: parentId, userId: userId, sharedFolder: sharedFolder, tenantId: tenantId, nameHash: this.sha256(dto.folderName)});

        let responseObj = null;
        await uploadFolderModel.save().then(result => {
            if (!result) {
                responseObj = new BasicResponse(Status.FORBIDDEN);
            } else if (result && !ownFolder){
                
                responseObj = new BasicResponse(Status.SUCCESS, ["The share was successful", result._id]);
            }else {
                responseObj = new BasicResponse(Status.CREATED, this.removeGenericFieldsAndReturn(result));
            } 

        }).catch(err => {
            responseObj = new BasicResponse(Status.ERROR);
        });

        this.sendResponse(responseObj, req, res);
    }


    public async processListFolders(req, res: Response, next: NextFunction, userEmail, userId: string, tenantId: string){
        try{
            let parentFolderId = req.query.id
            await this.verifyParentFolderId(parentFolderId, userId, tenantId, userEmail, req, res, next)
           
            let folders = await this.fetchUserFolders(req.app.locals.folder, userId, tenantId, parentFolderId, userEmail);
            if(folders && folders.length > 0){
                this.sendResponse(new BasicResponse(Status.SUCCESS, folders), req, res);
            }else{
                this.sendResponse(new BasicResponse(Status.SUCCESS, []), req, res); 
            }
            return next();
            }
        catch(ex){
            this.sendException(ex, new BasicResponse(Status.ERROR), req, res, next);
        }
        
    }


    public async processListSharedFolder(req, res: Response, next: NextFunction, tenantId: string){
        try{
            const folderId = req.params.id
                let existingFolder = null;
                await req.app.locals.folder.findOne({_id: folderId, tenantId: tenantId},{userId:0, tenantId:0, nameHash: 0},{userId: 0, nameHash: 0, __v: 0, tenantId: 0}).then(result => { 
                    if(result){
                        existingFolder = result;
                    }
                }).catch(err => {});

                if(existingFolder == null) {
                    this.sendResponse(new BasicResponse(Status.NOT_FOUND),req, res);
                    return next();
                }
            
            await this.fetchSharedSubFolders(tenantId, req, res)
        } 
        catch(ex){
            this.sendResponse(new BasicResponse(Status.ERROR), req, res);
        }       
    }


    public async updateFolderName(req: Request, res: Response, next: NextFunction, userId: string, tenantId: string){
        try{
            let dto = new UpdateFolderNameDTO(req.body.folderName.trim());
            let errors = await this.validateExistingFolderDetail(dto);
            if(this.hasErrors(errors)){
                await this.sendResponse(new BasicResponse(Status.FAILED_VALIDATION, errors), req, res);
                return next();
            }
            await this.saveUpdatedFolderName(req, res, next, dto, userId, tenantId)
  
        } catch (ex){
            this.sendException(ex, new BasicResponse(Status.ERROR, ex), req, res, next);
        }
    }


    async saveUpdatedFolderName(req: Request, res: Response, next: NextFunction, dto: UpdateFolderNameDTO, userId:string, tenantId: string){
        
        let existingFolder = null;
            await req.app.locals.folder.findOne({_id: req.params.id, userId: userId, tenantId: tenantId},{userId:0, tenantId:0, nameHash: 0, _v: 0}).then(result => {
                if(result){
                    existingFolder = result;
                }
            }).catch(err => {});
            existingFolder.secret.folderName = dto.folderName;
            existingFolder.nameHash = this.sha256(dto.folderName);
            
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
    }

    async fetchUserFolders(folderModel, userId, tenantId, parentFolderId, userEmail) {
        let folders = null;
        var that = this;
        let queryParams = {};
        if(parentFolderId == null){
            queryParams = {parentFolderId: null, userId: userId, tenantId : tenantId }
        }else{
            queryParams = {parentFolderId : parentFolderId , $or: [ { userId: userId }, { shared_with: that.sha256(userEmail)}], tenantId : tenantId}
        }
        await folderModel.find(queryParams, {userId: 0, nameHash: 0, __v: 0, tenantId: 0}).then(result => {
            folders = result;
        });
        return folders;
    }

    async validateExistingFolderDetail(dto: UpdateFolderNameDTO) {
        let errors = validateSync(dto, { validationError: { target: false }} );
        if(this.hasErrors(errors)){
            return errors;
        }
 
        if (this.checkFolderName(dto)) {
            errors.push(this.getEmptyFolderNameError());
        }
 
        return errors;
    }
    

    checkFolderName(dto: UpdateFolderNameDTO): boolean {
        return (dto.folderName === undefined || dto.folderName.length === 0 )
    }



    async sharedWithMe(req, res: Response, next: NextFunction,  userEmail: string, userId: string, tenantId: string){
        var that = this;
        let queryParams = {};
        if(req.params.id === 'all'){
            queryParams = {$or: [{parentFolderId : null}, {sharedFolder: true}], shared_with: that.sha256(userEmail), tenantId : tenantId}
        }else{
            queryParams = {parentFolderId : req.params.id , $or: [ { userId: userId }, { shared_with: that.sha256(userEmail)}], tenantId : tenantId}
        }
        await req.app.locals.folder.find(queryParams, {userId:0, tenantId: 0, __v:0, nameHash: 0}).then(result=> {
            if(result && result.length > 0) {
                this.sendResponse(new BasicResponse(Status.SUCCESS, result), req, res);
            }else{
                this.sendResponse(new BasicResponse(Status.SUCCESS, []), req, res);
            }
        }).catch(err =>{
                this.sendResponse(new BasicResponse(Status.ERROR), req, res);
        })
    }

    
    async verifyParentFolderId(parentFolderId: string, userId: string, tenantId: string, userEmail:string, req, res, next){
        if(parentFolderId){
            let existingFile = null;
            let that = this;
            await req.app.locals.folder.findOne({_id: parentFolderId, $or: [ { userId: userId }, { shared_with: that.sha256(userEmail)}], tenantId: tenantId}, {userId:0, tenantId:0, nameHash:0, _v: 0}).then(result => {
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

    
    async fetchSharedSubFolders(tenantId: string, req: Request, res: Response){

        await req.app.locals.folder.find({parentFolderId: req.params.id, tenantId : tenantId},{userId:0, tenantId:0, __v: 0, nameHash: 0}).then(result=> {
            if(result && result.length > 0){
                this.sendResponse(new BasicResponse(Status.SUCCESS, result), req, res);
            }else{
                this.sendResponse(new BasicResponse(Status.SUCCESS, []), req, res);
            }
        }).catch(err =>{
                this.sendResponse(new BasicResponse(Status.ERROR), req, res);
        })
    }
}