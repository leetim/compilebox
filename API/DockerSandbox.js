/*
        *File: DockerSandbox.js
        *Author: Osman Ali Mian/Asad Memon
        *Created: 3rd June 2014
        *Revised on: 25th June 2014 (Added folder mount permission and changed executing user to nobody using -u argument)
        *Revised on: 30th June 2014 (Changed the way errors are logged on console, added language name into error messages)
*/

var format = require('string-format')
var git_download = require('github-download')

/**
  * @Constructor
  * @variable DockerSandbox
  * @description This constructor stores all the arguments needed to prepare and execute a Docker Sandbox
  * @param {Number} timeout_value: The Time_out limit for code execution in Docker
  * @param {String} path: The current working directory where the current API folder is kept
  * @param {String} folder: The name of the folder that would be mounted/shared with Docker container, this will be concatenated with path
  * @param {String} vm_name: The TAG of the Docker VM that we wish to execute
  * @param {String} compiler_name: The compiler/interpretor to use for carrying out the translation
  * @param {String} file_name: The file_name to which source code will be written
  * @param {String} code: The actual code
  * @param {String} output_command: Used in case of compilers only, to execute the object code, send " " in case of interpretors
*/
var DockerSandbox = function( timeout_value,
                              path,folder,
                              vm_name,
                              compiler_name,
                              file_name,code,
                              output_command,
                              languageName,
                              e_arguments,
                              stdin_data){
  this.timeout_value=timeout_value;
  this.path=path;
  this.folder=folder;
  this.vm_name=vm_name;
  this.compiler_name=compiler_name;
  this.file_name=file_name;
  this.code = code;
  this.output_command=output_command;
  this.langName=languageName;
  this.extra_arguments=e_arguments;
  this.stdin_data=stdin_data;
}


/**
* @function
* @name DockerSandbox.run
* @description Function that first prepares the Docker environment and then executes the Docker sandbox
* @param {Function pointer} success ?????
*/
DockerSandbox.prototype.run = function(success){
  var sandbox = this;

  this.prepare( function(){
    sandbox.execute(success);
  });
}

DockerSandbox.prototype.run_project = function(file_path, success){
  var sandbox = this;

  this.prepare_project(file_path, function(){
    sandbox.execute(success);
  });
}

DockerSandbox.prototype.run_project_from_repo = function(file_path, success){
  var sandbox = this;

  this.prepare_project_from_repo(file_path, function(){
    sandbox.execute(success);
  });
}


/**
* @function
* @name DockerSandbox.prepare
* @description Function that creates a directory with the folder name already provided through constructor
* and then copies contents of folder named Payload to the created folder, this newly created folder will be mounted
* on the Docker Container. A file with the name specified in file_name variable of this class is created and all the
* code written in 'code' variable of this class is copied into this file.
* Summary: This function produces a folder that contains the source file and 2 scripts, this folder is mounted to our
* Docker container when we run it.
* @param {Function pointer} success ?????
*/
DockerSandbox.prototype.prepare = function(success){
  var exec = require('child_process').exec;
  var fs = require('fs');
  var sandbox = this;

  exec(format('mkdir {0}{1} && cp {0}/Payload/* {0}{1} && chmod 777 {0}{1}', this.path, this.folder), function(st){
    fs.writeFile(format("{path}{folder}/{file_name}", sandbox), sandbox.code, function(err){
      if (err){
        console.log(err);
      }
      else{
        console.log(format("{langName} file was saved!", sandbox));
        exec(format("chmod 777 \'{path}{folder}/{file_name}\'", sandbox))
        fs.writeFile(format("{path}{folder}/inputFile", sandbox), sandbox.stdin_data,function(err){
          if (err){
            console.log(err);
          }
          else{
            console.log("Input file was saved!");
            success();
          }
        });
      }
    });
  });
}

DockerSandbox.prototype.prepare_project = function(file_path, success){
  var exec = require('child_process').exec;
  var fs = require('fs');
  var sandbox = this;
  sandbox.file_name = "main.py";
  console.log(sandbox.file_name);
  console.log(file_path);
  console.log(format("mkdir {0}{1} && cp {0}/Payload/* {0}{1} && mv {2} {0}{1}/arhcive.tgz && chmod 777 {0}{1}", this.path, this.folder, file_path));
  exec(format("mkdir {0}{1} && cp {0}/Payload/* {0}{1} && cp {2} {0}{1}/arhcive.tgz && chmod 777 {0}{1}", this.path, this.folder, file_path), function(st){
    exec(format("{0}{1}/uncompress.sh {0}{1}/arhcive.tgz {0}{1}", sandbox.path, sandbox.folder), function(st2){
      console.log("Project was saved!" + st2);
      fs.writeFile(format("{path}{folder}/inputFile", sandbox), sandbox.stdin_data, function(err){
        if (err){
          console.log(err);
        }
        else{
          console.log("Input file was saved!");
          success();
        }
      });
    });
  });
}

