# Filemanager

This is the file manager api based on Typescript2

## Install (Non Docker)

Install the node packages via:

`$ npm install`

And then run the grunt task to compile the TypeScript:

`$ npm run grunt`

## Starting

Install PM2 if not yet installed
`$ npm install pm2 -g`

To start the server run:

`$ pm2 start boot.json`

## Install/Run (Docker) - Ensure you have pulled the `servers` project and started up the container

`docker-compose up -d`