let minecraftPath = "."
let minecraftCommand = "LaunchServer.sh"

let timeToWaitMs = 60000
let timeBetweenChecksMs = 1000

const ps = require("ps-node")
const fs = require("fs")

let latestIndicatesExit = false
function checkLatestForExit(error, content){
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
    if(!latestIndicatesExit){
        fs.readFile(minecraftPath + "/logs/latest.log", 'utf8', checkLatestForExit)
    }if(!serverHasStopped){
        ps.lookup({command: minecraftCommand}, checkForProcessExit)
    }

    if(latestIndicatesExit && serverHasStopped){
        console.log("Minecraft exited normally.")
        process.exit(0)
    }else if(checkRuntimeLimit(timeBetweenChecksMs, timeToWaitMs)){
        console.log("Waited to long. Killing server")
        if(serverPid !== 0){
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
            case "--mcdir":
                currentArgument++
                minecraftPath = args[currentArgument]
                break
            case "--ttw":
                currentArgument++
                timeToWaitMs = assignNumericGlobal(args[currentArgument], timeToWaitMs)
                break
            case "--tbc":
                currentArgument++
                timeBetweenChecksMs = assignNumericGlobal(args[currentArgument], timeBetweenChecksMs)
                break
            case "--cmd":
                currentArgument++
                minecraftCommand = assignStringGlobal(args[currentArgument], minecraftCommand)
        }
    }
}

//Init
getGlobalsFromArgs(process.argv)

//Loop
console.log("Waiting for minecraft to exit...")
setInterval(checkForExit, timeBetweenChecksMs)