DockerSandbox.prototype.prepare_project_from_repo = function(git_repo_src, success){
  var exec = require('child_process').exec;
  var fs = require('fs');
  var sandbox = this;
  console.log(git_repo_src);
  git_download(git_repo_src, format("{path}{folder}", this)).on('dir', function(dir) {
    console.log(dir)
  })
  .on('file', function(file) {
    console.log(file)
  })
  .on('zip', function(zipUrl) { //only emitted if Github API limit is reached and the zip file is downloaded
    console.log(zipUrl)
  })
  .on('error', function(err) {
    console.error(err)
  })
  .on('end', function() {
    exec('tree', function(err, stdout, sderr) {
      console.log(stdout)
    })

    exec(format("sudo chmod 777 {path}{folder} && cp {path}/Payload/* {path}{folder}", sandbox), function(st){
      console.log("Project was saved!" + st);
      fs.writeFile(format("{path}{folder}/inputFile", sandbox), sandbox.stdin_data, function(err){
        if (err){
          console.log(err);
        }
        else{
          console.log("Input file was saved!");
          success();
        }
      });
    });
  });
}

/*
         * @function
         * @name DockerSandbox.execute
         * @precondition: DockerSandbox.prepare() has successfully completed
         * @description: This function takes the newly created folder prepared by DockerSandbox.prepare() and spawns a Docker container
         * with the folder mounted inside the container with the name '/usercode/' and calls the script.sh file present in that folder
         * to carry out the compilation. The Sandbox is spawned ASYNCHRONOUSLY and is supervised for a timeout limit specified in timeout_limit
         * variable in this class. This function keeps checking for the file "Completed" until the file is created by script.sh or the timeout occurs
         * In case of timeout an error message is returned back, otherwise the contents of the file (which could be the program output or log of
         * compilation error) is returned. In the end the function deletes the temporary folder and exits
         *
         * Summary: Run the Docker container and execute script.sh inside it. Return the output generated and delete the mounted folder
         *
         * @param {Function pointer} success ?????
*/

DockerSandbox.prototype.execute = function(success){
  var exec = require('child_process').exec;
  var fs = require('fs');
  var myC = 0; //variable to enforce the timeout_value
  var sandbox = this;

  //this statement is what is executed
  // var st = this.path+'DockerTimeout.sh ' + this.timeout_value + 's -u mysql -e \'NODE_PATH=/usr/local/lib/node_modules\' -i -t -v  "' + this.path + this.folder + '":/usercode ' + this.vm_name + ' /usercode/script.sh ' + this.compiler_name + ' ' + this.file_name + ' ' + this.output_command+ ' ' + this.extra_arguments;
  var st = format('{path}DockerTimeout.sh {timeout_value}s -u mysql -e \'NODE_PATH=/usr/local/lib/node_modules\' -i -t -v  \"{path}{folder}\":/usercode {vm_name} /usercode/script.sh {compiler_name} {file_name} {output_command} {extra_arguments}', this);

  //log the statement in console
  console.log(st);
  // console.log(st1);

  //execute the Docker, This is done ASYNCHRONOUSLY
  exec(st);
  console.log("------------------------------")
  //Check For File named "completed" after every 1 second
  var intid = setInterval(function()
      {
          //Displaying the checking message after 1 second interval, testing purposes only
          console.log("Checking " + sandbox.path+sandbox.folder + ": for completion: " + myC);

          myC = myC + 1;

          fs.readFile(sandbox.path + sandbox.folder + '/completed', 'utf8', function(err, data) {

          //if file is not available yet and the file interval is not yet up carry on
          if (err && myC < sandbox.timeout_value)
          {
              //console.log(err);
              return;
          }
          //if file is found simply display a message and proceed
          else if (myC < sandbox.timeout_value)
          {
              console.log("DONE")
              //check for possible errors
              fs.readFile(sandbox.path + sandbox.folder + '/errors', 'utf8', function(err2, data2)
              {
              	if(!data2) data2=""
             		console.log("Error file: ")
             		console.log(data2)

             		console.log("Main File")
             		console.log(data)

          			var lines = data.toString().split('*-COMPILEBOX::ENDOFOUTPUT-*')
          			data=lines[0]
                var time=lines[1]
                var result_status=lines[2]

          			console.log("Time: ")
          			console.log(time)


     	           	success(data, time, data2, result_status)
              });

              //return the data to the calling functoin

          }
          //if time is up. Save an error message to the data variable
          else
          {
          	//Since the time is up, we take the partial output and return it.
          	fs.readFile(sandbox.path + sandbox.folder + '/logfile.txt', 'utf8', function(err, data){
          		if (!data) data = "";
                  data += "\nExecution Timed Out";
                  console.log("Timed Out: "+sandbox.folder+" "+sandbox.langName)
                  fs.readFile(sandbox.path + sandbox.folder + '/errors', 'utf8', function(err2, data2)
                {
                	if(!data2) data2=""

			var lines = data.toString().split('*---*')
			data=lines[0]
			var time=lines[1]

			console.log("Time: ")
			console.log(time)

                   	success(data,data2)
                });
          	});

          }


          //now remove the temporary directory
          console.log("ATTEMPTING TO REMOVE: " + sandbox.folder);
          console.log("------------------------------")
          exec("rm -r " + sandbox.folder);


          clearInterval(intid);
      });
  }, 1000);
}


module.exports = DockerSandbox;
