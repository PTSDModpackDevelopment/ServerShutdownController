const systemdCommand = "systemctl status"
const processTreeNeedle = "Main PID: "
let minecraftServiceName = "minecraft.service"

let pathToLatest = "./logs/latest.log"

let timeToWaitMs = 60000
let timeBetweenChecksMs = 1000

const ps = require("ps-node")
const fs = require("fs")
const childProcess = require("child_process")

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

function getPidFromSystemdOutput(systemdOutput){
    let pidStart = systemdOutput.search(processTreeNeedle) + processTreeNeedle.length
    if(pidStart === -1){
        return 0
    }

    let pidEnd = systemdOutput.substring(pidStart).search(" ")+pidStart
    if(pidEnd === -1){
        return 0
    }

    let pid = parseInt(systemdOutput.substring(pidStart, pidEnd))
    if(isNaN(pid)){
        return 0
    }
    return pid
}

function getPidFromSystemd(error, stdout, stderr){
    if(stdout != null){
        serverPid = getPidFromSystemdOutput(stdout)
    }
}

function checkForProcessExit(error, resultList){
    return resultList.length < 1
}

let timePassed = 0;
function checkRuntimeLimit(waited, limit){
    timePassed = timePassed + waited
    return timePassed > limit
}

function checkForExit(){
    if(!latestIndicatesExit){
        fs.readFile(pathToLatest, 'utf8', checkLatestForExit)
    }if(!serverHasStopped && serverPid === 0){
        childProcess.exec(systemdCommand + " " + minecraftServiceName, getPidFromSystemd)
    }if(!serverHasStopped && serverPid !== 0){
        ps.lookup({pid: serverPid}, checkForProcessExit)
    }

    if(latestIndicatesExit || serverHasStopped){
        console.log("Minecraft exited normally.")
        process.exit(0)
    }else if(checkRuntimeLimit(timeBetweenChecksMs, timeToWaitMs)){
        console.log("Waited to long. Killing server")
        if(serverPid === 0){
            console.log("could not kill server. Pid not found")
        }else{
            ps.kill(serverPid, 'SIGKILL', () => console.log("Server killed!"))
        }
        process.exit(1)
    }else{
        console.log("Still waiting for minecraft to exit...")
    }
}

function assignNumericGlobal(newValue, defaultValue){
   newValue = Number(newValue)
   return !isNaN(newValue) ? newValue : defaultValue
}

function assignStringGlobal(newValue, defaultValue){
    if(newValue != null){
        return newValue
    }
    return defaultValue
}

function getGlobalsFromArgs(args){
    for(let currentArgument = 0; currentArgument < args.length; currentArgument++){
        switch(args[currentArgument]){
            case "--latest":
                currentArgument++
                pathToLatest = args[currentArgument]
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
            case "--service":
                currentArgument++
                minecraftServiceName = assignStringGlobal(args[currentArgument], minecraftServiceName)
                break
        }
    }
}

//Init
getGlobalsFromArgs(process.argv)

//Loop
console.log("Waiting for minecraft to exit...")
setInterval(checkForExit, timeBetweenChecksMs)