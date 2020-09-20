const { queryReportData, insertReportData } = require("./databaseService");
const axios = require("axios").default;
const { writeLogs } = require("./logger");
const path = require("path");
const os = require("os");

let logsPath = path.join(os.homedir(), "godseye");

// The function to send the report to AWS
const sendData = (data, startTime, endTime) => {
  let counter = 0;
  let interval = setInterval(() => {
    console.log("Calling the Interval: ", counter);
    if (counter == 5) {
      // Report data storing
      writeLogs(
        logsPath,
        `Not able to send report to cloud for the event ${new Date(
          startTime
        )} ${new Date(endTime)}`
      );
      clearInterval(interval);
      return;
    } else {
      axios
        .post(
          "https://rzjs1edixg.execute-api.ap-south-1.amazonaws.com/AMT-Report_dev",
          {
            reportData: data,
          }
        )
        .then((response) => {
          console.log("Post call was successfull: ", response);
          clearInterval(interval);
        })
        .catch((err) => {
          console.log("Exception in post call: ", err);
          counter++;
        });
    }
  }, 30000);
};

exports.generateReport = async (db, startTime, endTime) => {
  console.log("In report");
  let requestCounter = 0;
  await queryReportData(db, startTime, endTime)
    .then((response) => {
      console.log("The rows data in report file: ", response);
      sendData(response, startTime, endTime);
    })
    .catch((err) => {
      console.log("Error in report file: ", err);
      writeLogs(logsPath, `Error while fetching the data from the DB ${err}`);
    });
};
