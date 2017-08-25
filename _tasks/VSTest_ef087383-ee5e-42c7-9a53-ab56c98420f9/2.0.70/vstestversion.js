"use strict";
class VSTestVersion {
    constructor(vstestExeLocation, majorVersion, minorversion, patchNumber) {
        this.vstestExeLocation = vstestExeLocation;
        this.majorVersion = majorVersion;
        this.minorversion = minorversion;
        this.patchNumber = patchNumber;
    }
    isTestImpactSupported() {
        return (this.majorVersion >= 15);
    }
    vstestDiagSupported() {
        return (this.majorVersion >= 15);
    }
    isPrivateDataCollectorNeededForTIA() {
        return false;
    }
    isRunInParallelSupported() {
        return (this.majorVersion >= 15);
    }
}
exports.VSTestVersion = VSTestVersion;
class Dev14VSTestVersion extends VSTestVersion {
    constructor(runnerLocation, minorVersion, patchNumber) {
        super(runnerLocation, 14, minorVersion, patchNumber);
    }
    isTestImpactSupported() {
        return (this.patchNumber >= 25420);
    }
    isRunInParallelSupported() {
        return (this.patchNumber >= 25420);
    }
    isPrivateDataCollectorNeededForTIA() {
        return true;
    }
}
exports.Dev14VSTestVersion = Dev14VSTestVersion;
class Dev15VSTestVersion extends VSTestVersion {
    constructor(runnerLocation, minorVersion, patchNumber) {
        super(runnerLocation, 15, minorVersion, patchNumber);
    }
    isTestImpactSupported() {
        return (this.patchNumber >= 25727);
    }
    vstestDiagSupported() {
        return (this.patchNumber > 25428);
    }
}
exports.Dev15VSTestVersion = Dev15VSTestVersion;
