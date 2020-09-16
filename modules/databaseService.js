const sqlite3 = require("sqlite3").verbose();
const os = require("os");
const path = require("path");
const { writeLogs } = require("./logger");

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
                delays TEXT
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
      `INSERT INTO event ("timestamp", "wcode", "event_type", "event_count", "delays") VALUES(?, ?, ?, ?, ?)`,
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
