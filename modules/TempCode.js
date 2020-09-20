// if (child_obj.windowData != undefined) {
//   if (
//     child_obj.windowData.title === undefined ||
//     child_obj.windowData.title === ""
//   ) {
//     if (windowCodeObj[child_obj.windowData.owner.name] === undefined) {
//       //New window found
//       windowCounter += 1;
//       windowCodeObj[child_obj.windowData.owner.name] = [
//         windowCounter,
//         child_obj.windowData,
//       ];
//       let temp_data = JSON.stringify(child_obj.windowData).replace(
//         /,/g,
//         " | "
//       );
//       let temp_title = child_obj.windowData.owner.name.replace(/,/g, " | ");
//       csvData = `${windowCounter},${temp_title},${temp_data}\n`;
//       wcode = windowCounter;
//     } else {
//       // Not a new window
//       wcode = windowCodeObj[child_obj.windowData.owner.name][0];
//     }
//   } else {
//     // window title is present
//     if (windowCodeObj[child_obj.windowData.title] === undefined) {
//       // New window found
//       windowCounter += 1;
//       windowCodeObj[child_obj.windowData.title] = [
//         windowCounter,
//         child_obj.windowData,
//       ];
//       let temp_data = JSON.stringify(child_obj.windowData).replace(
//         /,/g,
//         " | "
//       );
//       let temp_title = child_obj.windowData.title.replace(/,/g, " | ");
//       csvData = `${windowCounter},${temp_title},${temp_data}\n`;
//       wcode = windowCounter;
//     } else {
//       wcode = windowCodeObj[child_obj.windowData.title][0];
//     }
//   }
// } else {
//   //undefined winowData Desktop click
//   wcode = -1;
// }

// Writing to window.csv file
// if (csvData) {
//   fs.appendFile(window_file, csvData, function (err) {
//     if (err) {
//       writeLogs(
//         logsPath,
//         `error in main while writing to window.csv ${err}`
//       );
//       return console.log(err);
//     }
//   });

//   // Inserting the data into DB
//   try {
//     if (DB) {
//       let values = csvData.split(",");
//       values[0] = parseInt(values[0]);
//       console.log("The values: ", values);
//       insertWindowData(DB, values);
//     }
//   } catch (err) {
//     console.log("Error while inserting the data into window table: ", err);
//     writeLogs(
//       logsPath,
//       `Error while inserting the data into window table: ${err}`
//     );
//   }
// }

// console.log(
//   "each event ",
//   PrevEvent,
//   PrevWindowCode,
//   "current status",
//   Object.keys(child_obj)[0],
//   wcode
// );

// Updating the vars
// if (PrevEvent != Object.keys(child_obj)[0] || wcode != PrevWindowCode) {
//   if (wcode != PrevWindowCode) {
//     windowIdleTime = idleTime;
//     idleTime = 0;
//   }
//   rowString += `${windowIdleTime},`;
//   //write file
//   fs.appendFile(event_file, `${rowString}\n`, function (err) {
//     if (err) {
//       writeLogs(
//         logsPath,
//         `error during writing the start capture time to events.csv`
//       );
//     }
//   });

//   // Inserting into the event DB
//   let values;
//   let row_data = rowString.split(",");
//   let delay_string = "";
//   if (row_data.length > 3) {
//     delay_string = row_data.slice(2, row_data.length - 2).toString();
//   }
//   if (PrevEvent === "startCapture") {
//     values = [parseInt(row_data[0]), 0, "start", 0, "", 0];
//   } else if (PrevEvent === "mouseData") {
//     let event_count = row_data.length - 2;
//     values = [
//       parseInt(row_data[0]),
//       parseInt(row_data[1]),
//       "mouse-click",
//       event_count,
//       delay_string,
//       parseInt(row_data[row_data.length - 2]),
//     ];
//   } else {
//     let event_count = row_data.length - 2;
//     values = [
//       parseInt(row_data[0]),
//       parseInt(row_data[1]),
//       `key-stroke - ${firstKeyCode}`,
//       event_count,
//       delay_string,
//       parseInt(row_data[row_data.length - 2]),
//     ];
//   }

//   try {
//     if (DB) insertEventData(DB, values);
//     else writeLogs(logsPath, "DB is null while inserting into events");
//   } catch (err) {
//     console.log("Error while inserting into event table ", err);
//     writeLogs(logsPath, `Error while inserting into event table ${err}`);
//   }

//   // currentTimeStamp = child_obj.timeStamp
//   rowString = `${child_obj.timeStamp},${wcode},`;
//   if (child_obj.keystrokeData) {
//     firstKeyCode = child_obj.keystrokeData.rawcode;
//     console.log(
//       "The first key stroke: ",
//       child_obj.keystrokeData.rawcode,
//       firstKeyCode
//     );
//   }
// } else {
//   if (PrevEvent === "mouseData") {
//     let delay = child_obj.timeStamp - PrevTimeStamp;
//     rowString += `${delay},`;
//   } else {
//     let delay = child_obj.timeStamp - PrevTimeStamp;
//     rowString += `${child_obj.keystrokeData.rawcode}:${delay},`;
//   }
// }
// PrevTimeStamp = child_obj.timeStamp;
// PrevEvent = Object.keys(child_obj)[0];
// PrevWindowCode = wcode;
