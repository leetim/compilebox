/*
        *File: app.js
        *Author: Asad Memon / Osman Ali Mian
        *Last Modified: 5th June 2014
        *Revised on: 30th June 2014 (Introduced Express-Brute for Bruteforce protection)
*/


var express = require('express');
var arr = require('./compilers');
var fs = require('fs');
var sandBox = require('./DockerSandbox');
var app = express.createServer();
var port=80;


var ExpressBrute = require('express-brute');
var store = new ExpressBrute.MemoryStore(); // stores state locally, don't use this in production
var bruteforce = new ExpressBrute(store,{
    freeRetries: 50,
    lifetime: 3600
});

function prepare_sandbox(vm, tm, code, stdin, language){
  var folder = 'temp/' + random(10); //folder in which the temporary folder will be saved
  var path = __dirname+"/"; //current working path
  var vm_name = vm; //name of virtual machine that we want to execute
  var timeout_value = tm;//Timeout Value, In Seconds

  //details of this are present in DockerSandbox.js
  var sandboxType = new sandBox(
    timeout_value,
    path,
    folder,
    vm_name,
    arr.compilerArray[language][0],
    arr.compilerArray[language][1],
    code,
    arr.compilerArray[language][2],
    arr.compilerArray[language][3],
    arr.compilerArray[language][4],
    stdin
  );
  return sandboxType
}

function callback_run(res){
  return function(data,exec_time,err, status){
    console.log("Data: received: "+ err);
    res.send({output:data, errors:err, time:exec_time, run_status: status});
  }
}

app.use(express.static(__dirname));
app.use(express.bodyParser());

app.all('*', function(req, res, next){
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept');

    next();
});

function random(size) {
    //returns a crypto-safe random
    return require("crypto").randomBytes(size).toString('hex');
}

app.post('/upload', bruteforce.prevent, function(req, res){

  var language = req.body.language;
  var code = "";
  var stdin = req.body.stdin;
  var file_path = req.files.file.path;

  var sandboxType = prepare_sandbox('virtual_machine', 20, "", stdin, language);

  sandboxType.run_project(file_path, callback_run(res));

});

app.post('/compile',bruteforce.prevent,function(req, res){

    var language = req.body.language;
    var code = req.body.code;
    var stdin = req.body.stdin;

    var sandboxType = prepare_sandbox('virtual_machine', 20, code, stdin, language);

    sandboxType.run(callback_run(res));
});

app.post('/compile_repo',bruteforce.prevent,function(req, res){

    var language = req.body.language;
    var repo = req.body.repo;
    var stdin = req.body.stdin;
    var file = req.body.file_name;//req.body.file;
    console.log(language);
    console.log(stdin);
    console.log(file);
    console.log(repo);


    var sandboxType = prepare_sandbox('virtual_machine', 20, "", stdin, language);
    sandboxType.file_name = file;
    sandboxType.run_project_from_repo(repo, callback_run(res));
});


app.get('/', function(req, res){
    res.sendfile("./index.html");
});

console.log("Listening at "+port)
app.listen(port);
