const electron = require("electron");
const { app, BrowserWindow, ipcMain, Menu, powerMonitor } = require("electron");
const open = require("open");
const { fork, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const os = require("os");
const { writeLogs } = require("../modules/logger");
const { send } = require("process");
const { autoUpdater } = require("electron-updater");
const schedule = require("node-schedule");
const {
  createDatabase,
  createWindowTable,
  createEventTable,
  insertWindowData,
  insertEventData,
} = require("../modules/databaseService");
const { generateReport } = require("../modules/reportScheduler");
const { compressAlgo } = require("../modules/compress");

let childProcess; // Reference to the current child process
let mainWindow;
let timer;
let UUID; // To Store the UUID
let googleId;
let userName;
let userEmail;
let syncTimer;
let fileSyncFolder;
let logsPath;
let logoutClicked = true;
let reasonWindow;
let windowCodeObj;
let windowCounter;
let DB;
let idleTime = 0;
let idleTimer;
let tempIdletime = 0;

// Creating the browser window
function createWindow() {
  // Creating a browser window
  mainWindow = new BrowserWindow({
    title: "Godseye",
    width: 800,
    height: 600,
    resizable: false,
    fullscreenable: false,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
    },
  });
  // Menu.setApplicationMenu(null)
  // loading the index.html file
  mainWindow.loadURL(`file://${__dirname}/index.html`);
  mainWindow.on("close", function (e) {
    console.log("The logout clciked: ", logoutClicked);
    if (logoutClicked === false) {
      const choice = require("electron").dialog.showMessageBoxSync(mainWindow, {
        type: "question",
        buttons: ["Okay"],
        title: "Logout alert",
        message: "Please logout before you quit",
      });
      e.preventDefault();
      return;
    }
    const choice = require("electron").dialog.showMessageBoxSync(mainWindow, {
      type: "question",
      buttons: ["Yes", "No"],
      title: "Confirm",
      message: "Are you sure you want to quit?",
    });
    if (choice === 1) {
      e.preventDefault();
    } else {
      if (childProcess) childProcess.kill();
      if (DB) DB.close();
    }
  });

  // creating the  gods eye folder and the database
  logsPath = path.join(os.homedir(), "godseye");
  console.log("The logs path: ", logsPath);
  if (!fs.existsSync(logsPath)) {
    try {
      fs.mkdirSync(logsPath, { recursive: true });
    } catch (error) {
      console.log("facing issue during the log file creation", error);
    }
  }
  // Creating the database
  // Creating the tables
  DB = createDatabase();
  createWindowTable(DB);
  createEventTable(DB);

  // Checking for auto updates
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send("Test event", "hey there");
    autoUpdater.checkForUpdatesAndNotify();
  });
}

// Creating the window
app.whenReady().then(createWindow);

// The version of the app
ipcMain.on("app_version", (event) => {
  event.sender.send("app_version", { version: app.getVersion() });
});

// handling the login clicked event
ipcMain.on("loginClicked", (event, arg) => {
  console.log("The user token: ", arg.UUID);
  UUID = arg.UUID;
  open(
    `http://cmuuidgooglelogin.s3-website.ap-south-1.amazonaws.com/search?uuid=${arg.UUID}`
  );
  timer = setInterval(() => {
    event.sender.send("secondCall", arg.UUID);
  }, 2000);
});

// Clearing the timer interval after the second call success
ipcMain.on("secondCallSuccess", (event, arg) => {
  console.log("clear interval event captured in main");
  console.log("The data of the user passed: ", arg);
  logoutClicked = false;
  try {
    googleId = arg.googleID;
    userName = arg.userName;
    userEmail = arg.email;
    writeLogs(
      logsPath,
      `Success in login the google id and JWT token: ${googleId}, ${UUID}, ${new Date().toLocaleString()}`
    );
  } catch (err) {
    console.log("Error during accessing the user name or google id: ", err);
    let data = `Error during accessing the user name or google id: ${err}`;
    writeLogs(logsPath, data);
  } finally {
    console.log("clearing the timer for second call during login");
    clearInterval(timer);
  }

  // Loading the data into the window object from window file
  let home = os.homedir();
  fileSyncFolder = path.join(home, "godseye", googleId);
  if (!fs.existsSync(fileSyncFolder)) {
    windowCounter = 0;
  } else {
    console.log("i 'm coming else block");
    let file = path.join(fileSyncFolder, "window.csv");
    try {
      // we need to initialize windowCounter,windowCodeObjafter read file
      windowCodeObj = {};
      let counter = 0;
      fs.createReadStream(file)
        .pipe(csv())
        .on("data", (row) => {
          // console.log(typeof(row),row['window-title'],row.windowcode,row.windowobj,'row',row);
          windowCodeObj[row["window-title"]] = [row.windowcode, row.windowobj];
          counter++;
        })
        .on("end", () => {
          console.log("CSV file successfully processed");
          windowCounter = counter;
          console.log(counter, windowCounter, "printing counter");
        });
    } catch (err) {
      writeLogs(logsPath, `Error during reading the window.csv file ${err}`);
    }
  }

  // loading the second screen into the window
  mainWindow.loadURL(`file://${__dirname}/user.html`);
  mainWindow.webContents.send("getGoogleId", googleId);
});

