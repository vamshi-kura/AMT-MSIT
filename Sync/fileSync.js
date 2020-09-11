const level = require('level')
const s3sync = require('jac-s3-sync-aws')
const readdirp = require('readdirp')
const path = require('path')
const os = require('os')
const fs = require('fs')
const keys = require('../Aws/keys')
const { writeLogs } = require('../modules/logger')


module.exports = function syncData(googleId, logsPath) {
  // building the output.json directory
  let home = os.homedir()
  let outputJsonPath = path.join(home, 'godseye')
  // outputJsonPath = 'D:\\GodsEye\\Godseye\\Data'
  console.log("The output json path: ", outputJsonPath)

  // Check for cache directory
  let cacheDir = path.join(outputJsonPath, 'cache')
  console.log("Testing the cache dir path: ", cacheDir)
  console.log("Testing if the cache exists: ", fs.existsSync(cacheDir))
  if (!fs.existsSync(cacheDir)){
    try {
        fs.mkdirSync(cacheDir, {recursive: true})
    } catch(error) {
      console.log('facing issue during the file create', error)
      if (logsPath) {
        writeLogs(logsPath, `facing issue during the file create ${error}`)
      }
    }
  }
  var db = level(path.join(outputJsonPath, 'cache'))
  // console.log('The db name: ', db)
  var files = readdirp(outputJsonPath,
  {
    directoryFilter: ['!.git', '!cache'],
    fileFilter: ['*output.json']
  }
  )
  // console.log("The DB: ", files)
  // Takes the same options arguments as `aws-sdk`,
  // plus some additional options listed above
  var uploader = s3sync(db, {
      key: keys.aws.key
    , secret: keys.aws.secret
    , bucket: 'godseye'
    , concurrency: 16
  }).on('data', function(file) {
    console.log(file.fullPath + ' -> ' + file.url)
    if (logsPath) {
      writeLogs(logsPath, `${file.fullPath} -> ${file.url}`)
    }
  })
  .on('end', () => {
    console.log("End in sync")
    db.close()
  })
  .on('error', (error) => {
    console.log("Error in file sync", error)
    if (logsPath) {
      writeLogs(logsPath, `Error in file sync: ${error}`)
    }
  })
  .on('warn', (war) => {
    console.log("Waing: ", war)
    if (logsPath) {
      writeLogs(logsPath, `waring in file sync: ${war}`)
    }
  })
  .on('fail', (response) => {
    console.log("Failed in sync: ", response)
    if (logsPath) {
      writeLogs(logsPath, `Error in file sync: ${response}`)
    }
  })
  files.pipe(uploader)
}