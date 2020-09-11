//Importing the modules
const electron = require('electron')
const { app, BrowserWindow, ipcMain, net, Menu } = require('electron')
const open = require('open')
const { fork, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const syncData = require('../Sync/fileSync')
const os = require('os')
const mkdirp = require('mkdirp')
const { writeLogs } = require('../modules/logger')
const { send } = require('process')
const { autoUpdater } = require('electron-updater');

let childProcess       // Reference to the current child process
let mainWindow
let loginWindow
let userDetails     // To store the user details
let timer
let UUID       // To Store the UUID
let googleId
let userName
let userEmail
let syncTimer
let fileSyncFolder
let logsPath
let logoutClicked = true
let reasonWindow
let childData

// Creating the browser window
function createWindow() {
  // Creating a browser window
  mainWindow = new BrowserWindow({
    title: 'Godseye',
    width: 800,
    height: 600,
    resizable : false,
    fullscreenable:false,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
    }
  })
  // Menu.setApplicationMenu(null)
  // loading the index.html file
  mainWindow.loadURL(`file://${__dirname}/index.html`)
  mainWindow.on('close', function(e) {
    console.log("The logout clciked: ", logoutClicked)
    if (logoutClicked === false) {
      const choice = require('electron').dialog.showMessageBoxSync(mainWindow,
        {
          type: 'question',
          buttons: ['Okay'],
          title: 'Logout alert',
          message: 'Please logout before you quit'
        });
        e.preventDefault()
        return
    }
    const choice = require('electron').dialog.showMessageBoxSync(mainWindow,
      {
        type: 'question',
        buttons: ['Yes', 'No'],
        title: 'Confirm',
        message: 'Are you sure you want to quit?'
      });
    if (choice === 1) {
      e.preventDefault();
    }else{
      if (childProcess) childProcess.kill()
    }
  })


  // creating the  gods eye folder
  logsPath = path.join(os.homedir(), 'godseye')
  console.log("The logs path: ", logsPath)
  if (!fs.existsSync(logsPath)) {
    try {
      fs.mkdirSync(logsPath, {recursive: true})
    } catch(error) {
      console.log('facing issue during the log file creation', error)
    }
  }

  // read the capture js file
  // fs.readFile(path.join(__dirname, 'capture.min.js'), (error,data) => {
  //   if (error) writeLogs(logsPath, `Error in file read capture ${error}`)
  //   console.log("The data: ", `${data}`)
  //   childData = `${data}`
  // })

  // Checking for auto updates
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('Test event', 'hey there')
    autoUpdater.checkForUpdatesAndNotify();
  })
}

// Creating the window
app.whenReady().then(createWindow)


// The version of the app
ipcMain.on('app_version', (event) => {
  event.sender.send('app_version', { version: app.getVersion() });
});


// handling the login clicked event
ipcMain.on('loginClicked', (event, arg) => {
  console.log("The user token: ", arg.UUID)
  UUID = arg.UUID
  open(`http://cmuuidgooglelogin.s3-website.ap-south-1.amazonaws.com/search?uuid=${arg.UUID}`)
    timer = setInterval(() => {
      event.sender.send('secondCall', arg.UUID)
    }, 2000)
})


// Clearing the timer interval after the second call success
ipcMain.on('secondCallSuccess', (event, arg) => {
  console.log("clear interval event captured in main")
  console.log('The data of the user passed: ', arg)
  logoutClicked = false
  try {
    googleId = arg.googleID
    userName = arg.userName
    userEmail = arg.email
    writeLogs(logsPath, `Success in login the google id and JWT token: ${googleId}, ${UUID}, ${new Date().toLocaleString()}`)
  } catch (err) {
    console.log("Error during accessing the user name or google id: ", err)
    let data = `Error during accessing the user name or google id: ${err}`
    writeLogs(logsPath, data)
  } finally {
    console.log('clearing the timer for second call during login')
    clearInterval(timer)
  }
  // loading the second screen into the window
  mainWindow.loadURL(`file://${__dirname}/user.html`)
  mainWindow.webContents.send('getGoogleId', googleId)
})


