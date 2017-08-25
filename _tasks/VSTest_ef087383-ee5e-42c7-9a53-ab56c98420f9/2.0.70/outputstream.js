"use strict";
const stream = require('stream');
const os = require('os');
const tl = require('vsts-task-lib/task');
class StringErrorWritable extends stream.Writable {
    constructor(options) {
        super(options);
        this.value = '';
    }
    _write(data, encoding, callback) {
        this.value += data;
        let errorString = data.toString();
        let n = errorString.indexOf(os.EOL);
        while (n > -1) {
            const line = errorString.substring(0, n);
            tl.error(line);
            // the rest of the string ...
            errorString = errorString.substring(n + os.EOL.length);
            n = errorString.indexOf(os.EOL);
        }
        if (callback) {
            callback();
        }
    }
    toString() {
        return this.value;
    }
}
exports.StringErrorWritable = StringErrorWritable;
;
