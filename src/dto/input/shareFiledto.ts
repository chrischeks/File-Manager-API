import { IsUrl, IsEmail, IsOptional, Length, IsIn, IsNotEmpty, IsArray} from 'class-validator';

 
export class ShareFileDTO {
    @IsNotEmpty({
      "message": "baseUrl is required"  
    })
    @IsUrl()
    baseUrl: string;

    @IsNotEmpty({
        "message": "file must be shared with at least one recipient"  
      })
    @IsArray()
    shared_with: string[];

    @IsOptional()
    @Length(3)
    comment: string;
    
    @IsNotEmpty({
        "message": "shareType is required"  
      })
    @IsIn(["public", "private"])
    shareType: string;
    
    constructor(baseUrl: string, shared_with: string[], comment: string, shareType: string){
        this.baseUrl = baseUrl;
        this.shared_with = shared_with;
        this.comment = comment;
        this.shareType = shareType;
    }
}