// Handling the login failure event
ipcMain.on("secondCallFailure", (event, arg) => {
  console.log("Inside the login failed event");
  logoutClicked = true;
  clearInterval(timer);
  console.log("Login Failed due to: ", arg);
  if (arg === "Login TL Reached") {
    event.sender.send("clearTimeout");
    const choice = require("electron").dialog.showMessageBoxSync(mainWindow, {
      type: "question",
      buttons: ["Okay"],
      title: "Re-Login",
      message:
        "Login time limit reached, please close the web-browser window and click on check-in again",
    });
  }
  if (logsPath) {
    writeLogs(logsPath, `Login Fail during the second call: ${arg}`);
  }
  mainWindow.loadURL(`file://${__dirname}/index.html`);
});

// Handling the user name request
ipcMain.on("getUserName", (event) => {
  if (userName && userEmail)
    event.sender.send("userNameResponse", {
      name: userName,
      email: userEmail,
      uuid: UUID,
      path: logsPath,
    });
  else event.sender.send("userNameResponse", null);
});

// Handling the attendance request
ipcMain.on("check-attendance", (event) => {
  if (!logsPath) event.sender.send("attendance-response", null);
  const filePath = path.join(logsPath, "attendanceLog.json");
  if (!fs.existsSync(filePath)) {
    writeLogs(logsPath, "Attendance file does not exist yet");
    event.sender.send("attendance-response", null);
  } else {
    try {
      fs.readFile(filePath, (err, data) => {
        if (err) throw err;
        console.log("The attendance data: ", JSON.parse(data));
        event.sender.send("attendance-response", JSON.parse(data));
      });
    } catch (err) {
      writeLogs(logsPath, `Error during reading the attendance file ${err}`);
    }
  }
});

