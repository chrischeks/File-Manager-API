import { NextFunction, Request, Response, Router } from "express";
import { BaseController } from "./basecontroller";

/**
 * / route
 *
 * @class AdminController
 */
export class AdminController extends BaseController {

  /**
   * Create the routes.
   *
   * @method create
   * @static
   */
  public static loadRoutes(prefix: string, router: Router) {
    
    router.get(this.settingsUrl(prefix), (req: Request, res: Response, next: NextFunction) => {
      new AdminController().fetchAllUsers(req, res, next);
    });

  }
  static settingsUrl(prefix: string): any {
    return prefix+"/settings";
  }

  constructor() {
    super();
  }

  public fetchAllUsers(req: Request, res: Response, next: NextFunction) {
    
    /*this.initPagination(req, false);
    req.app.locals.user.find({}, {password : 0, __v : 0}).skip(this.start).limit(this.limit).then(result => { 

        if(result){
            this.success(req, res, next, result);
        }else{
            this.error(req, res, next, this.noResults);
        }
    }, err => {
        this.error(req, res, next, this.systemErrorMsg);
    }).catch(err => {
        this.error(req, res, next, this.systemErrorMsg);
    });*/

  }

}