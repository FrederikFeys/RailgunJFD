const bleno = require("@abandonware/bleno");
const EventEmitter = require('events');

// Choose a concise name for your device
const PERIPHERAL_NAME = "railgunjfdjurne";

// UUID of a Battery Service following SIG
// https://www.bluetooth.com/wp-content/uploads/Sitecore-Media-Library/Gatt/Xml/Services/org.bluetooth.service.battery_service.xml
const BATTERY_SERVICE_UUID = "180F";

// UUID of a Battery Level following SIG
// https://www.bluetooth.com/wp-content/uploads/Sitecore-Media-Library/Gatt/Xml/Characteristics/org.bluetooth.characteristic.battery_level.xml
const BATTERY_LEVEL_CHARACTERISTIC_UUID = "2A19";

// Custom
const RAILGUN_COMMAND_SERVICE_UUID = "eac9cf2d-1d6e-4ab5-8582-bdc124b15e52";
const RAILGUN_CHARGE_CHARACTERISTIC_UUID = "b65a60ce-b0e9-43a3-a991-4a908a5705bc";
const RAILGUN_SHOOT_CHARACTERISTIC_UUID = "f17315d2-83e5-4f5e-9893-216ab8c5d9d6";

class RailGun extends EventEmitter {
  constructor() {
    super();
    this.batteryLevel = 100;
    
    setInterval(() => {
      this.use_power(1);
    }, 60000);
  }

  fire() {
    if (this.batteryLevel >= 10) {
      this.use_power(10);
      console.log(`Cannon goes boom (${this.batteryLevel}% power left)`);
    } else {
      console.log(`Cannon goes pffff - sorry out of power (${this.batteryLevel}% power left)`);
    }
  }

  use_power(percentage) {
    if (this.batteryLevel >= percentage) {
      this.batteryLevel -= percentage;
      this.emit('batteryLevelChanged', {'battery_level': this.batteryLevel});
    }
  }

  battery_level() {
    return this.batteryLevel;
  }

  charge(deltaPercentage) {
    this.batteryLevel = Math.min(100, this.batteryLevel + deltaPercentage);
    this.emit('batteryLevelChanged', {'battery_level': this.batteryLevel});
  }
}

class RailgunChargeCharacteristic extends bleno.Characteristic {
    constructor(railgun) {
        super({
            uuid: RAILGUN_CHARGE_CHARACTERISTIC_UUID,
            properties: ["write"],
            value: null,
            descriptors: [
                new bleno.Descriptor({
                    uuid: "2901",
                    value: "Charge Railgun"
                  })
            ]
        });

        this.railgun = railgun;
    }

    onWriteRequest(data, offset, withoutResponse, callback) {
        try {
            if(data.length != 1) {
                callback(this.RESULT_INVALID_ATTRIBUTE_LENGTH);
                return;
            }

            let value = data.readUInt8();
            console.log(`Received command to charge railgun: ${value}`);
            this.railgun.charge(value);
            callback(this.RESULT_SUCCESS);
        } catch (err) {
            console.error(err);
            callback(this.RESULT_UNLIKELY_ERROR);
        }
    }
}
let hugeCannon = new RailGun;
class RailgunShootCharacteristic extends bleno.Characteristic {
    constructor(railgun) {
        super({
            uuid: RAILGUN_SHOOT_CHARACTERISTIC_UUID,
            properties: ["write"],
            value: null,
            descriptors: [
                new bleno.Descriptor({
                    uuid: "2901",
                    value: "Shooting Railgun"
                  })
            ]
        });

        this.railgun = railgun;
    }

    onWriteRequest(data, offset, withoutResponse, callback) {
        try {
            if(data.length != 1) {
                callback(this.RESULT_INVALID_ATTRIBUTE_LENGTH);
                return;
            }

            let value = data.readUInt8();
            console.log(`Received command to shoot railgun: ${value}`);
            this.railgun.fire();
            callback(this.RESULT_SUCCESS);
        } catch (err) {
            console.error(err);
            callback(this.RESULT_UNLIKELY_ERROR);
        }
    }
}
class BatteryLevelCharacteristic extends bleno.Characteristic {
  constructor(railgun) {
    super({
      uuid: BATTERY_LEVEL_CHARACTERISTIC_UUID,
      properties: ["read", "notify"],
      value: null,
      descriptors: [
        new bleno.Descriptor({
          uuid: "2901",
          value: "Battery Level"
        })
      ]
    });

    this.railgun = railgun;
  }

  onReadRequest(offset, callback) {
    try {
      const level = this.railgun.battery_level();
      console.log(`Returning battery level of: ${level}%`);

      let data = Buffer.alloc(1);   // Single byte
      data.writeUInt8(level, 0);
      callback(this.RESULT_SUCCESS, data);
    } catch (err) {
      console.error(err);
      callback(this.RESULT_UNLIKELY_ERROR);
    }
  }

  onSubscribe(maxValueSize, updateValueCallback) {
    console.log(`Client subscribed to battery level`);
    this.updateValueCallback = updateValueCallback;
    this.railgun.on('batteryLevelChanged', (event) => this.sendNotification(event.battery_level));
  }

  onUnsubscribe() {
    console.log("Client unsubscribed to battery level");
    this.updateValueCallback = null;
  }

  sendNotification(level) {
    if(this.updateValueCallback) {
      console.log(`Sending notification with battery level of: ${level}%`);

      let data = Buffer.alloc(1);   // Single byte
      data.writeUInt8(level, 0);
      this.updateValueCallback(data);
    }
  }
}

console.log("Starting bleno ...");

bleno.on("stateChange", state => {
  if (state === "poweredOn") {
    bleno.startAdvertising(PERIPHERAL_NAME, [BATTERY_SERVICE_UUID], err => {
      if (err) console.log(err);
    });
  } else {
    console.log("Stopping ...");
    bleno.stopAdvertising();
  }
});

bleno.on("advertisingStart", err => {
  console.log("Configuring services ...");
  
  if(err) {
      console.error(err);
      return;
  }

  let batteryService = new bleno.PrimaryService({
      uuid: BATTERY_SERVICE_UUID,
      characteristics: [
        new BatteryLevelCharacteristic(hugeCannon)
      ]
  });

  let commandService = new bleno.PrimaryService({
      uuid: RAILGUN_COMMAND_SERVICE_UUID,
      characteristics: [
          new RailgunChargeCharacteristic(hugeCannon),
          new RailgunShootCharacteristic(hugeCannon)
      ]
  });

  bleno.setServices([batteryService, commandService], err => {
    if(err) console.log(err);
    else console.log("Services configured");
  });
});

// Some diagnostics
bleno.on("stateChange", state => console.log(`Bleno: Adapter changed state to ${state}`));
bleno.on("advertisingStart", err => console.log("Bleno: advertisingStart"));
bleno.on("advertisingStartError", err => console.log("Bleno: advertisingStartError"));
bleno.on("advertisingStop", err => console.log("Bleno: advertisingStop"));
bleno.on("servicesSet", err => console.log("Bleno: servicesSet"));
bleno.on("servicesSetError", err => console.log("Bleno: servicesSetError"));
bleno.on("accept", clientAddress => console.log(`Bleno: accept ${clientAddress}`));
bleno.on("disconnect", clientAddress => console.log(`Bleno: disconnect ${clientAddress}`));
