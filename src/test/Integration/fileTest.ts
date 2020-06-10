
import { Server } from '../../server';
import * as chai from 'chai';
import chaiHttp = require('chai-http');
import 'mocha';
import { expect } from 'chai';
import mongoose = require("mongoose");
import { IUploadModel } from '../../models/userUpload';
import { UploadSchema } from '../../schemas/file';
import { FolderSchema } from '../../schemas/folder';
import { IFolderModel } from '../../models/userFolder';
import crypto = require('crypto');




process.env.DB_NAME = 'filemanager_test';
process.env.UPLOAD_MAX_NUMBER_FILES;

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
let email1 = `${firstname}${firstname}${lastname}@test.quabbly.com`;
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

let file = connection.model<IUploadModel>("File", UploadSchema);
let folder = connection.model<IFolderModel>("Folder", FolderSchema);

var clearDB = function (done) {

    file.deleteMany(function () {
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

describe('Test for all file operations', () => {

    function verifyCreated(res) {
        expect(res).to.have.status(201);
        expect(res.body.status).to.be.eql('CREATED');
        expect(res.body.data[0].createdAt).exist;
        expect(res.body.data[0].secret.originalFileName).exist;
        expect(res.body.data[0].secret.originalFileName).to.be.eql('dummyfile.txt');
        expect(res.body.data[0].secret.fileName).exist;
        expect(res.body.data[0].secret.fileSize).exist;
        expect(res.body.data[0].secret.fileExtension).exist;
        expect(res.body.data[0].tenantId).to.not.exist;
        expect(res.body.data[0].userId).to.not.exist;
        expect(res.body.data[0].nameHash).to.not.exist;
        expect(res.body.data[0].__v).to.not.exist;
    }


    function verifySuccess(res) {
        expect(res).to.have.status(200);
        expect(res.body.status).to.be.eql('SUCCESS');
        expect(res.body.data[0].secret.originalFileName).exist;
        expect(res.body.data[0].secret.originalFileName).to.be.eql('dummyfile.txt');
        expect(res.body.data[0].secret.fileName).exist;
        expect(res.body.data[0].secret.fileSize).exist;
        expect(res.body.data[0].secret.fileExtension).exist;
        expect(res.body.data[0].tenantId).to.not.exist;
        expect(res.body.data[0].userId).to.not.exist;
        expect(res.body.data[0].nameHash).to.not.exist;
        expect(res.body.data[0].__v).to.not.exist;
    }

    
    function verifyFolderCreated(res) {
        expect(res).to.have.status(201);
        expect(res.body.status).to.be.eql('CREATED');
        expect(res.body.data._id).exist;
        expect(res.body.data.createdAt).exist;
        expect(res.body.data.tenantId).to.not.exist;
        expect(res.body.data.userId).to.not.exist;
        expect(res.body.data.nameHash).to.not.exist;
        expect(res.body.data.__v).to.not.exist;
    }

    function verifyCreateMultiple(res) {
        expect(res).to.have.status(201);
        expect(res.body.status).to.be.eql('CREATED');
        expect(res.body.data[1].createdAt).exist;
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
    

    const data = {
        "shared_with": [email, email1],
        "baseUrl": "https://www.photizzo.com",
        "shareType": "private",
        "comment": "hello My people"
    }


    function share(res) {
        expect(res).to.have.status(200);
        expect(res.body.status).to.be.eql('SUCCESS');
        expect(res.body.data[0]).to.be.eql( "The share was successful")
    }

    const path1 = '/v1/user/upload_file';
    const path2 = '/v1/user/create_folder';

    describe('File Upload API Request', () => {

        it('should upload a file successfully', async () => {

            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .then(res => {
                    verifyCreated(res);

                });
        });

        it('should upload multiple files successfully', async () => {

            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .attach('file', 'src/test/anotherDummyfile.txt')
                .then(res => {
                    verifyCreated(res);
                    verifyCreateMultiple(res)

                });
        });




        it('should copy the sharing detail of folder a file was uploaded into successfully', async () => {
            let idOfFolderUploadedInto;
            let folderSharingDetails;

            await chai.request(app)
                .post(path2)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder" })
                .then(res => {
                    verifyFolderCreated(res)
                    idOfFolderUploadedInto = res.body.data._id;
                    folderSharingDetails = res.body.data.secret.sharing;
                });

            return await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .field("folderId", idOfFolderUploadedInto)
                .then(res => {
                    verifyCreated(res);
                    expect(res.body.data[0].secret.sharing).to.be.eql(folderSharingDetails)
                    expect(res.body.data[0].folderId).to.be.eql(idOfFolderUploadedInto)
                    expect(res.body.data[0].parents).to.be.eql([idOfFolderUploadedInto])
                });

        })


        it('should upload a file into a folder successfully', async () => {
            let idOfFolderUploadedInto;

            await chai.request(app)
            .post(path2)
            .set('Authorization', `Bearer ${bearerToken}`)
            .send({ folderName: "My folder123" })
            .then(res => {
                verifyFolderCreated(res)
                idOfFolderUploadedInto = res.body.data._id;
            });

            return await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .field("folderId", idOfFolderUploadedInto)
                .then(res => {
                    verifyCreated(res);
                    expect(res.body.data[0].folderId).to.be.eql(idOfFolderUploadedInto)
                    expect(res.body.data[0].parents).to.be.eql([idOfFolderUploadedInto])
                });

        })

        it('should upload multiple files into a folder successfully', async () => {
            let idOfFolderUploadedInto;

            await chai.request(app)
                .post(path2)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder2" })
                .then(res => {
                    verifyFolderCreated(res)
                    idOfFolderUploadedInto = res.body.data._id;
                });

            return await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .attach('file', 'src/test/anotherDummyfile.txt')
                .field("folderId", idOfFolderUploadedInto)
                .then(res => {
                    verifyCreated(res);
                    expect(res.body.data[0].folderId).to.be.eql(idOfFolderUploadedInto)
                    expect(res.body.data[0].parents).to.be.eql([idOfFolderUploadedInto])
                    expect(res.body.data[1].folderId).to.be.eql(idOfFolderUploadedInto)
                    expect(res.body.data[1].parents).to.be.eql([idOfFolderUploadedInto])
                });

        })




        // it('should not accept a file more than 1MB', async () => {
        //     return await chai.request(app)
        //     .post(path1)
        //     .set('Authorization', `Bearer ${bearerToken}`)
        //     .attach('file', 'src/test/large_file.png')
        //     .then(res => {
        //         expect(res).to.have.status(400);
        //         expect(res.body.status).to.be.eql('FAILED_VALIDATION');
        //         expect(res.body.data.field).to.be.eql('file');
        //         expect(res.body.data.errorMessage).to.be.eql('file must not exceed 1MB');
        //     });
        // })

        it('should return an error if no file was sent', async () => {
            return await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(400);
                    expect(res.body.status).to.be.eql('FAILED_VALIDATION');
                    expect(res.body.data.field).to.be.eql('file');
                    expect(res.body.data.errorMessage).to.be.eql('no file uploaded');

                });
        })

    })



    describe('List File API Request', () => {
        const path4 = '/v1/user/list_files';
        const path3 = '/v1/user/list_files?id='

        it('should list the root file(s) successfully', async () => {
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .then(res => {
                    verifyCreated(res);
                });

            return await chai.request(app)
                .get(path4)
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    verifySuccess(res)
                });
        })


        it('should list folder file(s) successfully', async () => {
            var folderId;

            await chai.request(app)
                .post(path2)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder1" })
                .then(res => {
                    verifyFolderCreated(res)
                    folderId = res.body.data._id;
                });

            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .field("folderId", folderId)
                .then(res => {
                    verifyCreated(res);
                    expect(res.body.data[0].folderId).to.be.eql(folderId)
                });

            return await chai.request(app)
                .get(path3 + folderId)
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    verifySuccess(res)
                });
        })


        it('should return no content if there are no files', async () => {
            return await chai.request(app)
                .get(path4)
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res.body.data).to.eql([]);
                });
        })
    })



    describe('Rename File API Request', () => {
        var path2 = "/v1/user/rename_file/";

        it('should rename file successfully if new name is the same as old name', async () => {
            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .then(res => {
                    verifyCreated(res);
                    id = res.body.data[0]._id;
                });


            return await chai.request(app)
                .put(path2 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ originalFileName: "dummyfile.txt" })
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res.body.status).to.be.eql('SUCCESS');
                });

        })

        it('should rename file successfully if new name is different from old name', async () => {
            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .then(res => {
                    verifyCreated(res);

                    id = res.body.data[0]._id;
                });


            return await chai.request(app)
                .put(path2 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ originalFileName: "newfilename.txt" })
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res.body.status).to.be.eql('SUCCESS');
                });
        })
    })


    describe('File Share API Request', () => {
        const path2 = "/v1/user/share_file/"
        const path3 = "/v1/user/download_shared_file/"
        const path4 = "/v1/user/view_shared_file/"
        const path5 = "/v1/user/share/"
        const path6 = "/v1/user/file_shared_with_me/"

        it('should store data for a shared file', async () => {

            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data[0]._id;
                
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

            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .then(res => {
                    verifyCreated(res)
                    id = res.body.data[0]._id;
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
                .send(data)
                .then(res => {
                    share(res)
                })

        })



        it('should store data without comment for a shared file', async () => {

            var data = {
                "shared_with": [email1],
                "baseUrl": "https://www.photizzo.com",
                "shareType": "private",
            }

            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data[0]._id;
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
                .attach('file', 'src/test/dummyfile.txt')
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data[0]._id;
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
                .attach('file', 'src/test/dummyfile.txt')
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data[0]._id;
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
                "shared_with": ["tester@test.quabbly.com"],
                "baseUrl": "https://www.photizzo.com",
                "shareType": "private",
                "comment": "he"
            }
            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data[0]._id;
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
                "shared_with": "tester@test.quabbly.com",
                "baseUrl": "https://www.photizzo.com",
                "shareType": "private"
            }
            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data[0]._id;
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
                .attach('file', 'src/test/dummyfile.txt')
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data[0]._id;
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
                .attach('file', 'src/test/dummyfile.txt')
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data[0]._id;
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
                .attach('file', 'src/test/dummyfile.txt')
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data[0]._id;
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



        it('should download a shared private file', async () => {
            var data = {
                "shared_with": [email],
                "baseUrl": "https://www.photizzo.com",
                "shareType": "private",
                "comment": "hello My people"
            }
            function share(res) {
                expect(res).to.have.status(200);
                expect(res.body.status).to.be.eql('SUCCESS');
                expect(res.body.data[0]).to.be.eql("The share was successful")
            }

            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data[0]._id;
                });


            await chai.request(app)
                .put(path2 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    share(res)
                });


            return await chai.request(app)
                .get(path3 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res).to.have.header('content-type', 'application/octet-stream');
                    expect(res).to.have.header('content-disposition', 'attachment; filename="dummyfile.txt"');
                });

        })

        it('should return validation error if file not found', async () => {
            return await chai.request(app)
                .get(path3 + 'invalidFile')
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(404);
                    expect(res.body.status).to.be.eql('NOT_FOUND');
                });
        })


        it('should return validation error if file not found', async () => {
            return await chai.request(app)
                .get(path3 + 'invalidFile')
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(404);
                    expect(res.body.status).to.be.eql('NOT_FOUND');
                });
        })



        it('should view a shared private file', async () => {

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
                .attach('file', 'src/test/dummyfile.txt')
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data[0]._id;
                });


            await chai.request(app)
                .put(path2 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    share(res)

                });

            return await chai.request(app)
                .get(path4 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res).to.have.header('content-type', 'application/octet-stream');
                });

        })

        it('should return validation error if file not found', async () => {
            return await chai.request(app)
                .get(path4 + 'invalidFile')
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(404);
                    expect(res.body.status).to.be.eql('NOT_FOUND');
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
                .attach('file', 'src/test/dummyfile.txt')
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data[0]._id;
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



        it("should share a file with everyone under a tenant except the owner of the file", async () => {

            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .then(res => {
                    verifyCreated(res);
                    id = res.body.data[0]._id;
                });


            await chai.request(app)
                .put(path5 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ doc: "file" })
                .then(res => {
                    share(res);
                })


            return await chai.request(app)
                .get(path6 + "all")
                .set('Authorization', `Bearer ${bearerToken1}`)
                .then(res => {
                    expect(res.body.data[0].secret.sharing[0].secret_shared_with).to.be.eql([email1])
                })
        });

    })


    describe('User File Download API Request', () => {
        const path2 = '/v1/user/download_file/';

        it('should successfully download a file which was uploaded', async () => {
            var uploadedFileId = '';

            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .then(res => {
                    verifyCreated(res);
                    uploadedFileId = res.body.data[0]._id;
                });

            return await chai.request(app)
                .get(path2 + uploadedFileId)
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res).to.have.header('content-type', 'application/octet-stream');
                    expect(res).to.have.header('content-disposition', 'attachment; filename="dummyfile.txt"');
                });
        });


        it('should return validation error if file not found', async () => {
            return await chai.request(app)
                .get(path2 + 'invalidFile')
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(404);
                    expect(res.body.status).to.be.eql('NOT_FOUND');
                });
        })


    })



    describe('View User File API Request', () => {
        var path2 = '/v1/user/view_file/';

        it('should successfully display a file which was uploaded', async () => {
            var uploadedFileId = '';

            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .then(res => {
                    verifyCreated(res);

                    uploadedFileId = res.body.data[0]._id;
                });

            return await chai.request(app)
                .get(path2 + uploadedFileId)
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res).to.have.header('content-type', 'application/octet-stream');
                });
        });


        it('should return validation error if file not found', async () => {
            return await chai.request(app)
                .get(path2 + 'invalidFile')
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(404);
                    expect(res.body.status).to.be.eql('NOT_FOUND');
                });
        })


    })




    describe("File Shared_with_me API", () => {

        const path = "/v1/user/file_shared_with_me/all"

        it("should successfully list the files shared to self shared with me", async () => {
            return await chai.request(app)
                .get(path)
                .set("Authorization", `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res.body.status).to.be.eql("SUCCESS")

                })

        })

    })

    describe("Move File EndPoint", () => {
        const path = "/v1/user/move_file/"

        it("should move a root file to a folder", async () => {
            let folderId = "";
            let fileId = "";
            await chai.request(app)
                .post(path1)
                .set("Authorization", `Bearer ${bearerToken}`)
                .attach("file", "src/test/dummyfile.txt")
                .then(res => {
                    verifyCreated(res)
                    fileId = res.body.data[0]._id;
                })


            await chai.request(app)
                .post(path2)
                .set("Authorization", `Bearer ${bearerToken}`)
                .send({ folderName: "My Folder" })
                .then(res => {
                    verifyFolderCreated(res);
                    folderId = res.body.data._id
                })

            return await chai.request(app)
                .put(path + fileId)
                .set("Authorization", `Bearer ${bearerToken}`)
                .send({ id: folderId })
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res.body.status).to.be.eql('SUCCESS');
                    expect(res.body.data.createdAt).exist;
                    expect(res.body.data.folderId).to.be.eql(folderId);
                    expect(res.body.data.secret.originalFileName).to.be.eql('dummyfile.txt');
                    expect(res.body.data.secret.fileName).exist;
                    expect(res.body.data.secret.fileSize).exist;
                    expect(res.body.data.secret.fileExtension).exist;
                    expect(res.body.data.folderId).to.be.eql(folderId)
                    expect(res.body.data.tenantId).to.not.exist;
                    expect(res.body.data.userId).to.not.exist;
                    expect(res.body.data.nameHash).to.not.exist;
                    expect(res.body.data.__v).to.not.exist;
                })
        })


    })

    describe("Delete Endpoint", ()=>{
        let path = "/v1/user/delete_file/";
        
        it("should delete a file by id", async()=>{
            let fileId = "";
            await chai.request(app)
            .post(path1)
            .set('Authorization', `Bearer ${bearerToken}`)
            .attach("file", "src/test/dummyfile.txt")
            .then(res =>{
                verifyCreated(res)
                fileId = res.body.data[0]._id
            })

            return await chai.request(app)
            .delete(path + fileId)
            .set('Authorization', `Bearer ${bearerToken}`)
            .then(res =>{
                expect(res).to.have.status(204)
            })
        })


        it("should return validation error for invalid file", async()=>{
            let fileId = "";
            await chai.request(app)
            .post(path1)
            .set('Authorization', `Bearer ${bearerToken}`)
            .attach("file", "src/test/dummyfile.txt")
            .then(res =>{
                verifyCreated(res)
                fileId = res.body.data._id
            })
        
            return await chai.request(app)
            .delete(path + "invalidFile")
            .set('Authorization', `Bearer ${bearerToken}`)
            .then(res =>{
                expect
                expect(res).to.have.status(400)
                expect(res.body.status).to.be.eql('FAILED_VALIDATION');
                expect(res.body.data[0]).to.be.eql("Sorry you cannot delete this file")
            })
        })
        

    })


    // describe("Testing for uploads folder", () => {
    //     it("Confirm that uploads folder exists", async () => {
    //         expect(fs.existsSync('C:/Users/Chekwube/upload_file/filemanager-api/private/uploads')).to.be.true

    //     })
    // })



    

})


describe('Login A User Under An Organisation', () => {

    
        let path1 = "/v1/user/upload_file/"
        let path2 = "/v1/user/share_file/"
        let path3 = "/v1/user/download_shared_file/"
        let path4 = "/v1/user/view_shared_file/"
        let path5 = "/v1/user/create_folder"
        let path6 = "/v1/user/file_shared_with_me/" 
        let path8 = "/v1/user/share_folder/"
        let path9 = "/v1/user/delete_file/"

        let data = {
            "shared_with": [email1],
            "baseUrl": "https://www.photizzo.com",
            "shareType": "private",
            "comment": "hello My people"
        }


        function verifyCreated(res) {
            expect(res).to.have.status(201);
            expect(res.body.status).to.be.eql('CREATED');
            expect(res.body.data[0].createdAt).exist;
            expect(res.body.data[0].secret.originalFileName).exist;
            expect(res.body.data[0].secret.originalFileName).to.be.eql('dummyfile.txt');
            expect(res.body.data[0].secret.fileName).exist;
            expect(res.body.data[0].secret.fileSize).exist;
            expect(res.body.data[0].secret.fileExtension).exist;
            expect(res.body.data[0].tenantId).to.not.exist;
            expect(res.body.data[0].userId).to.not.exist;
            expect(res.body.data[0].nameHash).to.not.exist;
            expect(res.body.data[0].__v).to.not.exist;
        }

        function share(res) {
            expect(res).to.have.status(200);
            expect(res.body.status).to.be.eql('SUCCESS');
            expect(res.body.data[0]).to.be.eql("The share was successful")

        }
        function verifyFolderCreated(res) {
            expect(res).to.have.status(201);
            expect(res.body.status).to.be.eql('CREATED');
            expect(res.body.data._id).exist;
            expect(res.body.data.createdAt).exist;
            expect(res.body.data.tenantId).to.not.exist;
            expect(res.body.data.userId).to.not.exist;
            expect(res.body.data.nameHash).to.not.exist;
            expect(res.body.data.__v).to.not.exist;
        }
        function verifySuccess(res) {
            expect(res).to.have.status(200);
            expect(res.body.status).to.be.eql('SUCCESS');
            expect(res.body.data[0].secret.originalFileName).exist;
            expect(res.body.data[0].secret.originalFileName).to.be.eql('dummyfile.txt');
            expect(res.body.data[0].secret.fileName).exist;
            expect(res.body.data[0].secret.fileSize).exist;
            expect(res.body.data[0].secret.fileExtension).exist;
            expect(res.body.data[0].tenantId).to.not.exist;
            expect(res.body.data[0].userId).to.not.exist;
            expect(res.body.data[0].nameHash).to.not.exist;
            expect(res.body.data[0].__v).to.not.exist;
        }

    describe("File Shared_with_me API", () => {
        it('should download a shared file', async () => {

            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .then(res => {
                    verifyCreated(res)
                    id = res.body.data[0]._id;
                });

            await chai.request(app)
                .put(path2 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    share(res)
                });


            return await chai.request(app)
                .get(path3 + id)
                .set('Authorization', `Bearer ${bearerToken1}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res).to.have.header('content-type', 'application/octet-stream');
                    expect(res).to.have.header('content-disposition', 'attachment; filename="dummyfile.txt"');
                });


        })


        it('should delete a shared file', async () => {

            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .then(res => {
                    verifyCreated(res)
                    id = res.body.data[0]._id;
                });

            await chai.request(app)
                .put(path2 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    share(res)
                });

            await chai.request(app)
                .delete(path9 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(204)
                })

            return await chai.request(app)
                .get(path6 + id)
                .set('Authorization', `Bearer ${bearerToken1}`)
                .then(res => {
                    expect(res).to.have.status(200)
                    expect(res.body.status).to.be.eql("SUCCESS")
                    expect(res.body.data).to.be.eql([])
                });


        })


        it('should view a shared file', async () => {

            let id = '';
            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .then(res => {
                    verifyCreated(res)

                    id = res.body.data[0]._id;
                });


            await chai.request(app)
                .put(path2 + id)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    share(res)
                });


            return await chai.request(app)
                .get(path4 + id)
                .set('Authorization', `Bearer ${bearerToken1}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res).to.have.header('content-type', 'application/octet-stream');
                });


        })


        it('should list shared folder file(s) successfully', async () => {
            var folderId;

            await chai.request(app)
                .post(path5)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder14" })
                .then(res => {
                    verifyFolderCreated(res)
                    folderId = res.body.data._id;
                });

            await chai.request(app)
                .put(path8 + folderId)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    share(res)

                });

            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .field("folderId", folderId)
                .then(res => {
                    verifyCreated(res);
                    expect(res.body.data[0].folderId).to.be.eql(folderId)
                });

            return await chai.request(app)
                .get(path6 + folderId)
                .set('Authorization', `Bearer ${bearerToken1}`)
                .then(res => {
                    verifySuccess(res)
                    expect(res.body.data[0].folderId).to.be.exist;
                });

        })



        it('should successfully list a shared folder-file even if the folder is unshared', async () => {
            var folderId;
            let fileId;

            await chai.request(app)
                .post(path5)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder34" })
                .then(res => {
                    verifyFolderCreated(res)
                    folderId = res.body.data._id;
                });


            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('file', 'src/test/dummyfile.txt')
                .field("folderId", folderId)
                .then(res => {
                    verifyCreated(res);
                    expect(res.body.data[0].folderId).to.be.eql(folderId)
                    fileId = res.body.data[0]._id
                });

                await chai.request(app)
                .put(path2 + fileId)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    share(res)

                });
                
            return await chai.request(app)
                .get(path6 + "all")
                .set('Authorization', `Bearer ${bearerToken1}`)
                .then(res => {
                    verifySuccess(res)
                    expect(res.body.data[0].folderId).to.be.exist;
                    expect(res.body.data[0].sharedFile).to.be.eql(true)
                });

        })


        it('should upload files into a shared folder successfully', async () => {
            var folderId;

            await chai.request(app)
                .post(path5)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send({ folderName: "My folder16" })
                .then(res => {
                    verifyFolderCreated(res)
                    folderId = res.body.data._id;
                });

            await chai.request(app)
                .put(path8 + folderId)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(data)
                .then(res => {
                    share(res)

                });

            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken1}`)
                .attach('file', 'src/test/dummyfile.txt')
                .attach('file', 'src/test/anotherDummyfile.txt')
                .field("folderId", folderId)
                .then(res => {
                    share(res)
                });

            return await chai.request(app)
                .get(path6 + folderId)
                .set('Authorization', `Bearer ${bearerToken1}`)
                .then(res => {
                    verifySuccess(res)
                    expect(res.body.data[0].folderId).to.be.exist;
                });

        }) 

    })


})








