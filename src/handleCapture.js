// Importing the electron modules
const electron = require('electron')
const greetingTime = require("greeting-time");
const axios = require('axios').default;
let moment = require('moment');
const ipc = electron.ipcRenderer
const { attendanceLog, writeLogs } = require('../modules/logger')
const schedule = require('node-schedule')
let val = -1
let hours = 0;
let  mins = 0;
let seconds =0; 
let timer_called = false
let login_date_time 
let greeting = greetingTime(new Date())
let userName
let userEmail
let uuid
let path
let attendanceDetails
let timeLeft


// The cron job for the mark attendance button
let rule = new schedule.RecurrenceRule();
rule.hour = 18;
rule.minute = 16;
let j = schedule.scheduleJob(rule, function(){
  console.log('Enable rule called');
  axios.get('http://worldtimeapi.org/api/timezone/Asia/Kolkata')
    .then((response) => {
      let api_time = new Date(response.data.datetime)
      let sys_time = new Date()
      let timeDiff = Math.abs(Date.parse(api_time) - Date.parse(sys_time))/1000
      if (timeDiff <= 60) {
        console.log("The time check has passed", api_time.toLocaleString(), sys_time.toLocaleString())
        
      }else {
        console.log("The time check did not pass", api_time.toLocaleString(), sys_time.toLocaleString())
      }
    })
    .catch((err) => {
      console.log("Error in fetch during enable rule ", err)
    })
});



// requesting for the user name
ipc.send('getUserName')


// The user name response event
ipc.on('userNameResponse', (event, arg) => {
  console.log("The user name response got from the main: ", arg)
  userName = arg.name
  userEmail = arg.email
  uuid = arg.uuid
  path = arg.path
  console.log("The user name: ", userName)
  if (userName) document.getElementById('userGreetings').innerHTML = `<span id ='greetings'>${greeting}</span>, ${userName}`
  else document.getElementById('userGreetings').innerHTML = `<span id ='greetings'>${greeting}</span>`
})


// The attendance response
ipc.on('attendance-response', (event, arg) => {
  // console.log("Inside attendance response: ", arg.date === login_date_time.toLocaleDateString())
  // console.log("The arg test", arg)
  if (arg && arg.date === login_date_time.toLocaleDateString()) {
    attendanceDetails = arg
    document.getElementById('attendance').disabled = true
    document.getElementById('attendance').innerHTML = 'Attendance Marked'
    document.getElementById('timestamp').innerHTML = arg.date + ",  " + arg.time
  } else {
    const start_att_time = new Date(parseInt(login_date_time.getFullYear()),login_date_time.getMonth(), login_date_time.getDate(), 9,0)
    const end_att_time = new Date(parseInt(login_date_time.getFullYear()),login_date_time.getMonth(), login_date_time.getDate(), 9,10)
    if (login_date_time - start_att_time <= 0 ) {
      document.getElementById('attendance').disabled = true
    }else if (login_date_time - end_att_time  >= 0 && document.getElementById('attendance').innerHTML != 'Marked'){
      document.getElementById('attendance').disabled = true
      document.getElementById('attendance').innerHTML = 'Attendance not marked'
    }else if (login_date_time - start_att_time >=0 && end_att_time -login_date_time >=0 ){
      document.getElementById('attendance').disabled = false
      document.getElementById('attendance').innerHTML = 'Mark Attendance'
    }
    console.log('checking the time',greeting,typeof(greeting))
  }
  document.getElementById('greetings').innerHTML = greeting
  document.getElementById('get-Date').innerHTML = " " +login_date_time.toDateString() +", "+ login_date_time.toLocaleTimeString()
})



// Need to add Database query to check wheater present or absent. 
axios.get('http://worldtimeapi.org/api/timezone/Asia/Kolkata')
  .then((response) => {
    console.log('geting axios data',response.data.datetime)
    login_date_time = new Date(response.data.datetime)
    // login_date_time = new Date()
    console.log('login_date_time',login_date_time)
    console.log("Checking the attendance details in axios: ", )
    // Check for the attendance log and update
    ipc.send('check-attendance')
    // console.log(login_date_time.toString())
  }).catch((err) => {
    login_date_time = new Date()
    ipc.send('check-attendance')
    console.log(err)
  })


// handling the attendance event
document.getElementById('attendance').addEventListener('click',() => {
  let marked_date = new Date()
  axios.post('https://hhq5nbplrb.execute-api.ap-south-1.amazonaws.com/v1/attendance/checkin', {
    "uuid" : uuid,
    "email" : userEmail,
    "date" : marked_date.toLocaleDateString(), 
    "time" : marked_date.toLocaleTimeString()
  })
  .then((response) => {
    document.getElementById('attendance').innerHTML = "Attendance Marked"
    document.getElementById('timestamp').innerHTML = marked_date.toDateString()+", "+ marked_date.toLocaleTimeString()
    document.getElementById('attendance').disabled = true

    // writing the data to the file
    if (path) {
        let data = {"uuid": uuid, 
        "date": marked_date.toLocaleDateString(), 
        "time": marked_date.toLocaleTimeString()
        }
        console.log("The data in handle capture: ", data)
        attendanceLog(path,JSON.stringify(data))
    }
  })
  .catch((error) => {
    console.log("Error while marking attendance in the DB", error)
    if (path) {
      writeLogs(path, `Error while marking attendance in the DB ${error}`)
    }
    alert('Failed to mark attendance, please check your net connection and click login again')
  })
})



