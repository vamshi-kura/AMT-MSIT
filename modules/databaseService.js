const sqlite3 = require("sqlite3").verbose();
const { rejects } = require("assert");
const os = require("os");
const { resolve } = require("path");
const path = require("path");
const { promise } = require("readdirp");
const { writeLogs } = require("./logger");
// const Promise = require("bluebird");

let homePath = path.join(os.homedir(), "godseye");

// function to create database
exports.createDatabase = () => {
  let db = new sqlite3.Database(`${homePath}\\dbFile`);
  return db;
};

// Function to add window table
exports.createWindowTable = (db) => {
  db.serialize(() => {
    db.prepare(
      `CREATE TABLE IF NOT EXISTS window (
            wcode INTEGER PRIMARY KEY,
            window_title TEXT,
            object TEXT
        );`
    )
      .run()
      .finalize();
  });
};

// Function to add event table
exports.createEventTable = (db) => {
  db.serialize(() => {
    db.prepare(
      `CREATE TABLE IF NOT EXISTS event (
                timestamp INTEGER,
                wcode INTEGER,
                event_type TEXT,
                event_count INTEGER,
                delays TEXT,
                idle_time INTEGER
            );`
    )
      .run()
      .finalize();
  });
};

// Function to add Report table
exports.createReportTable = (db) => {
  db.serialize(() => {
    db.prepare(
      `CREATE TABLE IF NOT EXISTS report (
        event_name TEXT,
        event_id INTEGER,
        event_details TEXT,
        window_details TEXT
      );`
    )
      .run()
      .finalize();
  });
};

// Function to insert data into window table
exports.insertWindowData = (db, values) => {
  db.serialize(() => {
    db.run(
      `INSERT INTO window ("wcode", "window_title", "object") VALUES(?, ?, ?)`,
      values,
      (err) => {
        if (err) {
          console.log("Error while inserting into Database: ", err);
          writeLogs(homePath, err);
        }
      }
    );
  });
};

// Function to insert data into event table
exports.insertEventData = (db, values) => {
  db.serialize(() => {
    db.run(
      `INSERT INTO event ("timestamp", "wcode", "event_type", "event_count", "delays", "idle_time") VALUES(?, ?, ?, ?, ?, ?)`,
      values,
      (err) => {
        if (err) {
          console.log("Error while inserting into Database: ", err);
          writeLogs(homePath, err);
        }
      }
    );
  });
};

// Function to insert data into Report
exports.insertReportData = (db, values) => {
  db.serialize(() => {
    let insertStatement = `INSERT INTO report ("event_name", "event_id", "event_details", "window_details") VALUES (?,?,?,?)`;
    db.run(insertStatement, values, (err) => {
      if (err) {
        console.log("Error while inserting into Database: ", err);
        writeLogs(homePath, err);
      }
    });
  });
};

// Function to query data from table
exports.queryReportData = (db, startTime, endTime) => {
  let eventStatement = `SELECT * FROM event WHERE timestamp BETWEEN ${startTime} AND ${endTime}`;
  let windowStatement = `SELECT * FROM window WHERE wcode IN (SELECT wcode FROM event WHERE timestamp BETWEEN ${startTime} AND ${endTime})`;
  let returnObject = {};
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // event query
      db.all(eventStatement, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          console.log("The event data in the DB file: ", rows);
          returnObject["event"] = rows;
        }
      });

      // window query
      db.all(windowStatement, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          console.log("The winodw in DB file: ", rows);
          returnObject["window"] = rows;
          console.log("The return object: ", returnObject);
          resolve(returnObject);
        }
      });
    });
  });
};
