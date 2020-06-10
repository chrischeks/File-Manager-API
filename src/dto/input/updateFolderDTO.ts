import { Length, IsNotEmpty } from "class-validator";
 
export class UpdateFolderNameDTO {
 
    
    @IsNotEmpty({
        message: 'folderName is required'
    })
    @Length(1, 120 ,{
        message: 'folderName should be between 1 and 100 characters' })
    folderName: string;
    
    




    constructor(folderName: string){
        this.folderName = folderName;
    }
}