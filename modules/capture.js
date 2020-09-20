// console.log("Child process created******")
const ioHook = require("iohook");
const activeWin = require("active-win");
// const { writeLogs } = require("./logger");

try {
  ioHook.on("keydown", async (event) => {
    await activeWin()
      .then((response) => {
        if (response && response.bounds) delete response.bounds;
        if (response && response.memoryUsage) delete response.memoryUsage;
        let time = Date.now();
        let timeStampDetails = time;
        finalObject = {
          keystrokeData: event,
          windowData: response,
          timeStamp: timeStampDetails,
        };
        let finalString = JSON.stringify(finalObject) + "$AMT$";
        process.stdout.write(finalString);
      })
      .catch((error) => {
        console.error("Error in keyborad active window event", error);
      });
  });
} catch (err) {
  let logsPath = path.join(os.homedir(), "godseye");
  // writeLogs(logsPath, `Error in child process: `, err);
}

try {
  ioHook.on("mousedown", async (event) => {
    await activeWin()
      .then((response) => {
        if (response && response.bounds) delete response.bounds;
        if (response && response.memoryUsage) delete response.memoryUsage;
        let time = Date.now();
        let timeStampDetails = time;
        finalObject = {
          mouseData: event,
          windowData: response,
          timeStamp: timeStampDetails,
        };
        let finalString = JSON.stringify(finalObject) + "$AMT$";
        process.stdout.write(finalString);
      })
      .catch((error) => {
        console.error("Error in mousedown active window event", error);
      });
  });

  // Register and start hook
  ioHook.start();

  // Alternatively, pass true to start in DEBUG mode.
  ioHook.start(true);
} catch (err) {
  let logsPath = path.join(os.homedir(), "godseye");
  // writeLogs(logsPath, `Error in child process: `, err);
}
