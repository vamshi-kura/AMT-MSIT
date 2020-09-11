// This module is to write the logs of the user
const fs = require('fs')
const pathModule = require('path')


exports.writeLogs = (path, data) => {
    const file = pathModule.join(path, 'userLogs.txt')
    // console.log("Inside the logger")
    data = `${data}\n`
    fs.appendFile(file, data, function (err) {
        if (err) console.log("Error during writing the logs")
    })
}

// // To write to attendance
exports.attendanceLog = (path, data) => {
    const file = pathModule.join(path, 'attendanceLog.json')
    console.log("Inside the logger")
    data = `${data}\n`
    console.log('The data inside the attendance log: ', data)
    fs.writeFile(file, data, function (err) {
        if (err) console.log("Error during writing the logs")
    })
}