// when take a break button clicked by this event we are showing confirm button
document.getElementById('pause').addEventListener('click', () => {
  document.getElementById('pause').disabled = true;
  document.getElementById('resume').disabled = false
  console.log("Pause has been clicked")
  document.getElementById("dropdown").style.display = "block";
})


// when resume button click we are making to running state (as we see after login state)
document.getElementById('resume').addEventListener('click', () => {
  document.getElementById('pause').disabled = false
  document.getElementById('resume').disabled = true
  document.getElementById('confirm').disabled = false;
  document.getElementById('logout').disabled = false;
  document.getElementById("dropdown").style.display = "none";

  document.getElementById('timer').style.display = 'none';
  // checking confirm button is called
  if (timer_called){
    // clearTimeout(timex);
    clearInterval(timex)
    document.getElementById('hours').innerHTML = '00:'
    document.getElementById('mins').innerHTML = '00:'
    document.getElementById('seconds').innerHTML = '00'
    hours = 0
    mins = 0
    seconds =0
    timer_called = false
    ipc.send('startCapture') 
  }
})


// when the main.js is called after stop-capture(on a whole when confirm button clicked)
ipc.on('start-timer',() => {
  console.log('start timer initiated',hours,mins)
  // the new timer code
  console.log('which option choosed',val)
  axios.get('http://worldtimeapi.org/api/timezone/Asia/Kolkata')
    .then((response) => {
      date_obj = new Date(response.data.datetime)
      console.log('before startTimer',date_obj,val)
      date_obj.setMinutes( date_obj.getMinutes() +parseInt(val) );
      val = date_obj.toString()
      console.log('before startTimer',date_obj,val)
      console.log('before startTimer',hours,mins,seconds)
      startTimer()
    }).catch((err) =>{
      console.log(err)
      date_obj = new Date(response.data.datetime)
      console.log('before startTimer catch block',date_obj,val)
      date_obj.setMinutes( date_obj.getMinutes() +parseInt(val) );
      val = date_obj.toString()
      console.log('before startTimer catch block',date_obj,val)
      console.log('before startTimer catch block',hours,mins,seconds)
      startTimer()
    })
  
})

// event triggered when the confirm button is clicked 
document.getElementById('confirm').addEventListener('click',() => {
  val = document.getElementById('getopt').value 
  if (val == -1){
    alert('please select a correct option')
    return
  }
    
  mins = parseInt(val)
  document.getElementById('confirm').disabled = true;
  document.getElementById('timer').style.display = 'block';
  document.getElementById('logout').disabled = true;
  ipc.send('stopCapture','timer')  
})

// timer function 
// function startTimer(){
function makeTimer() {
  let endTime = new Date(val);    
  endTime = (Date.parse(endTime) / 1000);

  let now = new Date();
  now = (Date.parse(now) / 1000);

  timeLeft = endTime - now;
  let days = Math.floor(timeLeft / 86400); 
  let hours = Math.floor((timeLeft - (days * 86400)) / 3600);
  let mins = Math.floor((timeLeft - (days * 86400) - (hours * 3600 )) / 60);
  let seconds = Math.floor((timeLeft - (days * 86400) - (hours * 3600) - (mins * 60)));
  // console.log()
  if (hours < "10") { hours = "0" + hours; }
  if (mins < "10") { mins = "0" + mins; }
  if (seconds < "10") { seconds = "0" + seconds; }

  // $("#days").html(days + ":");
  $("#hours").text(hours +':');
  $("#mins").text(mins +':');
  $("#seconds").text(seconds)
  // console.log(typeof(hours),hours)   
  if (timeLeft <= 0 || (hours === '00' && mins === '00' && seconds === '00')){

    clearInterval(timex)
    console.log('calling the get-reason event')
    document.getElementById('hours').innerHTML = '00:'
    document.getElementById('mins').innerHTML = '00:'
    document.getElementById('seconds').innerHTML = '00'
    ipc.send('get-reason')
    document.getElementById("dropdown").style.display = "none";
    document.getElementById('timer').style.display = 'none';
    document.getElementById('pause').disabled = false;
    document.getElementById('resume').disabled = true;
    document.getElementById('confirm').disabled = false;
    document.getElementById('logout').disabled = false;
    return
  }
}

function startTimer(){
  timer_called = true
  timex = setInterval(function() { makeTimer(); }, 1000);
}


document.getElementById('logout').addEventListener('click', () => {
  ipc.send('get-uuid')
})


ipc.on('uuid-response',(event,arg) => {
  console.log("The uuid: ", arg)
  if (arg != null) {
    axios.post('https://hhq5nbplrb.execute-api.ap-south-1.amazonaws.com/v1/attendance/checkout', {
    'UUID': arg
  }).then((response) =>{
      console.log('logout',response)
      ipc.send('stopCapture','logout-event')
    }).catch((err) => {
      console.log('the error in logout section',err)
    })
  }
})