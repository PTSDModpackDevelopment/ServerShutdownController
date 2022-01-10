const minecraftPath = "../mcjunzel/JunzelEternal"
const minecraftCommand = "notepad" //Debug
const timeToWaitMs = 60000
const timeBetweenChecksMs = 1000

const ps = require("ps-node")
const fs = require("fs")

let latestIndicatesExit = false;
function checkLatestForExit(){
    latestIndicatesExit = true
}

let serverHasStopped = false;
let serverPid = 0
function checkForProcessExit(error, resultList){
    serverHasStopped = resultList.length < 1
    if(!serverHasStopped){
        serverPid = resultList[0].pid
    }
}

let timePassed = 0;
function checkRuntimeLimit(waited, limit){
    timePassed = timePassed + waited
    return timePassed > limit
}

function checkForExit(){
    checkLatestForExit()
    ps.lookup({command: minecraftCommand}, checkForProcessExit)
    if(latestIndicatesExit && serverHasStopped){
        console.log("Minecraft exited normally.")
        process.exit(0)
    }else if(checkRuntimeLimit(timeBetweenChecksMs, timeToWaitMs)){
        console.log("Waited to long. Killing server.")
        ps.kill(serverPid, 'SIGKILL', () => console.log("Server killed!"))
    }else{
        console.log("Still waiting for minecraft to exit...")
    }
}

//Init
console.log("Waiting for minecraft to exit...")
setInterval(checkForExit, timeBetweenChecksMs)