import { NextFunction, Request, Response, Router } from "express";
import { BaseController } from "./basecontroller";
import { FileService } from '../services/fileservice';






export class ShareController extends BaseController {

  public loadRoutes(prefix: String, router: Router) {

    this.initShareFileRoute(prefix, router);
    
  }
 
  

  public initShareFileRoute(prefix: String, router: Router): any {

    router.get(prefix+ "/public_file/:id", (req, res: Response, next: NextFunction) =>{
      new FileService().publicFileDownload(req, res, next);
      
    })
  }
  


  constructor() {
    super();
  }


}

