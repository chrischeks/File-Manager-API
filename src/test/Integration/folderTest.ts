
import { Server } from '../../server';
import * as chai from 'chai';

import chaiHttp = require('chai-http');
import 'mocha';
import { expect } from 'chai';
import mongoose = require("mongoose");
import { FolderSchema } from '../../schemas/folder';
import { IFolderModel } from '../../models/userFolder';
import { IUploadModel } from '../../models/userUpload';
import { UploadSchema } from '../../schemas/file';
import crypto = require('crypto');


process.env.DB_NAME = 'filemanager_test';

chai.use(chaiHttp);

var bearerToken;
var bearerToken1;

let randNum = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5);
let pathregister = '/v1/auth/register';
let pathlogin = '/v1/auth/login';
let pathAddUser = '/v1/users/add';
let firstname = randNum;
let lastname = randNum;
let password = 'password';
let email = `${firstname}${lastname}@test.quabbly.com`;
let email1 = `${firstname}${firstname}${lastname}@test.quabby.com`;
let userApiUrl = process.env.USER_URL;

let userRegisterObject = {
    companyName: "Quabbly",
    firstname: firstname,
    lastname: lastname,
    email: email,
    password: password

}

let addUserObject = {
    firstname: firstname,
    lastname: lastname,
    email: email1,
    password: password
}

const MONGODB_CONNECTION: string = process.env.MONGODB_HOST + process.env.DB_NAME;
mongoose.set('useCreateIndex', true);
mongoose.set('useNewUrlParser', true);
let connection: mongoose.Connection = mongoose.createConnection(MONGODB_CONNECTION);

let folder = connection.model<IFolderModel>("folder", FolderSchema);
let file = connection.model<IUploadModel>("file", UploadSchema);

var clearDB = function (done) {

    folder.deleteMany(function () {
        done();
    });
}

after(function (done) {
    clearDB(done);
    connection.close();
});

beforeEach(function (done) {
    clearDB(done);
});

before(function (done) {
    chai.request(userApiUrl)
        .post(pathregister)
        .send(userRegisterObject)
        .end((err, res) => {
            if (err) console.log("An error occurred");
            chai.request(userApiUrl)
                .post(pathlogin)
                .send({ password: password, username: email })
                .end((err, res) => {
                    if (err) console.log("An error occurred");
                    bearerToken = res.body.token;
                    console.log(bearerToken)
                    chai.request(userApiUrl)
                        .post(pathAddUser)
                        .set('Authorization', `Bearer ${bearerToken}`)
                        .send(addUserObject)
                        .end((err, res) => {
                            if (err) console.log("An error occurred");
                            chai.request(userApiUrl)
                            .post(pathlogin)
                            .send({ password: password, username: email1 })
                            .end((err, res) => {
                                if (err) console.log("An error occurred");
                                bearerToken1 = res.body.token;
                                done()
                            });
                        });

                });
        });
})



var app = Server.bootstrap().app;

