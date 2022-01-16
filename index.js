let pathToMinecraftLatest = "./logs/latest.log"
let pathToMyLatest = "latest.log"

let timeToWaitMs = 60000
let timeBetweenChecksMs = 1000

let minecraftService = "minecraft.service"
const systemdCommand = "systemctl status"
const processTreeNeedle = "Main PID: "

let minecraftCommand = "calc"

const ps = require("ps-node")
const fs = require("fs")
const childProcess = require("child_process")

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

const noPid = 0
let serverPid = noPid
function setServerPidToParentPid(){
    serverPid = process.ppid
}

function getServerPidFromSystemdOutput(systemdOutput){
    let pidStart = systemdOutput.search(processTreeNeedle) + processTreeNeedle.length
    if(pidStart === -1){
        return noPid
    }

    let pidEnd = systemdOutput.substring(pidStart).search(" ")+pidStart
    if(pidEnd === -1){
        return noPid
    }

    let pid = parseInt(systemdOutput.substring(pidStart, pidEnd))
    if(isNaN(pid)){
        return noPid
    }
    return pid
}

function setServerPidFromSystemdOutput(){
    childProcess.exec(systemdCommand + " " + minecraftService, (error, stdout, stderr) => serverPid = getServerPidFromSystemdOutput(stdout))
}

function setServerPidFromCommandLookup(){
    ps.lookup({command: minecraftCommand}, (error, psList) => serverPid = error == null && psList.length > 0 ? psList[0] : noPid)
}

const pidGetter = [
    setServerPidFromCommandLookup,
    setServerPidFromSystemdOutput,
    setServerPidToParentPid
]

let attemptsMade = 0
function setServerPid(){
    if(attemptsMade === 0){
        let attemptOpportunities = Math.floor(timeToWaitMs / timeBetweenChecksMs)
        if(attemptOpportunities < pidGetter.length){
            attemptsMade = pidGetter.length - attemptOpportunities
        }
    }
    if(attemptsMade >= pidGetter.length){
        attemptsMade = 0
    }
    let lastPid = serverPid
    pidGetter[attemptsMade]()
    if(serverPid === noPid){
        serverPid = lastPid
    }
    attemptsMade++
}

let serverHasStopped = false
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
        setServerPid()
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
            case "--cmd":
                currentArgument++
                minecraftCommand = assignStringGlobal(args[currentArgument], minecraftCommand)
                break
            case "--service":
                currentArgument++
                minecraftService = assignStringGlobal(args[currentArgument], minecraftService)
                break
        }
    }
}

//Init
getGlobalsFromArgs(process.argv)

//Loop
log("Waiting for minecraft to exit...")
checkTask = setInterval(checkForExit, timeBetweenChecksMs)