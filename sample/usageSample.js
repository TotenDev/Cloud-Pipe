var maxChunkSize = 10000000; //10 mb
var cp = require("./../src/cloud-pipe.js")("my bucket name","myAccessKey","mySecret","file.zip",maxChunkSize);
cp.on("cp-error",function (err) {
	console.log("error",err);
});
cp.on("cp-end",function () {
	console.log("end");
});
cp.on("cp-drained",function () {
	console.log("resume");
});
//Must be registered in order to CloudPipe get ready
cp.on("cp-ready",function () {
	var chunk = "OMG"
    if (!cp.write(new Buffer(chunk))) { /*wait until cp-drained event, and write again there*/ }
	else { cp.finish(); }
});