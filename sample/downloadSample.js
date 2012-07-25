var maxChunkSize = 10000000; //10 mb
var cp = require("./../src/cloud-pipe.js")("my bucket name","myAccessKey","mySecret","file.zip",maxChunkSize);
res = null; //request container
//Must be registered in order to CloudPipe get ready
cp.on("cp-ready",function () {
	acumulator = "";
	console.log("->ready");
	var options = {
	  host: 's3.amazonaws.com',
	  port: 80,
	  path: '/bucket/10101010101010.tar.bz2',
	  method: 'GET'
	};
	var http = require('http');
	req = http.request(options, function(_res) {
		res = _res ;
	 	if (res.statusCode == 200) {
		  res.setEncoding('binary');
		  res.on('data', function (chunk) {
			acumulator += chunk ;
		      if (!cp.write(acumulator)) {
				//pause request
				console.log("pausing");
				res.pause(); 
			  } 
			  else { 
				acumulator = ""; 
			  }
		  });
	  	}
		res.on('error', function(e) {
			console.log("error->>>",e);
		  	cp.abort();
		});
		res.on('end', function() {
			console.log("endee");
		  	cp.finish();
		});
	  console.log('HEADERS: ' + JSON.stringify(res.headers));
	});

	req.on('error', function(e) {
 	  console.log("error req:",e);
	  cp.abort();
	});
	req.end();
});
cp.on("cp-error",function (err) {
	console.log("error",err);
});
cp.on("cp-end",function () {
	console.log("end");
});
cp.on("cp-drained",function () {
	console.log("resume");		
	res.resume();
});