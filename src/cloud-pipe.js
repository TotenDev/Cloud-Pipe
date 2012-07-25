//
// cloud-pipe.js — Cloud Pipe
// today is 7/23/12, it is now 3:25 AM
// created by TotenDev
// see LICENSE for details.
//

var util = require ('util'),
	inherits = require('util').inherits,
	assert = require('assert'),
	EventEmitter = require('events').EventEmitter;
	
canRetry = true ;
	
/**
* Initialize CloudPipe function
*
* @param string bucketID - Name of Object in S3 bucket   - REQUIRED
* @param string AWSAccessKeyID - AWS AccessKeyID         - REQUIRED
* @param string AWSSecretAccessKey - AWS SecretAccessKey - REQUIRED
* @param string fileName - fileName to be on S3          - REQUIRED
* @param string chunkSize - chunk size in bytes (got be bigger than 5mb otherwise, we use 5mb) - REQUIRED
* @param Object options - options object - OPTIONAL
* @param string options.endPoint - End point to be used, default `s3.amazonaws.com` - OPTIONAL
* @param bool options.useSSL - Use SSL or not, default is true - OPTIONAL
* @param bool options.maxRetry - Max upload retry, 0 will disable retries. Default is 3 - OPTIONAL
**/
module.exports = function (bucketID,AWSAccessKeyID,AWSSecretAccessKey,fileName,chunkSize,options) { return new CloudPipe(bucketID,AWSAccessKeyID,AWSSecretAccessKey,fileName,chunkSize,options); }
function CloudPipe(_bucketID,_AWSAccessKeyID,_AWSSecretAccessKey,fileName,chunkSize,options) {
	CloudPipeObject = this;
	//Checks
	if (!_bucketID) {
		var errMsg = "_bucketID *REQUIRED* parameter is missing;";
		console.error(errMsg);
		CloudPipeObject.emit("error",errMsg);/*stills emitting error, so an exception will be raise*/
		CloudPipeObject.emit("cp-end");
		return;
	}else if (!_AWSAccessKeyID) {
		var errMsg = "_AWSAccessKeyID *REQUIRED* parameter is missing;";
		console.error(errMsg);
		CloudPipeObject.emit("error",errMsg);/*stills emitting error, so an exception will be raise*/
		CloudPipeObject.emit("cp-end");
		return;
	}else if (!_AWSSecretAccessKey) {
		var errMsg = "_AWSSecretAccessKey *REQUIRED* parameter is missing;";
		console.error(errMsg);
		CloudPipeObject.emit("error",errMsg);/*stills emitting error, so an exception will be raise*/
		CloudPipeObject.emit("cp-end");
		return;
	}else if (!fileName) {
		var errMsg = "fileName *REQUIRED* parameter is missing;";
		console.error(errMsg);
		CloudPipeObject.emit("error",errMsg);/*stills emitting error, so an exception will be raise*/
		CloudPipeObject.emit("cp-end");
		return;
	} else if (!chunkSize) {
		var errMsg = "chunkSize *REQUIRED* parameter is missing;";
		console.error(errMsg);
		CloudPipeObject.emit("error",errMsg);/*stills emitting error, so an exception will be raise*/
		CloudPipeObject.emit("cp-end");
		return;
	}
	//
	CloudPipeObject.bucketID = _bucketID;//bucket name
	CloudPipeObject.AWSAccessKeyID = _AWSAccessKeyID;//Amazon access key id
	CloudPipeObject.AWSSecretAccessKey = _AWSSecretAccessKey;//Amazon secret access key
	CloudPipeObject.fileName = fileName;//File name to be created by upload
	CloudPipeObject.options = options;//CP Options
	//Chunk controller
	CloudPipeObject.maxChunkSize = chunkSize;//max chunk size to be o buffer, before uploading
	CloudPipeObject.dataContainer = new Buffer(CloudPipeObject.maxChunkSize);//buffer
	CloudPipeObject.dataInBuffer = 0;//data already wrote on buffer
	//Upload controller
	if (CloudPipeObject.options && CloudPipeObject.options["maxRetry"]) { CloudPipeObject.uploadRetry = CloudPipeObject.options["maxRetry"]; }
	else { CloudPipeObject.uploadRetry = 3; }
	CloudPipeObject.dyeSignal = false ; //should dye signal
	CloudPipeObject.uploadedChunks = 0; //uploaded chunk count
	CloudPipeObject.uploadTried = 0; //failed uploads in same chunk
	CloudPipeObject.isUploading = false ; //is uploading flag
	//AddListener newListener 
	CloudPipeObject.addListener("newListener",function (event,listFunction) {
		switch (event) {
			case "cp-ready":{ CloudPipeObject.getReady(); } break;
			default: {} break;
		}
	});
};
//inherits to EventEmitter
inherits(CloudPipe, EventEmitter);

