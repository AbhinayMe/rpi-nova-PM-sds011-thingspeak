require('dotenv').config({ path: `${__dirname}/.env` });
const moment = require('moment');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const SDS011Wrapper = require('sds011-wrapper');

// Open sensor with Serial port path
// Replace with the correct port for the SDS011 sensor on your Raspberry Pi
const sensor = new SDS011Wrapper('/dev/ttyUSB0');

// Set reporting mode. This setting is still effective after power off.
// Set the SDS011 sensor to 'active'/'query' mode
sensor.setReportingMode('query');

// Set working period of the sensor. This setting is still effective after power off.
// (optional) Working time (0 - 30 minutes). Sensor will continuously work when set to 0.
// sensor.setWorkingPeriod(0);

// Switch to sleep mode and back. Fan and laser will be turned off while in sleep mode.
// Any command will wake the device - however this was not documented.
// sensor.setSleepSetting(true);

// sensor.on('measure', (streamData) => {
//   publishAirQualityData(streamData);
// });

// Get the current date and time
const dateTimeStamp = moment()
  .utcOffset('+08:00') // Kuala Lumpur timezone
  .format('YYYY-MM-DD_HH:mm:ss'); // Date and time format
console.log(
  `Saved file path: /home/pi/Documents/data/AirQualityData_${dateTimeStamp}.csv`
);

// Create a CSV file to store the air quality data
const csvWriter = createCsvWriter({
  // auto creation of the filename with the current date
  path: `/home/pi/Documents/data/AirQualityData_${dateTimeStamp}.csv`,
  header: [
    { id: 'timestamp', title: 'Timestamp' },
    { id: 'pm2.5', title: 'PM2.5' },
    { id: 'pm10', title: 'PM10' },
  ],
});

requestData(20); // Request data each 15 seconds (Free version recommends 15 seconds)

// Request data from the sensor every @secondsParam seconds
function requestData(secondsParam) {
  setInterval(() => {
    console.log('Querying...');

    // Data will be received only when requested.
    // Keep in mind that sensor (laser & fan) is still continuously working because working period is set to 0.
    sensor.query().then((data) => {
      console.log(`Received: ` + JSON.stringify(data));
      publishAirQualityData(data);
    });
  }, secondsParam * 1000);
}

// Publish air quality data to the console, CSV file and ThingSpeak
const publishAirQualityData = async (streamData) => {
  const timestamp = moment()
    .utcOffset('+08:00') // Kuala Lumpur timezone
    .format('YYYY-MM-DD HH:mm:ss'); // Date and time format

  // Log the data to the console
  console.log(`${timestamp} 
  PM2.5 : ${streamData['PM2.5']},
  PM10  : ${streamData['PM10']}`);

  // Save data to CSV file
  const records = [
    {
      timestamp: timestamp,
      'pm2.5': streamData['PM2.5'],
      pm10: streamData['PM10'],
    },
  ];

  // Write data to CSV file
  csvWriter.writeRecords(records).then(() => {
    console.log('Done... Saved data to CSV file.');
  });

  // Save data to ThingSpeak
  const requestOptions = {
    method: 'GET',
    redirect: 'follow',
  };

  fetch(
    `https://api.thingspeak.com/update?api_key=${process.env.API_KEY_WRITE}&field1=${streamData['PM2.5']}&field2=${streamData['PM10']}`,
    requestOptions
  )
    .then((response) => response.text())
    .then((result) => console.log(result))
    .catch((error) => console.log('error', error));
};
