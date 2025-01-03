import env from "@/config/env";
const fs = require('fs')
const outputLog = fs.createWriteStream(env.CONSOLE_LOG_FILE || "logs/console.log");
const errorsLog = fs.createWriteStream(env.CONSOLE_LOG_FILE || "logs/console.error.log");

console.log = function (message: any) {
    outputLog.write(`${new Date().toISOString()} | ${message} \n`);
}

console.error = function (message) {
    errorsLog.write(`${new Date().toISOString()} | ${message} \n`);
}