const sqlite3 = require('sqlite3');

const db = new sqlite3.Database('./tradingportfolio.db');

if(!db){
  console.log("Error connecting to the database");
} else{
  console.log("Connected to the database");
}

module.exports = db;