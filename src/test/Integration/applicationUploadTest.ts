
import { Server } from '../../server';
import * as chai from 'chai';

import chaiHttp = require('chai-http');
import 'mocha';
import { expect } from 'chai';
import mongoose = require("mongoose");
import { verify } from 'jsonwebtoken';
import { ServiceFileSchema } from '../../schemas/servicefile';
import { IServiceFileModel } from '../../models/serviceFile';

process.env.DB_NAME = 'filemanager_test';

chai.use(chaiHttp);

var bearerToken;

let randNum = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5);
let pathregister = '/v1/auth/register';
let pathlogin = '/v1/auth/login';
let firstname = randNum;
let lastname = randNum;
let password = 'ghdhdfhjd';
let email = `${firstname}${lastname}@gmail.com`;
let userApiUrl = process.env.USER_URL;

   let userRegisterObject = {
       companyName: "Quabbly",
       firstname: firstname,
       lastname: lastname,
       email: email,
       password: password

   }

const MONGODB_CONNECTION: string = process.env.MONGODB_HOST + process.env.DB_NAME;

mongoose.set('useCreateIndex', true);
mongoose.set('useNewUrlParser', true);

let connection: mongoose.Connection = mongoose.createConnection(MONGODB_CONNECTION);

let file = connection.model<IServiceFileModel>("File", ServiceFileSchema);

var clearDB = function(done) {

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



var app = Server.bootstrap().app;

describe('Register and login a user', () => {
    
    before((done) => {
     chai.request(userApiUrl)
        .post(pathregister)
        .send(userRegisterObject)
        .end((err, res) => {
                if (err) throw err;
                chai.request(userApiUrl)
                    .post(pathlogin)
                    .send({ password: password, username: email })
                    .end((err, res) => {
                        if (err) throw err;
                        bearerToken = res.body.token;
                        done();
                    });
             });
     })


describe('Service File Upload API Request', () => {

    var path = '/v1/service/upload_files';

    function verifyCreated(res){
        expect(res).to.have.status(201);
        expect(res.body.status).to.be.eql('CREATED');
        expect(res.body.data.token).exist;
        
        var publicKey = JSON.parse(`"${process.env.JWT_PUBLIC_KEY}"`);  
        var result: any = verify(res.body.data.token, publicKey, {algorithms: ['RS256'], issuer: process.env.JWT_ISSUER});
        expect(result.data).to.have.lengthOf(1);
        expect(result.data[0].filename).to.be.eql('dummyfile.txt');
        expect(result.data[0].url).exist;
        expect(result.data[0].created).exist;
        expect(result.data[0].size).exist;
    }

    it('should upload a file successfully', async () => {
        await chai.request(app)
        .post(path)
        .set('Authorization',  `Bearer ${bearerToken}`)
        .attach('files', 'src/test/dummyfile.txt')
        .then(res => {
            verifyCreated(res);
        });
    });


    it('should return validation error if size is more than 1MB', async () => {
        return await chai.request(app)
        .post(path)
        .set('Authorization',  `Bearer ${bearerToken}`)
        .attach('files', 'src/test/large_file.png')
        .then(res => {
            expect(res).to.have.status(400);
            expect(res.body.status).to.be.eql('FAILED_VALIDATION');
            expect(res.body.data.field).to.be.eql('file');
            expect(res.body.data.errorMessage).to.be.eql('file must not exceed 1MB');
        });
    })

    it('should return an error if no file was sent', async () => {
        return await chai.request(app)
        .post(path)
        .set('Authorization',  `Bearer ${bearerToken}`)
        .then(res => {
            expect(res).to.have.status(400);
            expect(res.body.status).to.be.eql('FAILED_VALIDATION');
            expect(res.body.data.field).to.be.eql('file');
            expect(res.body.data.errorMessage).to.be.eql('no file uploaded');
            
        });
    })

})


describe('Service File Download API Request', () => {

    var path1 = '/v1/service/upload_files';
    var path2 = '/v1/service/download_file/';


    it('should successfully download a file which was uploaded', async () => {
        var uploadedFileId = '';

        await chai.request(app)
        .post(path1)
        .set('Authorization',  `Bearer ${bearerToken}`)
        .attach('files', 'src/test/dummyfile.txt')
        .then(res => {
            expect(res).to.have.status(201);
            expect(res.body.status).to.be.eql('CREATED');
            expect(res.body.data.token).exist;
            
            var publicKey = JSON.parse(`"${process.env.JWT_PUBLIC_KEY}"`);  
            var result: any = verify(res.body.data.token, publicKey, {algorithms: ['RS256'], issuer: process.env.JWT_ISSUER});
            expect(result.data).to.have.lengthOf(1);
            expect(result.data[0].filename).to.be.eql('dummyfile.txt');
            expect(result.data[0].url).exist;
            expect(result.data[0].created).exist;
            expect(result.data[0].size).exist;
            expect(result.data[0].id).exist;

            uploadedFileId = result.data[0].id;
        });

        var downloadPath = path2 + uploadedFileId;

        return await chai.request(app)
        .get(downloadPath)
        .set('Authorization',  `Bearer ${bearerToken}`)
        .then(res => {
            expect(res).to.have.status(200);
            expect(res).to.have.header('content-type','application/octet-stream');
            expect(res).to.have.header('content-disposition', 'attachment; filename="dummyfile.txt"');
        });
    });


    it('should return validation error if file not found', async () => {
        return await chai.request(app)
        .get(path2 + 'invalidFile')
        .set('Authorization',  `Bearer ${bearerToken}`)
        .then(res => {
            expect(res).to.have.status(404);
            expect(res.body.status).to.be.eql('NOT_FOUND');
        });
    })
})

    describe('Service View File API Request', () => {

        const path1 = '/v1/service/upload_files';
        const path2 = '/v1/service/view_file/';


        it('should successfully view a file which was uploaded', async () => {
            var uploadedFileId = '';

            await chai.request(app)
                .post(path1)
                .set('Authorization', `Bearer ${bearerToken}`)
                .attach('files', 'src/test/dummyfile.txt')
                .then(res => {
                    expect(res).to.have.status(201);
                    expect(res.body.status).to.be.eql('CREATED');
                    expect(res.body.data.token).exist;

                    var publicKey = JSON.parse(`"${process.env.JWT_PUBLIC_KEY}"`);
                    var result: any = verify(res.body.data.token, publicKey, { algorithms: ['RS256'], issuer: process.env.JWT_ISSUER });
                    expect(result.data).to.have.lengthOf(1);
                    expect(result.data[0].filename).to.be.eql('dummyfile.txt');
                    expect(result.data[0].url).exist;
                    expect(result.data[0].created).exist;
                    expect(result.data[0].size).exist;
                    expect(result.data[0].id).exist;
                    uploadedFileId = result.data[0].id;
                });

            const viewPath = path2 + uploadedFileId;

            return await chai.request(app)
                .get(viewPath)
                .set('Authorization', `Bearer ${bearerToken}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res).to.have.header('content-type', 'application/octet-stream');
                    expect(res).to.have.header('content-disposition', "attachment; filename=dummyfile.txt");
                    expect(res).to.have.header('x-sent', 'true');
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
});