/**
* Get ready CloudPipe function (is called when ready listener is attached) - so do not call this directly
**/
CloudPipe.prototype.getReady = function getReady() {
	//Get JSss
	CloudPipeObject.JSss = require("jsss")(CloudPipeObject.bucketID,CloudPipeObject.AWSAccessKeyID,CloudPipeObject.AWSSecretAccessKey,CloudPipeObject.fileName,CloudPipeObject.options);
	assert.ok(CloudPipeObject.JSss,"JSss mmodule couldn't be loaded.");
	
	//JSss events
	CloudPipeObject.JSss.on("jsss-end",function () {
		CloudPipeObject.emitOnce("cp-end");
		CloudPipeObject.removeAllListeners("cp-error");
	});
	CloudPipeObject.JSss.on("jsss-error",function (err) {
		CloudPipeObject.emitOnce("cp-error",err);
		CloudPipeObject.emitOnce("cp-end");
	});
	CloudPipeObject.JSss.on("jsss-upload-notice",function (partNumber,status) {
		//Check if is from different part, it should NEVER happen
		if (partNumber != CloudPipeObject.uploadedChunks) { return; }
		//Check if uplaod has been done okay
		if (status == true) {
			//set as not uploading
			CloudPipeObject.isUploading = false ; 
			//set data as empty
			CloudPipeObject.dataContainer = null;
			CloudPipeObject.dataContainer = new Buffer(CloudPipeObject.maxChunkSize);
			CloudPipeObject.dataInBuffer = 0;
			if (CloudPipeObject.dyeSignal == true) {
				//try to finish
				CloudPipeObject.finish();
			}else {
				//emit drained, so it can re-start upload
				CloudPipeObject.emit("cp-drained");
			}
		}else {
			//Check if can retry
			if (CloudPipeObject.uploadTried == 0) {
				//it'll fire error, where user should call abort method.
				CloudPipeObject.emitOnce("cp-error","*CloudPipe* - Error in upload chunk, 'options.maxRetry' are disabled !");
				CloudPipeObject.emitOnce("cp-end");
			}
			else if (CloudPipeObject.uploadTried < CloudPipeObject.uploadRetry) {
				CloudPipeObject.uploadTried ++;
				//retry upload
				CloudPipeObject.JSss.uploadChunk(CloudPipeObject.dataContainer.slice(0,CloudPipeObject.dataInBuffer),CloudPipeObject.uploadedChunks);
			}else {
				//it'll fire error, where user should call abort method.
				CloudPipeObject.emitOnce("cp-error","*CloudPipe* - Error in upload chunk, max upload try reached !(max:"+CloudPipeObject.uploadRetry+",try:"+CloudPipeObject.uploadTried+")");
				CloudPipeObject.emitOnce("cp-end");
			}	
		}
	});
	//when ready fire cp-ready event
	CloudPipeObject.JSss.on("jsss-ready",function () { 
		CloudPipeObject.emit("cp-ready");	
	});
};

/**
* Write chunk 
* Notice: this function will not call error listener, it'll return false
* if cannot write chunk size, it'll fire `drained` event when can write again.
*
* @param string chunkData - Chunk to be added - REQUIRED
**/
CloudPipe.prototype.write = function write(chunkData) {
	return CloudPipeObject._write(chunkData,false);
};
/**
* Abort cloudPipe
* It'll cancel uploads, and delete all uploaded chunks.
* Confirmation of abort, comes as end event !
**/
CloudPipe.prototype.abort = function abort() {
	//resets data
	CloudPipeObject.dataContainer.fill(0);
	CloudPipeObject.dataInBuffer = 0;
	//abort now
	CloudPipeObject.JSss.abortUpload();
	return true;
};
/**
* Finish 
* This method will finish upload, and can take a bit long for large files, 
* since amazon will only answer the request when all parts are together.
*
* Confirmation of termination, comes as end event ! (it'll return immediatly return respose, to say if it will terminate now or not) !)
**/
CloudPipe.prototype.finish = function finish() {
	//Check if have chunks to be uploaded !
	if (CloudPipeObject.isUploading) {
		return false;
	}else { 
		if (CloudPipeObject.dataInBuffer > 0) {
			CloudPipeObject.dyeSignal = true ;
			CloudPipeObject._write(null,true);
		}else { CloudPipeObject.JSss.finishUpload(); }
	}
	return true;
};





/**
* Write chunk 
* (notice this function will not call error listener directly)
* if cannot write chunk size will return false and fire `cp-drained` event when can write again.
*
* @param string chunkData - Chunk to be added - REQUIRED
* @param boolean forceUp - try to force upload in lower sizes (BUT IF AN UPLOADING IS ALREDY UPLOADING iIS ALREADY IN PROGRESS IT'LL FAIL) - REQUIRED
**/
CloudPipe.prototype._write = function _write(chunkData,forceUp) {
	//Check if is uploading ?
	if (CloudPipeObject.isUploading) {
		console.log("is uploading");
	}
	//Check if can write
	else if (CloudPipeObject.dataContainer.length > CloudPipeObject.maxChunkSize) {
		console.log("data is too big");
	}
	//Check if should start uploading
	else if ((forceUp || CloudPipeObject.dataInBuffer + chunkData.length > CloudPipeObject.maxChunkSize) && !CloudPipeObject.isUploading) {
		console.log("uping");
		CloudPipeObject.uploadTried = 0;
		CloudPipeObject.isUploading = true ;
		CloudPipeObject.uploadedChunks++; 
		//Start upload
		CloudPipeObject.JSss.uploadChunk(CloudPipeObject.dataContainer.slice(0,CloudPipeObject.dataInBuffer),CloudPipeObject.uploadedChunks);
	} else {
//		console.log("adding");
		//Append
		CloudPipeObject.dataContainer.write(chunkData,CloudPipeObject.dataInBuffer,undefined,'binary');
		CloudPipeObject.dataInBuffer += chunkData.length;
		console.log(CloudPipeObject.dataInBuffer);
		return true;
	} return false;
};




/**
* It'll emit and remove listener after it
**/
CloudPipe.prototype.emitOnce = function emitOnce(event) {
	//Emit
	CloudPipeObject.emit.apply(CloudPipeObject,arguments);
	//remove listener
	CloudPipeObject.removeAllListeners(event);
};