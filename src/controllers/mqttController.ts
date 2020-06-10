import { NextFunction, Request, Response, Router } from "express";
import { BaseController } from "./basecontroller";
import { FileService } from '../services/fileservice';
import { BasicResponse } from "../dto/output/basicresponse";
import { Status } from "../dto/enums/statusenum";
import { MttpService } from "../services/mqttservice"


export class MqttController extends BaseController {
    public loadRoutes(prefix: String, router: Router) {

        this.initMttqRoute(prefix, router);
        this.initDownloadFileRoute(prefix, router);
        
      }


      public initMttqRoute(prefix: String, router: Router): any {

        router.post(prefix+ "/communication", (req, res: Response, next: NextFunction) =>{
          new MttpService().processCommunication(req, res, next);
        })

      }

      public initDownloadFileRoute(prefix: String, router: Router): any {

        router.get(prefix + "/download_file/:id", (req, res: Response, next: NextFunction) => {
          new FileService().mqttUserFileDownload(req, res, next);
        })
      }
}