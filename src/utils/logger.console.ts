import env from "@/config/env";
const fs = require('fs');

const path = `${env.CONSOLE_LOG_FILE || "logs"}/${new Date().getFullYear()}/${new Date().getMonth() + 1}/whatsapp`;
if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true });
}
const outputFile = `${path}/console.log`;
const errorFile = `${path}/console.error.log`;
const outputLog = fs.createWriteStream(outputFile,{flags: 'a'});
const errorsLog = fs.createWriteStream(errorFile,{flags: 'a'});

console.log = function (message: any) {
    outputLog.write(`${new Date().toISOString()} | ${message} \n`);
}

console.error = function (message) {
    errorsLog.write(`${new Date().toISOString()} | ${message} \n`);
}