// Handling the start and stop events
ipcMain.on("startCapture", (event, arg) => {
  idleTimer = setInterval(() => {
    tempIdletime = powerMonitor.getSystemIdleTime();
    if (tempIdletime > 60) {
      tempIdletime = 60;
    }
    idleTime += tempIdletime;
  }, 60000);

  try {
    if (arg && arg.includes("closeReasonWindow")) {
      let reason = arg.split("-")[1];
      console.log("The reason filled: ", reason);
      console.log("child window closed");
      mainWindow.setIgnoreMouseEvents(false);
      reasonWindow.close();
      reasonWindow = null;
      writeLogs(logsPath, `The reason filled by the student: ${reason}`);
    }
  } catch (error) {
    writeLogs(logsPath, `Error while writing the late reason to file ${error}`);
  }
  console.log("start in main captured");
  let home = os.homedir();
  console.log("The home path in main: ", home);
  fileSyncFolder = path.join(home, "godseye", googleId);
  console.log("The dir path in main: ", path.join(home, "godseye", googleId));
  console.log("The directory exists: ", fs.existsSync(fileSyncFolder));
  if (!fs.existsSync(fileSyncFolder)) {
    try {
      fs.mkdirSync(fileSyncFolder, { recursive: true });
    } catch (error) {
      console.log("facing issue during the file create", error);
      writeLogs(logsPath, `Not able to create google id folder: ${error}`);
    }
  }
  let file = path.join(fileSyncFolder, "output.json");

  // Creating the window file and event file
  let window_file = path.join(fileSyncFolder, "window.csv");
  let event_file = path.join(fileSyncFolder, "events.csv");
  if (!windowCodeObj) {
    console.log("are we creating");
    windowCodeObj = {};
    header = `windowcode,window-title,windowobj\n`;
    fs.appendFile(window_file, header, function (err) {
      if (err) {
        writeLogs(logsPath, `error in main while writing to window.csv ${err}`);
        return console.log(err);
      }
    });
  }

  // Writing the logs to the file
  let objData = JSON.stringify({ startCapture: new Date().toLocaleString() });
  fs.appendFile(file, `${objData}\n`, function (err) {
    if (err) {
      writeLogs(
        logsPath,
        `error during writing the start capture time to output.json`
      );
    }
  });

  // Vars to keep updating the csv files
  let PrevTimeStamp;
  let PrevWindowCode;
  let firstKeyCode;
  let PrevEvent = "startCapture";
  let rowString = `${Date.now()},Start`;

  childProcess = spawn("node", [path.join(__dirname, "../modules/capture.js")]);
  // childProcess = spawn('node', [path.join(logsPath, 'capture.min.js')])
  console.log("The path to capture.js: ", path.join(__dirname, "capture.js"));
  writeLogs(logsPath, `Capture.js path: ${path.join(logsPath, "capture.js")}`);

  //handling messsages from child_process
  childProcess.stdout.on("data", (data) => {
    let child_obj;
    try {
      var regex = /\$AMT\$/gi,
        result,
        indices = [];
      while ((result = regex.exec(`${data}`))) {
        indices.push(result.index);
      }
      console.log("Testing: ", indices);
      if (indices.length < 2) {
        let dataObj = `${data}`.replace("$AMT$", "");
        console.log("In main js: ", dataObj);
        child_obj = JSON.parse(dataObj);
        let compressResult = compressAlgo(
          child_obj,
          PrevTimeStamp,
          PrevWindowCode,
          idleTime,
          firstKeyCode,
          PrevEvent,
          rowString,
          windowCodeObj,
          windowCounter,
          DB,
          event_file,
          window_file
        );
        idleTime = compressResult.IdleTime;
        windowCodeObj = compressResult.windowCodeObject;
        windowCounter = compressResult.windowCounter;
        rowString = compressResult.RowString;
        PrevTimeStamp = compressResult.childObj.timeStamp;
        PrevEvent = Object.keys(compressResult.childObj)[0];
        PrevWindowCode = compressResult.windowCode;
      } else {
        console.log("Inside else case: ", indices);
        let objectList = `${data}`.split("$AMT$");
        console.log("The object list: ", objectList);
        objectList.forEach((obj) => {
          if (obj === "") return;
          console.log("The obj in list: ", obj);
          let dataObj = obj.replace("$AMT$", "");
          child_obj = JSON.parse(dataObj);
          let compressResult = compressAlgo(
            child_obj,
            PrevTimeStamp,
            PrevWindowCode,
            idleTime,
            firstKeyCode,
            PrevEvent,
            rowString,
            windowCodeObj,
            windowCounter,
            DB,
            event_file,
            window_file
          );
          idleTime = compressResult.IdleTime;
          windowCodeObj = compressResult.windowCodeObject;
          windowCounter = compressResult.windowCounter;
          rowString = compressResult.RowString;
          PrevTimeStamp = compressResult.childObj.timeStamp;
          PrevEvent = Object.keys(compressResult.childObj)[0];
          PrevWindowCode = compressResult.windowCode;
        });
      }
    } catch (err) {
      console.log("Error during parsing the data: ", err, `${data}`);
      writeLogs(logsPath, `Error during parsing the data ${err}\n${data}`);
    }

    receivedData = `${data},\n`;
    // var dir = './kura.vamshikrishna@msitprogram.net';
    fs.appendFile(file, receivedData, function (err) {
      if (err) {
        writeLogs(
          logsPath,
          `error in main while writing to output.json ${err}`
        );
        return console.log(err);
      }
      // console.log("file write was successful")
    });
  });

  childProcess.stderr.on("data", (data) => {
    writeLogs(logsPath, `error in child process\n ${data}`);
    console.log("Error in child process: ", `${data}`);
  });

  // handling the child exit event
  childProcess.on("exit", () => {
    console.log("The child process has exited");
  });
});

