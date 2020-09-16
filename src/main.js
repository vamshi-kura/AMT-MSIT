const electron = require("electron");
const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const open = require("open");
const { fork, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const os = require("os");
const { writeLogs } = require("../modules/logger");
const { send } = require("process");
const { autoUpdater } = require("electron-updater");
const {
  createDatabase,
  createWindowTable,
  createEventTable,
  insertWindowData,
  insertEventData,
} = require("../modules/databaseService");

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
  let PrevEvent = "startCapture";
  let rowString = `${Date.now()},Start`;

  childProcess = spawn("node", [path.join(__dirname, "../modules/capture.js")]);
  // childProcess = spawn('node', [path.join(logsPath, 'capture.min.js')])
  console.log("The path to capture.js: ", path.join(__dirname, "capture.js"));
  writeLogs(logsPath, `Capture.js path: ${path.join(logsPath, "capture.js")}`);

  //handling messsages from child_process
  childProcess.stdout.on("data", (data) => {
    let csvData;
    let wcode;
    let child_obj = JSON.parse(`${data}`);

    if (child_obj.windowData != undefined) {
      if (
        child_obj.windowData.title === undefined ||
        child_obj.windowData.title === ""
      ) {
        if (windowCodeObj[child_obj.windowData.owner.name] === undefined) {
          //New window found
          windowCounter += 1;
          windowCodeObj[child_obj.windowData.owner.name] = [
            windowCounter,
            child_obj.windowData,
          ];
          let temp_data = JSON.stringify(child_obj.windowData).replace(
            /,/g,
            " | "
          );
          let temp_title = child_obj.windowData.owner.name.replace(/,/g, " | ");
          csvData = `${windowCounter},${temp_title},${temp_data}\n`;
          wcode = windowCounter;
        } else {
          // Not a new window
          wcode = windowCodeObj[child_obj.windowData.owner.name][0];
        }
      } else {
        // window title is present
        if (windowCodeObj[child_obj.windowData.title] === undefined) {
          // New window found
          windowCounter += 1;
          windowCodeObj[child_obj.windowData.title] = [
            windowCounter,
            child_obj.windowData,
          ];
          let temp_data = JSON.stringify(child_obj.windowData).replace(
            /,/g,
            " | "
          );
          let temp_title = child_obj.windowData.title.replace(/,/g, " | ");
          csvData = `${windowCounter},${temp_title},${temp_data}\n`;
          wcode = windowCounter;
        } else {
          wcode = windowCodeObj[child_obj.windowData.title][0];
        }
      }
    } else {
      //undefined winowData Desktop click
      wcode = -1;
    }

    // Writing to window.csv file
    if (csvData) {
      fs.appendFile(window_file, csvData, function (err) {
        if (err) {
          writeLogs(
            logsPath,
            `error in main while writing to window.csv ${err}`
          );
          return console.log(err);
        }
      });

      // Inserting the data into DB
      try {
        if (DB) {
          let values = csvData.split(",");
          values[0] = parseInt(values[0]);
          console.log("The values: ", values);
          insertWindowData(DB, values);
        }
      } catch (err) {
        console.log("Error while inserting the data into window table: ", err);
        writeLogs(
          logsPath,
          `Error while inserting the data into window table: ${err}`
        );
      }
    }

    console.log(
      "each event ",
      PrevEvent,
      PrevWindowCode,
      "current status",
      Object.keys(child_obj)[0],
      wcode
    );

    // Updating the vars
    if (PrevEvent != Object.keys(child_obj)[0] || wcode != PrevWindowCode) {
      //write file
      fs.appendFile(event_file, `${rowString}\n`, function (err) {
        if (err) {
          writeLogs(
            logsPath,
            `error during writing the start capture time to events.csv`
          );
        }
      });

      // Inserting into the event DB
      let values;
      let row_data = rowString.split(",");
      let delay_string = "";
      if (row_data.length > 3) {
        delay_string = row_data.slice(2, row_data.length).toString();
      }
      if (PrevEvent === "startCapture") {
        values = [parseInt(row_data[0]), 0, "start", 0, ""];
      } else if (PrevEvent === "mouseData") {
        let event_count = row_data.length - 2;
        values = [
          parseInt(row_data[0]),
          parseInt(row_data[1]),
          "mouse-click",
          event_count,
          delay_string,
        ];
      } else {
        let event_count = row_data.length - 2;
        values = [
          parseInt(row_data[0]),
          parseInt(row_data[1]),
          "key-stroke",
          event_count,
          delay_string,
        ];
      }

      try {
        if (DB) insertEventData(DB, values);
        else writeLogs(logsPath, "DB is null while inserting into events");
      } catch (err) {
        console.log("Error while inserting into event table ", err);
        writeLogs(logsPath, `Error while inserting into event table ${err}`);
      }

      // currentTimeStamp = child_obj.timeStamp
      rowString = `${child_obj.timeStamp},${wcode},`;
    } else {
      if (PrevEvent === "mouseData") {
        let delay = child_obj.timeStamp - PrevTimeStamp;
        rowString += `${delay},`;
      } else {
        let delay = child_obj.timeStamp - PrevTimeStamp;
        rowString += `${child_obj.keystrokeData.rawcode}:${delay},`;
      }
    }
    PrevTimeStamp = child_obj.timeStamp;
    PrevEvent = Object.keys(child_obj)[0];
    PrevWindowCode = wcode;

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
  let values = [Date.now(), -2, "stop", 0, ""];
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
    mainWindow = null;
  });
}

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
