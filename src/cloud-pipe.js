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
	//Checks
	if (!_bucketID) {
		var errMsg = "_bucketID *REQUIRED* parameter is missing;";
		console.error(errMsg);
		this.emit("error",errMsg);/*stills emitting error, so an exception will be raise*/
		this.emit("cp-end");
		return;
	}else if (!_AWSAccessKeyID) {
		var errMsg = "_AWSAccessKeyID *REQUIRED* parameter is missing;";
		console.error(errMsg);
		this.emit("error",errMsg);/*stills emitting error, so an exception will be raise*/
		this.emit("cp-end");
		return;
	}else if (!_AWSSecretAccessKey) {
		var errMsg = "_AWSSecretAccessKey *REQUIRED* parameter is missing;";
		console.error(errMsg);
		this.emit("error",errMsg);/*stills emitting error, so an exception will be raise*/
		this.emit("cp-end");
		return;
	}else if (!fileName) {
		var errMsg = "fileName *REQUIRED* parameter is missing;";
		console.error(errMsg);
		this.emit("error",errMsg);/*stills emitting error, so an exception will be raise*/
		this.emit("cp-end");
		return;
	} else if (!chunkSize) {
		var errMsg = "chunkSize *REQUIRED* parameter is missing;";
		console.error(errMsg);
		this.emit("error",errMsg);/*stills emitting error, so an exception will be raise*/
		this.emit("cp-end");
		return;
	}
	//
	this.bucketID = _bucketID;//bucket name
	this.AWSAccessKeyID = _AWSAccessKeyID;//Amazon access key id
	this.AWSSecretAccessKey = _AWSSecretAccessKey;//Amazon secret access key
	this.fileName = fileName;//File name to be created by upload
	this.options = options;//CP Options
	//Chunk controller
	this.maxChunkSize = chunkSize;//max chunk size to be o buffer, before uploading
	this.dataContainer = new Buffer(this.maxChunkSize);//buffer
	this.dataInBuffer = 0;//data already wrote on buffer only it lenght
	//Upload controller
	if (this.options && this.options["maxRetry"]) { this.uploadRetry = this.options["maxRetry"]; }
	else { this.uploadRetry = 3; }
	this.dyeSignal = false ; //should dye signal
	this.uploadedChunks = 0; //uploaded chunk count
	this.uploadTried = 0; //failed uploads in same chunk
	this.isUploading = false ; //is uploading flag
	//AddListener newListener 
	var thisRef = this;
	this.addListener("newListener",function (event,listFunction) {
		switch (event) {
			case "cp-ready":{ thisRef.getReady(); } break;
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
	this.JSss = require("jsss")(this.bucketID,this.AWSAccessKeyID,this.AWSSecretAccessKey,this.fileName,this.options);
	assert.ok(this.JSss,"JSss mmodule couldn't be loaded.");
	//ref
	var thisRef = this;
	//JSss events
	this.JSss.on("jsss-end",function () {
		thisRef.emitOnce("cp-end");
		thisRef.removeAllListeners("cp-error");/*No errors should be emited when end event is emited*/
	});
	this.JSss.on("jsss-error",function (err) {
		thisRef.emitOnce("cp-error",err);
		thisRef.emitOnce("cp-end");
	});
	this.JSss.on("jsss-upload-notice",function (partNumber,status) {
		//Check if is from different part, it should NEVER happen
		if (partNumber != thisRef.uploadedChunks) { return; }
		//Check if uplaod has been done okay
		if (status == true) {
			//set as not uploading
			thisRef.isUploading = false ; 
			//set data as empty
			thisRef.dataContainer = null;
			thisRef.dataContainer = new Buffer(thisRef.maxChunkSize);
			thisRef.dataInBuffer = 0;
			if (thisRef.dyeSignal == true) { /*try to finish*/ thisRef.finish(); }
			else { /*emit drained, so it can re-start upload*/ thisRef.emit("cp-drained"); }
		}else {
			//Check if can retry
			if (thisRef.uploadTried == 0) {
				//set as not uploading
				thisRef.isUploading = false ; 
				//it'll fire error, where user should call abort method.
				thisRef.emitOnce("cp-error","*CloudPipe* - Error in upload chunk, 'options.maxRetry' are disabled !");
				thisRef.emitOnce("cp-end");
			}
			else if (thisRef.uploadTried < thisRef.uploadRetry) {
				thisRef.uploadTried ++;
				//retry upload
				thisRef.JSss.uploadChunk(thisRef.dataContainer.slice(0,thisRef.dataInBuffer),thisRef.uploadedChunks);
			}else {
				//set as not uploading
				thisRef.isUploading = false ; 
				//it'll fire error, where user should call abort method.
				thisRef.emitOnce("cp-error","*CloudPipe* - Error in upload chunk, max upload try reached !(max:"+thisRef.uploadRetry+",try:"+thisRef.uploadTried+")");
				thisRef.emitOnce("cp-end");
			}	
		}
	});
	//when ready fire cp-ready event
	this.JSss.on("jsss-ready",function () {  thisRef.emit("cp-ready"); });
};

/**
* Write chunk 
* Notice: this function will not call error listener, it'll return false
* if cannot write chunk size, it'll fire `drained` event when can write again.
*
* @param string chunkData - Chunk to be added - REQUIRED
**/
CloudPipe.prototype.write = function write(chunkData) { return this._write(chunkData,false); };
/**
* Abort cloudPipe
* It'll cancel uploads, and delete all uploaded chunks.
* Confirmation of abort, comes as end event !
**/
CloudPipe.prototype.abort = function abort() {
	//resets data
	this.dataContainer.fill(0);
	this.dataInBuffer = 0;
	//abort now
	this.JSss.abortUpload();
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
	//
	var thisRef = thisl
	//Check if have chunks to be uploaded !
	if (this.isUploading) { return false; }
	else { 
		if (this.dataInBuffer > 0) { /*still with not uploaded data in local buffer*/
			if (uploadedChunks == 0) { /*no multipart chunks uploaded, so we will use normal upload API for that*/
				//Start single upload
				this.JSss.S3API.singleUpload(this.fileName,this.dataContainer,function (ok,resp) {
					if (!ok) { thisRef.emitOnce("cp-error","*CloudPipe* - Error in single upload: " + resp); }
					thisRef.abort(); /*Anyway, we will abort it, since this will abort the multipart upload ONLY,
										 which we are not using in this case, AND This will fire jsss-end event, which will emit cp-end event*/
				},true);
			}else { /*force last chunk upload on multipart*/
				this.dyeSignal = true ;
				this._write(null,true);
			}
		}else { this.JSss.finishUpload(); }
	} return true;
};





/**
* Write chunk 
* (notice this function will not call error listener directly)
* if cannot write chunk size will return false and fire `cp-drained` event when can write again.
*
* @param string chunkData - Chunk to be added - REQUIRED
* @param boolean forceUp - try to force upload in lower sizes (can fail in some cases) - REQUIRED
**/
CloudPipe.prototype._write = function _write(chunkData,forceUp) {
	//Check if is uploading ?
	if (this.isUploading) { console.log("is uploading"); }
	//Check if can write
	else if (this.dataContainer.length > this.maxChunkSize) { console.log("data is too big"); }
	//Check if should start uploading
	else if ((forceUp || this.dataInBuffer + chunkData.length > this.maxChunkSize) && !this.isUploading) { console.log("uploading");
		this.uploadTried = 0;
		this.isUploading = true ;
		this.uploadedChunks++; 
		//Start upload
		this.JSss.uploadChunk(this.dataContainer.slice(0,this.dataInBuffer),this.uploadedChunks);
	} else {
		//Append
		this.dataContainer.write(chunkData,this.dataInBuffer,undefined,'binary');
		this.dataInBuffer += chunkData.length;
		return true;
	} return false;
};




/**
* It'll emit and remove listener after it
**/
CloudPipe.prototype.emitOnce = function emitOnce(event) {
	//Emit
	this.emit.apply(this,arguments);
	//remove listener
	this.removeAllListeners(event);
};