// Handling the login failure event
ipcMain.on('secondCallFailure', (event, arg) => {
  console.log("Inside the login failed event")
  logoutClicked = true
  clearInterval(timer)
  console.log('Login Failed due to: ', arg)
  if (arg === 'Login TL Reached') {
    event.sender.send('clearTimeout')
    const choice = require('electron').dialog.showMessageBoxSync(mainWindow,
      {
        type: 'question',
        buttons: ['Okay'],
        title: 'Re-Login',
        message: 'Login time limit reached, please close the web-browser window and click on check-in again'
      });
  }
  if (logsPath) {
    writeLogs(logsPath, `Login Fail during the second call: ${arg}`)
  }
  mainWindow.loadURL(`file://${__dirname}/index.html`)
})


// Handling the user name request
ipcMain.on('getUserName', (event) => {
  if (userName && userEmail) event.sender.send('userNameResponse', {name: userName, email: userEmail, uuid: UUID, path: logsPath})
  else event.sender.send('userNameResponse', null)
})


// Handling the attendance request
ipcMain.on('check-attendance', (event) => {
  if (!logsPath) event.sender.send('attendance-response', null)
  const filePath = path.join(logsPath, 'attendanceLog.json')
  if (!fs.existsSync(filePath)) {
    writeLogs(logsPath, "Attendance file does not exist yet")
    event.sender.send('attendance-response', null)
  } else {
    try {
      fs.readFile(filePath, (err, data) => {
        if (err) throw err
        console.log("The attendance data: ", JSON.parse(data))
        event.sender.send('attendance-response', JSON.parse(data))
      })
    } catch (err) {
      writeLogs(logsPath, `Error during reading the attendance file ${err}`)
    }
  }
})



// Handling the start and stop events
ipcMain.on('startCapture', (event,arg) => {
  try {
    if(arg && arg.includes('closeReasonWindow')){
      let reason = arg.split('-')[1]
      console.log("The reason filled: ", reason)
      console.log('child window closed')
      mainWindow.setIgnoreMouseEvents(false)
      reasonWindow.close()
      reasonWindow = null
      writeLogs(logsPath, `The reason filled by the student: ${reason}`)
    }
  } catch (error) {
    writeLogs(logsPath, `Error while writing the late reason to file ${error}`)
  }
  console.log("start in main captured")
  let home = os.homedir()
  console.log('The home path in main: ', home)
  fileSyncFolder = path.join(home, 'godseye', googleId)
  console.log("The dir path in main: ", path.join(home, 'godseye', googleId))
  console.log("The directory exists: ", fs.existsSync(fileSyncFolder))
  if (!fs.existsSync(fileSyncFolder)){
    try {
        fs.mkdirSync(fileSyncFolder, {recursive: true})
    } catch(error) {
      console.log('facing issue during the file create', error)
      writeLogs(logsPath, `Not able to create google id folder: ${error}`)
    }
  }
  let file = path.join(fileSyncFolder, 'output.json')

  // Writing the logs to the file
  let objData = JSON.stringify({startCapture: new Date().toLocaleString()})
  fs.appendFile(file, `${objData}\n`, function(err) {
    if (err) {
      writeLogs(logsPath, `error during writing the start capture time to output.json`)
    }
  })

  // childProcess = spawn('node', [path.join(__dirname, '../modules/capture.js')])
  childProcess = spawn('node', [path.join(logsPath, 'capture.min.js')])
  console.log("The path to capture.js: ", path.join(__dirname, 'capture.js'))
  writeLogs(logsPath, `Capture.js path: ${path.join(logsPath, 'capture.js')}`)



  console.log("The child data: ", childData)
  // childProcess = spawn('node', ['-e',  'const ioHook=require(\"iohook\"),activeWin=require(\"active-win\");try{ioHook.on(\"keydown\",async t=>{await activeWin().then(o=>{let e=new Date,i=e.toDateString()+\" \"+e.toTimeString();finalObject={keystrokeData:t,windowData:o,timeStamp:i},process.stdout.write(JSON.stringify(finalObject))}).catch(t=>{console.error(\"Error in keyborad active window event\",t)})})}catch(t){path.join(os.homedir(),\"godseye\")}try{ioHook.on(\"mousedown\",async t=>{await activeWin().then(o=>{let e=new Date,i=e.toDateString()+\" \"+e.toTimeString();finalObject={mouseData:t,windowData:o,timeStamp:i},process.stdout.write(JSON.stringify(finalObject))}).catch(t=>{console.error(\"Error in keyborad active window event\",t)})}),ioHook.start(),ioHook.start(!0)}catch(t){path.join(os.homedir(),\"godseye\")}'])
  // childProcess = spawn('node', [path.resolve(__dirname, 'capture.js')])
  //handling messsages from child_process
  childProcess.stdout.on('data', (data) => {
    receivedData = `${data},\n`
    // var dir = './kura.vamshikrishna@msitprogram.net';
    fs.appendFile(file, receivedData, function (err) {
      if (err) {
        writeLogs(logsPath, `error in main while writing to output.json ${err}`)
        return console.log(err)
      }
      // console.log("file write was successful")
    })
  })
  

  childProcess.stderr.on('data', (data) => {
    writeLogs(logsPath, `error in child process\n ${data}`)
    console.log("Error in child process: ", `${data}`)
  })

  // handling the child exit event
  childProcess.on('exit', () => {
    console.log("The child process has exited")
  })
})

