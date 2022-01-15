let pathToMinecraftLatest = "./logs/latest.log"
let pathToMyLatest = "latest.log"

let timeToWaitMs = 60000
let timeBetweenChecksMs = 1000

const ps = require("ps-node")
const fs = require("fs")

let checkTask

let latestIndicatesExit = false
function checkLatestForExit(error, content){
    if(content == null){
        latestIndicatesExit = false
        return
    }
    const lines = content.split("\n")
    const stopMessages = lines.slice(lines.length -4, lines.length)
    for(let currentMessage = 0; currentMessage < stopMessages.length; currentMessage++){
        const messageParts = stopMessages[currentMessage].split(":")
        stopMessages[currentMessage] = messageParts[messageParts.length -1].trim()
    }
    latestIndicatesExit = stopMessages[0] === "Stopping server" && stopMessages[1] === "Saving players" && stopMessages[2] === "Saving worlds"
}

let serverHasStopped = false
let serverPid = 0
function checkForProcessExit(error, resultList){
    return resultList.length < 1
}

let timePassed = 0;
function checkRuntimeLimit(waited, limit){
    timePassed = timePassed + waited
    return timePassed > limit
}

function log(content){
    fs.appendFile(pathToMyLatest, content + "\n", () => {})
    console.log(content)
}

let serverExitedCorrectly
function checkForExit(){
    if(!latestIndicatesExit){
        fs.readFile(pathToMinecraftLatest, 'utf8', checkLatestForExit)
    }if(!serverHasStopped && serverPid === 0){
        serverPid = process.ppid
    }if(!serverHasStopped && serverPid !== 0){
        ps.lookup({pid: serverPid}, checkForProcessExit)
    }
    serverExitedCorrectly = latestIndicatesExit || serverHasStopped
    if(serverExitedCorrectly){
        log("Minecraft exited normally.")
        process.exitCode = 0
        clearInterval(checkTask)
    }else if(checkRuntimeLimit(timeBetweenChecksMs, timeToWaitMs)){
        log("Waited to long. Killing server")
        if(serverPid === 0){
            log("could not kill server. Pid not found")
        }else{
            ps.kill(serverPid, 'SIGKILL', () => log("Server killed!"))
        }
        process.exitCode = 1
        clearInterval(checkTask)
    }else{
        log("Still waiting for minecraft to exit...")
    }
}

function assignStringGlobal(newValue, defaultValue){
    return newValue != null ? newValue : defaultValue
}

function assignNumericGlobal(newValue, defaultValue){
   newValue = Number(newValue)
   return !isNaN(newValue) ? newValue : defaultValue
}

function getGlobalsFromArgs(args){
    for(let currentArgument = 0; currentArgument < args.length; currentArgument++){
        switch(args[currentArgument]){
            case "--mclatest":
                currentArgument++
                pathToMinecraftLatest = assignStringGlobal(args[currentArgument], pathToMinecraftLatest)
                break
            case "--mylatest":
                currentArgument++
                pathToMyLatest = assignStringGlobal(args[currentArgument], pathToMyLatest)
                break
            case "--ttw":
                currentArgument++
                timeToWaitMs = assignNumericGlobal(args[currentArgument], timeToWaitMs)
                break
            case "--tbc":
                currentArgument++
                timeBetweenChecksMs = assignNumericGlobal(args[currentArgument], timeBetweenChecksMs)
                break
            case "--pid":
                currentArgument++
                serverPid = assignNumericGlobal(args[currentArgument], serverPid)
                break
        }
    }
}

//Init
getGlobalsFromArgs(process.argv)

//Loop
log("Waiting for minecraft to exit...")
checkTask = setInterval(checkForExit, timeBetweenChecksMs)