// The stop capture
ipcMain.on("stopCapture", (event, arg) => {
  if (childProcess) childProcess.kill();
  if (idleTimer) clearInterval(idleTimer);
  let objData = JSON.stringify({ stopCapture: new Date().toLocaleString() });
  let file = path.join(fileSyncFolder, "output.json");
  let event_file = path.join(fileSyncFolder, "events.csv");
  fs.appendFile(file, `${objData}\n`, function (err) {
    if (err) {
      writeLogs(
        logsPath,
        `error during writing the start capture time to output.json`
      );
    }
  });
  fs.appendFile(event_file, `${Date.now()},Stop\n`, function (err) {
    if (err) {
      writeLogs(
        logsPath,
        `error during writing the start capture time to output.json`
      );
    }
  });

  // Inserting the event into the DB
  let values = [Date.now(), -2, "stop", 0, "", 0];
  try {
    if (DB) insertEventData(DB, values);
    else writeLogs(logsPath, "DB is null while inserting into events");
  } catch (err) {
    console.log("Error while inserting data in event ", err);
    writeLogs(logsPath, `Error while inserting data in event ${err}`);
  }

  if (arg === "logout-event") {
    UUID = null;
    logoutClicked = true;
    mainWindow.loadURL(`file://${__dirname}/index.html`);
    return;
  }
  console.log("Stop in main captured");
  // if (syncTimer) clearInterval(syncTimer)
  event.sender.send("start-timer");
});

// The get-reason
ipcMain.on("get-reason", (event) => {
  console.log("in get-reason event");
  reasonWindow = new BrowserWindow({
    width: 800,
    height: 400,
    parent: mainWindow,
    resizable: false,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
    },
  });
  reasonWindow.show();
  reasonWindow.loadURL(`file://${__dirname}/reason.html`);
  mainWindow.setIgnoreMouseEvents(true);
});

ipcMain.on("get-uuid", (event) => {
  console.log("The get uuid called", UUID);
  if (UUID) {
    event.sender.send("uuid-response", UUID);
  } else {
    event.sender.send("uuid-response", null);
  }
});

// handling the mainWindow closed event
if (mainWindow) {
  mainWindow.on("closed", () => {
    console.log("In closed event");
    if (childProcess) childProcess.kill();
    if (DB) DB.close();
    mainWindow = null;
  });
}

// Report Jobs
let hourValue = 1;
let minuteValue = 10;
let jobsList = [];

for (let i = 0; i < 5; i++) {
  let jobRule = new schedule.RecurrenceRule();
  jobRule.hour = hourValue;
  jobRule.minute = minuteValue;
  let scheduleInstance = schedule.scheduleJob(jobRule, () => {
    console.log("Loop job called", jobRule.minute);
  });
  jobsList.push(scheduleInstance);
  minuteValue += 1;
}

// Report for 9:30 - 11:00
let jobOneRule = new schedule.RecurrenceRule();
jobOneRule.hour = 23;
jobOneRule.minute = 42;
let jobOne = schedule.scheduleJob(jobOneRule, () => {
  console.log("Job called");
  let endTime = Date.parse(new Date());
  let d = new Date().toDateString();
  let t = `12:12:37 GMT+0530 (IST)`;
  // let startTime = Date.parse(new Date(d + " " + t));
  let startTime = 1600410001266;
  if (DB) generateReport(DB, startTime, endTime);
  else {
    console.log("DB Instance or File not present");
    writeLogs(logsPath, "DB Instance or File not present");
  }
});

// Report for 11:00 - 13:00
let jobTwoRule = new schedule.RecurrenceRule();
jobTwoRule.hour = 13;
jobTwoRule.minute = 00;
let jobTwo = schedule.scheduleJob(jobTwoRule, () => {
  // execute job function
});

// Report for 14:00 - 15:00
let jobThreeRule = new schedule.RecurrenceRule();
jobThreeRule.hour = 15;
jobThreeRule.minute = 00;
let jobThree = schedule.scheduleJob(jobThreeRule, () => {
  // execute job function
});

// Report for 15:00 - 21:00
let jobFourRule = new schedule.RecurrenceRule();
jobFourRule.hour = 21;
jobFourRule.minute = 00;
let jobFour = schedule.scheduleJob(jobFourRule, () => {
  // execute job function
});

// The auto updator events
autoUpdater.on("checking-for-update", () => {
  console.log("Checking for auto update");
});

autoUpdater.on("update-available", () => {
  mainWindow.webContents.send("update-available", "update available");
});

autoUpdater.on("update-downloaded", (event) => {
  mainWindow.webContents.send("update-downloaded", "update downloaded");
});

autoUpdater.on("error", (info) => {
  console.log("The error inauto update: ", info);
});

//Quit when all the windows are closed
app.on("window-all-closed", () => {
  console.log("Closing the window");
  if (childProcess) childProcess.kill();
  if (syncTimer) clearInterval(syncTimer);
  app.quit();
});
