import { Length, IsNotEmpty } from "class-validator";

export class UpdateFileNameDTO {


    @IsNotEmpty({
        message: 'originalFileName is required'
    })
    originalFileName: string;





    constructor(originalFileName: string) {
        this.originalFileName = originalFileName;

    }
}