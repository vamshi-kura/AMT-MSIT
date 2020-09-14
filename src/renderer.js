// Importing the electron modules
const electron = require("electron");
const ipc = electron.ipcRenderer;
const axios = require("axios").default;
const fs = require("fs");
let loginSuccess = false;
let timeOutRef;

// Getting the app version
ipc.send("app_version");

ipc.on("app_version", (event, arg) => {
  console.log("The current app version: ", arg.version);
});

document.getElementById("Google-sign").addEventListener("click", () => {
  console.log("Sign in clicked");
  // Axios call to get the JWT JWT_Token
  axios
    .get("https://hhq5nbplrb.execute-api.ap-south-1.amazonaws.com/v1/login")
    .then((response) => {
      const data = response.data;
      console.log("The new JWT: ", response.data);
      ipc.send("loginClicked", data);
    });

  timeOutRef = setTimeout(() => {
    console.log("Calling the time out function: ");
    if (!loginSuccess) {
      console.log("User took long to login");
      ipc.send("secondCallFailure", "Login TL Reached");
    } else {
      clearTimeout(timeOutRef);
    }
  }, 120000);
});

ipc.on("secondCall", (event, arg) => {
  console.log("The arg passed: ", arg);
  console.log("second call event captured");
  axios
    .post(
      "https://hhq5nbplrb.execute-api.ap-south-1.amazonaws.com/v1/getgoogleresponse",
      {
        UUID: arg,
      }
    )
    .then((response) => {
      console.log("The res: ", response.data.statusCode);
      if (response.data.body) {
        console.log(
          "Inside the if case in renderer",
          response.data.body.googleId,
          response.data.body.profileObj.givenName
        );
        loginSuccess = true;
        ipc.send("secondCallSuccess", {
          googleID: response.data.body.googleId,
          userName: response.data.body.profileObj.givenName,
          email: response.data.body.profileObj.email,
        });
        ipc.send("startCapture");
      }
    })
    .catch((error) => {
      console.log("Error in second call: ", error);
      ipc.send("secondCallFailure", error);
    });
});

ipc.on("clearTimeout", (event) => {
  console.log("Clearing the time out for Time limit check");
  if (timeOutRef) {
    clearTimeout(timeOutRef);
  }
});

// The update available event
ipc.on("update-available", (event, arg) => {
  console.log("The update available: ", arg);
  alert("Update available please close the app and start again after download");
});

ipc.on("update-downloaded", (event, arg) => {
  console.log("The update downloaded event");
  alert("Update downloaded");
});