// The file sync operation
syncTimer = setInterval(() => {
  console.log("interval call")
  if (fs.existsSync(fileSyncFolder)) {
    console.log("going if loop")
    if (googleId) {
      console.log("Calling sync data")
      syncData(googleId, logsPath)
    }
  }
}, 900000)



// The stop capture
ipcMain.on('stopCapture',(event,arg) => {
  let objData = JSON.stringify({stopCapture: new Date().toLocaleString()})
  let file = path.join(fileSyncFolder, 'output.json')
  fs.appendFile(file, `${objData}\n`, function(err) {
    if (err) {
      writeLogs(logsPath, `error during writing the start capture time to output.json`)
    }
  })
  if (childProcess) childProcess.kill()
  if (arg === 'logout-event'){
    UUID = null
    logoutClicked = true
    mainWindow.loadURL(`file://${__dirname}/index.html`)
    return 
  }
  console.log("Stop in main captured")
  // if (syncTimer) clearInterval(syncTimer)
  event.sender.send('start-timer')
})


// The get-reason
ipcMain.on('get-reason',(event) => {
  console.log('in get-reason event')
  reasonWindow = new BrowserWindow({
      width: 800,
      height: 400,
      parent: mainWindow,
      resizable : false,
      frame: false,
      webPreferences: {
        nodeIntegration: true,
        webSecurity: false,
    }
  })
  reasonWindow.show()
  reasonWindow.loadURL(`file://${__dirname}/reason.html`)
  mainWindow.setIgnoreMouseEvents(true)
})

ipcMain.on('get-uuid',(event) =>{
  console.log("The get uuid called", UUID)
  if(UUID){
    event.sender.send('uuid-response',UUID)
  }else{
    event.sender.send('uuid-response', null)
  }
})

// handling the mainWindow closed event
if (mainWindow) {
  mainWindow.on('closed', () => {
    console.log("In closed event")
    if (childProcess) childProcess.kill()
    mainWindow = null
  })
}


// The auto updator events
autoUpdater.on('checking-for-update', () => {
  console.log("Checking for auto update")
})

autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update-available', 'update available')
})


autoUpdater.on('update-downloaded', (event) => {
  mainWindow.webContents.send('update-downloaded', 'update downloaded')
})


autoUpdater.on('error', (info) => {
  console.log("The error inauto update: ",info)
})


//Quit when all the windows are closed
app.on('window-all-closed', () => {
  console.log("Closing the window")
  if (childProcess) childProcess.kill()
  if (syncTimer) clearInterval(syncTimer)
  app.quit()
})