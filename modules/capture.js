// console.log("Child process created******")
const ioHook = require("iohook");
const activeWin = require("active-win");

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
        process.stdout.write(JSON.stringify(finalObject));
      })
      .catch((error) => {
        console.error("Error in keyborad active window event", error);
      });
  });
} catch (err) {
  let logsPath = path.join(os.homedir(), "godseye");
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
        process.stdout.write(JSON.stringify(finalObject));
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
}
