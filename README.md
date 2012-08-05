# CloudPipe

Simple Buffer that automatically upload it data to S3 on chunks.

## About

Cloud-Pipe is an easy way of handling huge datas in very low memory and ephemeral writeable filesystems.  
It can receive data and buffer it to some size specified by you, after fill buffer up, it'll stop receiving data and uploading it to S3 with MultipartUpload. This allows you to upload multiple chunks into S3 and join then later on cloud.

## Requirements

- [node](https://github.com/joyent/node)
- [npm](https://github.com/isaacs/npm)
- [JSss](https://github.com/TotenDev/JSss)

## Installation

Download and install dependencies

    $ npm install

## Usage

	var maxChunkSize = 10000000; //10 mb
	var cp = require("./../src/cloud-pipe.js")("my bucket name","myAccessKey","mySecret","file.zip",maxChunkSize);
	cp.on("cp-error",function (err) {
		console.log("error",err);
	});
	cp.on("cp-end",function () {
		console.log("end");
	});
	cp.on("cp-drained",function () {
		console.log("should resume writing");
	});
	//Must be registered in order to CloudPipe get ready
	cp.on("cp-ready",function () {
		var chunk = "OMG"
        if (!cp.write(new Buffer(chunk,'binary'))) { /*wait until cp-drained event, and write again there*/ }
	    else { cp.finish(); }
	});

More samples at `samples/` directory.

## Methods

#### Initialize Wrapper

Parameters:

* bucketID - **Type:**string - **Description:**Name of Object in S3 bucket   - **REQUIRED**
* AWSAccessKeyID - **Type:**string - **Description:**AWS AccessKeyID - **REQUIRED**
* AWSSecretAccessKey - **Type:**string - **Description:**AWS SecretAccessKey - **REQUIRED**
* fileName - **Type:**string - **Description:**fileName to be on S3 - **REQUIRED**
* chunkSize - **Type:**integer - **Description:**Chunk in bytes to be on S3 (Got be 5MB or bigger) - **REQUIRED**
* options - **Type:**OptionObject - **Description:**Options Object - **OPTIONAL**
* options.endPoint - **Type:**string - **Description:**End point to be used, default `s3.amazonaws.com` - **OPTIONAL**
* options.useSSL - **Type:**boolean - **Description:**Use SSL or not, default is true - **OPTIONAL**
* options.maxRetry - **Type:**integer - **Description:**Max upload retry, 0 will disable retries. Default is 3 - **OPTIONAL**

Sample:

    var CloudPipe = require("cloud-pipe")("myBucket","AWSAccessKey","AWSSecretAccessKey","fileNameToBeUp",10000000,{ endPoint:"secondary.s3.com",useSSL:false,maxRetry:1 });
---
#### Write Chunk

This function will not call error listener, it'll return false if cannot write chunk size.  
After it'll fire `cp-drained` event when can write again.

Parameters:
- chunkData - **Type:**Buffer - **Description:**Chunk to be on buffer and after uploaded to S3. (Got be `Buffer` object encoded as `binary`) - **REQUIRED**

Sample:

    CloudPipe.write(new Buffer('OMG This is my chunk','binary'));
---
#### Finish Upload
This method will finish upload and upload what remains on `Buffer`. It can take a bit long for large files, since amazon will only answer the request when all parts are joined.

Sample:

    CloudPipe.finish();

---
#### Abort Upload
This method will cancel upload, and delete all uploaded chunks.

Sample:

    CloudPipe.abort();


## Events

####Ready 
This event **MUST** be registered in order to wrapper start. When this event is reached you are able to start writing.

Event-String: `cp-ready`

Sample:

    //Must be registered to CloudPipe API start
	cp.on("cp-ready",function () {
		console.log("I'm ready :)");
	}
---
####Drained Notice
This event will be reached when old buffer has been uploaded with success, so you can start writing again.  
By default if error happen it will try 3 times until emit error event, this can be set on initialization options.

Event-String: `cp-drained`

Sample:

    cp.on("cp-drained",function () {
		console.log("resuming cpipe write");
		cp.write(new Buffer("resume data",'binary'));
	});
---
####Error
This event will be reached when an error occur in any part that cannot be recovered, so you need to try again. :(  
Do **NOT** call `terminate` or `abort` method from error event, since those methods can emit an error event.

Event-String: `cp-error`

Sample:

    cp.on("cp-error",function (err) {
	    console.log("error in cpipe",err);
    });
---
####End
This event will be reached after finished by `abort()` or `finish()` OR if it didn't start properly.

Event-String: `cp-end`

Sample:

	cp.on("cp-end",function () {
		console.log("Bye cpipe");
	}

## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Added some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request

## License

[GPL v3](Cloud-Pipe/raw/master/LICENSE)