describe('Test for all folder operations', () => {



    function verifyFileCreated(res) {
        expect(res).to.have.status(201);
        expect(res.body.status).to.be.eql('CREATED');
        expect(res.body.data[0].createdAt).exist;
        expect(res.body.data[0].secret.originalFileName).exist;
        expect(res.body.data[0].secret.originalFileName).to.be.eql('dummyfile.txt');
        expect(res.body.data[0].secret.fileName).exist;
        expect(res.body.data[0].secret.fileSize).exist;
        expect(res.body.data[0].secret.fileExtension).exist;
        expect(res.body.data.userId).to.not.exist;
        expect(res.body.data.nameHash).to.not.exist;
        expect(res.body.data.__v).to.not.exist;
    
    }
    
    
    function verifySuccess(res) {
        expect(res).to.have.status(200);
        expect(res.body.status).to.be.eql('SUCCESS');
        expect(res.body.data).has.length.greaterThan(0)
        expect(res.body.data[0]._id).exist;
        expect(res.body.data[0].createdAt).exist;
        expect(res.body.data[0].tenantId).to.not.exist;
        expect(res.body.data[0].userId).to.not.exist;
        expect(res.body.data[0].nameHash).to.not.exist;
        expect(res.body.data.__v).to.not.exist;
    }


    function verifyCreated(res) {
        expect(res).to.have.status(201);
        expect(res.body.status).to.be.eql('CREATED');
        expect(res.body.data._id).exist;
        expect(res.body.data.createdAt).exist;
        expect(res.body.data.tenantId).to.not.exist;
        expect(res.body.data.userId).to.not.exist;
        expect(res.body.data.nameHash).to.not.exist;
        expect(res.body.data.__v).to.not.exist;
    }


    function verifyFailed(res) {
        expect(res).to.have.status(400);
        expect(res.body.status).to.be.eql('FAILED_VALIDATION');
        expect(res.body.data._id).to.not.exist
    }


    function verifyCreateMultiple(res) {
        expect(res.body.data[1].secret.originalFileName).exist;
        expect(res.body.data[1].secret.originalFileName).to.be.eql('anotherDummyfile.txt');
        expect(res.body.data[1].secret.fileName).exist;
        expect(res.body.data[1].secret.fileSize).exist;
        expect(res.body.data[1].secret.fileExtension).exist;
        expect(res.body.data[1]._id).exist;
        expect(res.body.data[1].tenantId).to.not.exist;
        expect(res.body.data[1].userId).to.not.exist;
        expect(res.body.data[1].nameHash).to.not.exist;
        expect(res.body.data[0].__v).to.not.exist;
    }

    
    describe('Create Folder API Request', () => {

        var path = '/v1/user/create_folder';

        it('should create a folder with a folder name', async () => {
            await chai.request(app)
                .post(path)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)
                });
        });

        it('should return an error message if folder name was not given', async () => {
            await chai.request(app)
                .post(path)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "" })
                .then(res => {
                    verifyFailed(res)
                    expect(res.body.data[0].constraints).to.be.eql({
                        "isNotEmpty": "folderName is required",
                        "length": "folderName should be between 1 and 100 characters"
                    })
                });
        });


        it('should create a sub-folder if valid existing folder id was provided as the parent folder Id', async () => {

            var parentFolderId = '';

            await chai.request(app)
                .post(path)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)

                    parentFolderId = res.body.data._id;
                });

            return await chai.request(app)
                .post(path)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My other folder", parentFolderId: parentFolderId })
                .then(res => {
                    verifyCreated(res)
                    expect(res.body.data.parents).to.be.eql([parentFolderId])

                });

        });


        
        it('should successfully copy the sharing detail of folder a subfolder was created in', async () => {

            var parentFolderId = '';
            let folderSharingDetails;

            await chai.request(app)
                .post(path)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)
                    folderSharingDetails = res.body.data.secret.sharing;
                    parentFolderId = res.body.data._id;
                });

            return await chai.request(app)
                .post(path)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My other folder", parentFolderId: parentFolderId })
                .then(res => {
                    verifyCreated(res)
                    expect(res.body.data.secret.sharing).to.be.eql(folderSharingDetails)
                    expect(res.body.data.parents).to.be.eql([parentFolderId])

                });

        });


        it('should return validation error if same folder name already exists', async () => {
            await chai.request(app)
                .post(path)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)
                });

            return await chai.request(app)
                .post(path)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyFailed(res)
                    expect(res.body.data[0].constraints).to.be.eql({ "unique": "must be unique" })
                });
        })


        it('should return validation error if sub-folder name already exists in parent folder', async () => {

            var folderId = '';

            await chai.request(app)
                .post(path)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)
                    folderId = res.body.data._id;
                });

            await chai.request(app)
                .post(path)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My Another folder", parentFolderId: folderId })
                .then(res => {
                    verifyCreated(res)
                });

            return await chai.request(app)
                .post(path)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My Another folder", parentFolderId: folderId })
                .then(res => {
                    verifyFailed(res)
                    expect(res.body.data[0].constraints).to.be.eql({ "unique": "must be unique" })
                });

        });

        it('should return validation error if folder id is invalid', async () => {
            return await chai.request(app)
                .post(path)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder", parentFolderId: '00000f000f000fb40f000001' })
                .then(res => {
                    verifyFailed(res)
                    expect(res.body.data[0].constraints).to.be.eql({ "invalid": "Selected folder is invalid" })
                });
        });

    })



    describe('List Folders API Request', () => {

        var path1 = '/v1/user/create_folder';
        var path2 = '/v1/user/list_folders';
        var path3 = '/v1/user/list_folders?id='
        var folderId;

        it('should fetch created folders successfully', async () => {

            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)
                    folderId = res.body.data._id
                });

            return await chai.request(app)
                .get(path2)
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    verifySuccess(res)
                });
        });


        it('should list sub-folders successfully', async () => {

            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)
                    folderId = res.body.data._id
                });

            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My Another folder", parentFolderId: folderId })
                .then(res => {
                    verifyCreated(res)
                });

            return await chai.request(app)
                .get(path3 + folderId)
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    verifySuccess(res)
                    expect(res.body.data[0].secret.folderName).to.be.eql('My Another folder');
                })
        })


        it('should return an empty array if a folder exists but has no content', async () => {
            return await chai.request(app)
                .get(path2)
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res.body.data).to.eql([]);
                });
        })

    })



    describe('Delete Folder API Request', () => {

        let path1 = '/v1/user/create_folder';
        let path2 = '/v1/user/delete_folder/';
        let path3 = '/v1/user/upload_file'
        let parentFolderId;
        let subparentFolderId;
        let anotherSubParentFolderId;

        it('should delete a folder successfully', async () => {

            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)
                    parentFolderId = res.body.data._id
                });

            return await chai.request(app)
                .delete(path2 + parentFolderId)
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(204)
                });
        });


        it('should delete a folder and nested sub-folders successfully', async () => {

            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)
                    parentFolderId = res.body.data._id
                });

            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "sub folder", parentFolderId: parentFolderId })
                .then(res => {
                    verifyCreated(res)
                    expect(res.body.data.parents).to.be.eql([parentFolderId])
                    subparentFolderId = res.body.data._id
                });

            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "sub folder of sub folder", parentFolderId: subparentFolderId })
                .then(res => {
                    verifyCreated(res)
                    expect(res.body.data.parents).to.be.eql([parentFolderId, subparentFolderId])
                });

            return await chai.request(app)
                .delete(path2 + parentFolderId)
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(204)
                })
        })


        it('should delete a folder and the file in it successfully', async () => {


            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)
                    parentFolderId = res.body.data._id;
                });

            await chai.request(app)
                .post(path3)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .field("folderId", parentFolderId)
                .then(res => {
                    verifyFileCreated(res)
                    expect(res.body.data[0].folderId).to.be.eql(parentFolderId)
                    expect(res.body.data[0].parents).to.be.eql([parentFolderId])
                });

            return await chai.request(app)
                .delete(path2 + parentFolderId)
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(204)
                })
        })


        it('should successfully delete a folder that has sub-folders having files in them ', async () => {

            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)
                    parentFolderId = res.body.data._id
                });

            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My Another folder", parentFolderId: parentFolderId })
                .then(res => {
                    verifyCreated(res)
                    expect(res.body.data.parents).to.be.eql([parentFolderId])
                    subparentFolderId = res.body.data._id
                });

            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "Yet Another folder", parentFolderId: parentFolderId })
                .then(res => {
                    verifyCreated(res)
                    expect(res.body.data.parents).to.be.eql([parentFolderId])
                    anotherSubParentFolderId = res.body.data._id
                });

            await chai.request(app)
                .post(path3)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .field("folderId", subparentFolderId)
                .then(res => {
                    verifyFileCreated(res)
                    expect(res.body.data[0].folderId).to.be.eql(subparentFolderId)
                    expect(res.body.data[0].parents).to.be.eql([parentFolderId, subparentFolderId])
                });

            await chai.request(app)
                .post(path3)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .field("folderId", anotherSubParentFolderId)
                .then(res => {
                    verifyFileCreated(res)
                    expect(res.body.data[0].folderId).to.be.eql(anotherSubParentFolderId)
                    expect(res.body.data[0].parents).to.be.eql([parentFolderId, anotherSubParentFolderId])
                });

            return await chai.request(app)
                .delete(path2 + parentFolderId)
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(204)
                })
        })

        it('should return Failed Validation for invalid folder Id', async () => {
            return await chai.request(app)
                .delete(path2 + "invalidId")
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    verifyFailed(res)
                    expect(res.body.data[0]).to.be.eql("Sorry you cannot delete this folder")
                });
        })

    })




    describe('Folder Share API Request', () => {

        var path1 = "/v1/user/create_folder"
        var path2 = "/v1/user/share_folder/"
        var path3 = "/v1/user/folder_shared_with_me/all"
        var path4 = "/v1/user/folder_shared_with_me/"
        let path5 = "/v1/user/share/"

        var data = {
            "shared_with": [email, email1],
            "baseUrl": "https://www.photizzo.com",
            "shareType": "private",
            "comment": "hello My people"
        }




        function share(res) {
            expect(res).to.have.status(200);
            expect(res.body.status).to.be.eql('SUCCESS');
            expect(res.body.data[0]).to.be.eql("The share was successful")

        }

        it('should store data for a shared folder', async () => {

            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data._id;
                });


            return await chai.request(app)
                .put(path2 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    share(res)
                });

        })


        it('should not store duplicate recipients', async () => {


            var data1 = {
                "shared_with": [email, email1],
                "baseUrl": "https://www.photizzo.com",
                "shareType": "private",
                "comment": "hello My people"
            }

            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data._id;
                });


            await chai.request(app)
                .put(path2 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    share(res)
                });

            return await chai.request(app)
                .put(path2 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data1)
                .then(res => {
                    share(res)
                })

        })



        it('should store data without comment for a shared folder', async () => {

            var data = {
                "shared_with": [email1],
                "baseUrl": "https://www.photizzo.com",
                "shareType": "private",
            }

            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data._id;
                });


            return await chai.request(app)
                .put(path2 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    share(res)
                });

        })



        it('should return an error message when a user enters an invalid shareType', async () => {

            var data = {
                "shared_with": ["tester@test.quabbly.com"],
                "baseUrl": "www.photizzo.com",
                "shareType": "priv",
                "comment": "hello My people"
            }
            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data._id;
                });


            return await chai.request(app)
                .put(path2 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    expect(res).to.have.status(400);
                    expect(res.body.status).to.be.eql('FAILED_VALIDATION');
                    expect(res.body.data[0].property).to.be.eql("shareType");
                    expect(res.body.data[0].constraints.isIn).to.be.eql(
                        "shareType must be one of the following values: public,private"
                    );
                    expect(res.body.data[0].value).to.be.eql(data.shareType);
                })

        });


        it('should return an error message when a user enters an invalid baseUrl', async () => {

            var data = {
                "shared_with": ["tester@test.quabbly.com"],
                "baseUrl": "https:/photizzo",
                "shareType": "private",
                "comment": "hello My people"
            }

            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data._id;
                });


            return await chai.request(app)
                .put(path2 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    expect(res).to.have.status(400);
                    expect(res.body.status).to.be.eql('FAILED_VALIDATION');
                    expect(res.body.data[0].property).to.be.eql("baseUrl");
                    expect(res.body.data[0].constraints.isUrl).to.be.eql(
                        "baseUrl must be an URL address"
                    );
                    expect(res.body.data[0].value).to.be.eql(data.baseUrl);
                })

        });


        it('should return an error message when a user enters a comment not up to 3 characters', async () => {

            var data = {
                "shared_with": ["chekphotizzo@gmail.com"],
                "baseUrl": "https://www.photizzo.com",
                "shareType": "private",
                "comment": "he"
            }
            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data._id;
                });


            return await chai.request(app)
                .put(path2 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    expect(res).to.have.status(400);
                    expect(res.body.status).to.be.eql('FAILED_VALIDATION');
                    expect(res.body.data[0].property).to.be.eql("comment");
                    expect(res.body.data[0].constraints.length).to.be.eql(
                        "comment must be longer than or equal to 3 characters"
                    );
                    expect(res.body.data[0].value).to.be.eql(data.comment);
                })

        });


        it('should return an error message if shared_with is not an array', async () => {

            var data = {
                "shared_with": "chekphotizzo@gmail.com",
                "baseUrl": "https://www.photizzo.com",
                "shareType": "private"
            }
            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data._id;
                });


            return await chai.request(app)
                .put(path2 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    expect(res).to.have.status(400);
                    expect(res.body.status).to.be.eql('FAILED_VALIDATION');
                    expect(res.body.data[0].property).to.be.eql("shared_with");
                    expect(res.body.data[0].constraints.isArray).to.be.eql(
                        "shared_with must be an array"
                    );
                    expect(res.body.data[0].value).to.be.eql(data.shared_with);
                })

        });


        it('should return an error message when the shareType is not given', async () => {

            var data = {
                "shared_with": ["tester@test.quabbly.com"],
                "baseUrl": "www.photizzo.com",

                "comment": "hello My people"
            }
            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data._id;
                });


            return await chai.request(app)
                .put(path2 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    expect(res).to.have.status(400);
                    expect(res.body.status).to.be.eql('FAILED_VALIDATION');
                    expect(res.body.data[0].property).to.be.eql("shareType");
                    expect(res.body.data[0].constraints.isNotEmpty).to.be.eql(
                        "shareType is required"
                    );
                    expect(res.body.data[0].value).to.not.exist;
                })

        });




        it('should return an error message when the recipient is not given', async () => {

            var data = {

                "baseUrl": "www.photizzo.com",
                "shareType": "priv",
                "comment": "hello My people"
            }
            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data._id;
                });


            return await chai.request(app)
                .put(path2 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    expect(res).to.have.status(400);
                    expect(res.body.status).to.be.eql('FAILED_VALIDATION');
                    expect(res.body.data[0].property).to.be.eql("shared_with");
                    expect(res.body.data[0].constraints.isNotEmpty).to.be.eql(
                        "file must be shared with at least one recipient"
                    );
                    expect(res.body.data[0].value).to.not.exist;
                })

        });


        it('should return an error message when the baseUrl is not given', async () => {

            var data = {
                "shared_with": ["tester@test.quabbly.com"],

                "shareType": "priv",
                "comment": "hello My people"
            }
            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data._id;
                });


            return await chai.request(app)
                .put(path2 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    expect(res).to.have.status(400);
                    expect(res.body.status).to.be.eql('FAILED_VALIDATION');
                    expect(res.body.data[0].property).to.be.eql("baseUrl");
                    expect(res.body.data[0].constraints.isNotEmpty).to.be.eql(
                        "baseUrl is required"
                    );
                    expect(res.body.data[0].value).to.not.exist
                })

        });



        it('should list private folder shared with me', async () => {

            var data = {
                "shared_with": [email],
                "baseUrl": "https://www.photizzo.com",
                "shareType": "private",
                "comment": "hello My people"
            }

            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data._id;
                });


            await chai.request(app)
                .put(path2 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    share(res)

                });

            return await chai.request(app)
                .get(path3)
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(200);

                });

        })



        it("should return an error message when there's a recipient not under the tenant", async () => {

            let data = {
                "shared_with": [email1, "chekwube@quabbly.com"],
                "baseUrl": "https://www.photizzo.com",
                "shareType": "private",
            }
            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data._id;
                });


            return await chai.request(app)
                .put(path2 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    expect(res).to.have.status(412);
                    expect(res.body.status).to.be.eql('PRECONDITION_FAILED');
                    expect(res.body.data[0]).to.be.eql(
                        "1 recipient(s) (chekwube@quabbly.com) not under this tenant"
                    );
                })

        });



        it("should share a folder with everyone under a tenant except the owner of the folder", async () => {

            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)
                    id = res.body.data._id;
                });


             await chai.request(app)
                .put(path5 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ doc: "folder" })
                .then(res => {
                    share(res)
                })

            return await chai.request(app)
            .get(path3)
            .set('Authorization', `Bearer ${bearerToken1}`)
            .then(res => {
                expect(res.body.data[0].secret.sharing[0].secret_shared_with).to.be.eql([email1])
            })
        });



    })



    describe("Folder Shared_with_me API", () => {

        var path = "/v1/user/folder_shared_with_me/all"

        it("should successfully list the folder(s) shared with me", async () => {
            return await chai.request(app)
                .get(path)
                .set("Authorization", `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res.body.status).to.be.eql("SUCCESS")

                })

        })

    })


    describe("Download Folder API", () => {
        let path1 = "/v1/user/upload_file"
        let path2 = "/v1/user/create_folder"
        let path3 = "/v1/user/download_folder/"

        it("should successfully download a zipped folder", async () => {

            let parentFolder = '';
            let subFolderId = ""
            await chai.request(app)
                .post(path2)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "MyFolder" })
                .then(res => {
                    verifyCreated(res)
                    parentFolder = res.body.data._id;
                });

            await chai.request(app)
                .post(path2)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "MyFolder", parentFolderId: parentFolder })
                .then(res => {
                    verifyCreated(res)
                    subFolderId = res.body.data._id;
                });

            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .attach('file', 'src/test/anotherDummyfile.txt')
                .field({ folderId: subFolderId })
                .then(res => {
                    verifyFileCreated(res);
                    verifyCreateMultiple(res)

                });
            const downloadPath = path3 + parentFolder
            return await chai.request(app)
                .get(downloadPath)
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res).to.have.header('content-type', 'application/zip');
                    expect(res).to.have.header('content-disposition', 'attachment; filename="MyFolder.zip"');
                })

        })


        it("should return an error message for folder without a file download attempt", async () => {

            let parentFolder = '';
            
            await chai.request(app)
                .post(path2)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)
                    parentFolder = res.body.data._id;
                });

            let downloadPath = path3 + parentFolder
            return await chai.request(app)
                .get(downloadPath)
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(412);
                    expect(res.body.status).to.be.eql("PRECONDITION_FAILED")
                    expect(res.body.data).to.be.eql(["You are not allowed to download a folder without a file or an invalid folder"])
                })

        })


        it("should return an error message for an imvalid folder download attempt", async () => {

            let parentFolder = '';
            
            await chai.request(app)
                .post(path2)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyCreated(res)
                    parentFolder = res.body.data._id;
                });

            const downloadPath = path3 + "invalidFolder"
            return await chai.request(app)
                .get(downloadPath)
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(412);
                    expect(res.body.status).to.be.eql("PRECONDITION_FAILED")
                    expect(res.body.data).to.be.eql(["You are not allowed to download a folder without a file or an invalid folder"])
                })

        })

    })


    
})


describe('Login A User Under An Organisation', () => {


        var path1 = "/v1/user/create_folder"
        var path2 = "/v1/user/share_folder/"
        var path3 = "/v1/user/folder_shared_with_me/all"
        var path4 = "/v1/user/folder_shared_with_me/"
        let path5 = "/v1/user/upload_file"
        let path6 = "/v1/user/list_files?id="
        let path8 = "/v1/user/list_folders?id="


        var data = {
            "shared_with": [email1],
            "baseUrl": "https://www.photizzo.com",
            "shareType": "private",
            "comment": "hello My people"
        }

        
        function verifyCreated(res) {
            expect(res).to.have.status(201);
            expect(res.body.status).to.be.eql('CREATED');
            expect(res.body.data._id).exist;
            expect(res.body.data.createdAt).exist;
            expect(res.body.data.tenantId).to.not.exist;
            expect(res.body.data.userId).to.not.exist;
            expect(res.body.data.nameHash).to.not.exist;
        }


        function verifyFileCreated(res) {
        expect(res).to.have.status(201);
        expect(res.body.status).to.be.eql('CREATED');
        expect(res.body.data[0].createdAt).exist;
        expect(res.body.data[0].secret.originalFileName).exist;
        expect(res.body.data[0].secret.originalFileName).to.be.eql('dummyfile.txt');
        expect(res.body.data[0].secret.fileName).exist;
        expect(res.body.data[0].secret.fileSize).exist;
        expect(res.body.data[0].secret.fileExtension).exist;
        expect(res.body.data.userId).to.not.exist;
        expect(res.body.data.nameHash).to.not.exist;
        expect(res.body.data.__v).to.not.exist;
    
    }


        function verifySuccess(res) {
            expect(res).to.have.status(200);
            expect(res.body.status).to.be.eql('SUCCESS');
            expect(res.body.data).has.length.greaterThan(0)
            expect(res.body.data[0]._id).exist;
            expect(res.body.data[0].createdAt).exist;
            expect(res.body.data[0].tenantId).to.not.exist;
            expect(res.body.data[0].userId).to.not.exist;
            expect(res.body.data[0].nameHash).to.not.exist;
            expect(res.body.data.__v).to.not.exist;
        }
    


        function share(res) {
            expect(res).to.have.status(200);
            expect(res.body.status).to.be.eql('SUCCESS');
            expect(res.body.data[0]).to.be.eql("The share was successful")

        }

        describe("Folder Shared_with_me API", () => {

            var path = "/v1/user/folder_shared_with_me/all"
            it("should successfully list the folder(s) shared with me", async () => {
                return await chai.request(app)
                    .get(path)
                    .set("Authorization", `Bearer ${bearerToken1}`)
                    .then(res => {
                        expect(res).to.have.status(200);
                        expect(res.body.status).to.be.eql("SUCCESS")

                    })

            })

            it('should list private folder shared with me', async () => {

                let id = '';
                await chai.request(app)
                    .post(path1)
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .send({ folderName: "My folder" })
                    .then(res => {
                        verifyCreated(res)
    
                        id = res.body.data._id;
                    });
    
    
                await chai.request(app)
                    .put(path2 + id)
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .send(data)
                    .then(res => {
                        share(res)
    
                    });
    
                return await chai.request(app)
                    .get(path3)
                    .set('Authorization', `Bearer ${bearerToken1}`)
                    .then(res => {
                        expect(res).to.have.status(200);
    
                    });
    
            })
            
            it('should list shared subfolder(s) successfully', async () => {
                let folderId;
    
                await chai.request(app)
                    .post(path1)
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .send({ folderName: "My folder14" })
                    .then(res => {
                        verifyCreated(res)
                        folderId = res.body.data._id;
                    });
    
    
                await chai.request(app)
                    .put(path2 + folderId)
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .send(data)
                    .then(res => {
                        share(res)
                    });
    
    
                await chai.request(app)
                    .post(path1)
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .send({ folderName: "My Another folder", parentFolderId: folderId })
                    .then(res => {
                        verifyCreated(res)
                        expect(res.body.data.parentFolderId).to.be.eql(folderId)
    
                    });
    
                return await chai.request(app)
                    .get(path4 + folderId)
                    .set('Authorization', `Bearer ${bearerToken1}`)
                    .then(res => {
                        expect(res).to.have.status(200);
                        expect(res.body.status).to.be.eql('SUCCESS');
                        expect(res.body.data).has.lengthOf(1);
                        expect(res.body.data[0]._id).exist;
                        expect(res.body.data[0].secret.folderName).exist;
                        expect(res.body.data[0].secret.folderName).to.be.eql('My Another folder');
                        expect(res.body.data[0].createdAt).exist;
                    });
    
            })


            it('should create a folder inside a shared folder successfully', async () => {
                let folderId;
    
                await chai.request(app)
                    .post(path1)
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .send({ folderName: "My folder24" })
                    .then(res => {
                        verifyCreated(res)
                        folderId = res.body.data._id;
                    });
    
    
                await chai.request(app)
                    .put(path2 + folderId)
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .send(data)
                    .then(res => {
                        share(res)
                    });
    
    
               return await chai.request(app)
                    .post(path1)
                    .set('Authorization', `Bearer ${bearerToken1}`)
                    .send({ folderName: "My Another folder", parentFolderId: folderId })
                    .then(res => {
                        share(res)
    
                    });
    
            })




            it('should successfully list a shared subfolder even if the folder is unshared', async () => {
                let folderId;
                let id;

                await chai.request(app)
                    .post(path1)
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .send({ folderName: "My folder24" })
                    .then(res => {
                        verifyCreated(res)
                        folderId = res.body.data._id;
                    });


                await chai.request(app)
                    .post(path1)
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .send({ folderName: "My Another folder", parentFolderId: folderId })
                    .then(res => {
                        verifyCreated(res)
                        id = res.body.data._id
                    });

                await chai.request(app)
                    .put(path2 + id)
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .send(data)
                    .then(res => {
                        share(res)
                    });

                return await chai.request(app)
                    .get(path3)
                    .set('Authorization', `Bearer ${bearerToken1}`)
                    .then(res => {
                        verifySuccess(res)
                        expect(res.body.data[0].sharedFolder).to.be.eql(true)
                    });

            })

            

            it('subfolder created in a shared folder by a recipient should be seen by the owner of the folder', async () => {
                let folderId;
    
                await chai.request(app)
                    .post(path1)
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .send({ folderName: "MyFolder" })
                    .then(res => {
                        verifyCreated(res)
                        folderId = res.body.data._id;
                    });
    
    
                await chai.request(app)
                    .put(path2 + folderId)
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .send(data)
                    .then(res => {
                        share(res)
                    });
    
    
                await chai.request(app)
                    .post(path1)
                    .set('Authorization', `Bearer ${bearerToken1}`)
                    .send({ folderName: "My Another folder", parentFolderId: folderId })
                    .then(res => {
                        share(res)
    
                    });

                await chai.request(app)
                .get(path8 + folderId)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    verifySuccess(res)
                    expect(res.body.data[0].secret.folderName).to.be.eql("My Another folder" )
                });


                return  await chai.request(app)
                .get(path8 + folderId)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    verifySuccess(res)
                    expect(res.body.data[0].secret.folderName).to.be.eql("My Another folder" )
                });
    
            })


            it('subfolder created in a shared folder by a recipient should also be opened by the owner of the folder', async () => {
                let folderId;
                let subFolderId 
    
                await chai.request(app)
                    .post(path1)
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .send({ folderName: "MyFolder" })
                    .then(res => {
                        verifyCreated(res)
                        folderId = res.body.data._id;
                    });
    
    
                await chai.request(app)
                    .put(path2 + folderId)
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .send(data)
                    .then(res => {
                        share(res)
                    });
    
    
                await chai.request(app)
                    .post(path1)
                    .set('Authorization', `Bearer ${bearerToken1}`)
                    .send({ folderName: "My Another folder", parentFolderId: folderId })
                    .then(res => {
                        share(res)
                        subFolderId= res.body.data[1]
                    });

                await chai.request(app)
                .get(path8 + folderId)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    verifySuccess(res)
                    expect(res.body.data[0].secret.folderName).to.be.eql("My Another folder" )
                });


                return  await chai.request(app)
                .get(path8 + subFolderId)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    expect(res).to.have.status(200)
                    expect(res.body.status).to.be.eql("SUCCESS" )
                    expect(res.body.data).to.be.eql([])
                });
    
            })
        

        
        it('files created in a shared folder by a recipient should be seen by the owner of the folder', async () => {
            let folderId;

            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "MyFolder" })
                .then(res => {
                    verifyCreated(res)
                    folderId = res.body.data._id;
                });


            await chai.request(app)
                .put(path2 + folderId)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    share(res)
                });


            await chai.request(app)
                .post(path5)
                .set('Authorization', `Bearer ${bearerToken1}`)
                .attach('file', 'src/test/dummyfile.txt')
                .attach('file', 'src/test/anotherDummyfile.txt')
                .field("folderId", folderId)
                .then(res => {
                    share(res)
                });


           return await chai.request(app)
            .get(path6 + folderId)
            .set('Authorization', `Bearer ${bearerToken}`)
            .send(data)
            .then(res => {
                verifySuccess(res)
                expect(res.body.data[0].secret.originalFileName).to.be.eql("dummyfile.txt" )
                expect(res.body.data[1].secret.originalFileName).to.be.eql("anotherDummyfile.txt" )
            });

        })
    })
})










