import { Length, IsNotEmpty, IsString, IsOptional } from "class-validator";
 
export class FolderDTO {
 
    
    @IsNotEmpty({
        message: 'folderName is required'
    })
    @Length(1, 120 ,{
        message: 'folderName should be between 1 and 100 characters' })
    folderName: string; 
    @IsOptional()
    @IsString({
        message: "Id should be a string"
    })
    parentFolderId : string;
    


    constructor(folderName?: string, parentFolderId ?: string){
        this.folderName = folderName;
        this.parentFolderId = parentFolderId ;

    }
}