const fs = require("node:fs");
const readline = require("readline");
const spawn = require("child_process").spawn;
var cron = require('node-cron');
const http = require("node:http")

let isChecking = false;

async function processLineByLine(filePath) {
  const fileStream = fs.createReadStream(filePath);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  // Note: we use the crlfDelay option to recognize all instances of CR LF
  // ('\r\n') in input.txt as a single line break.

  const lines = [];
  for await (const line of rl) {
    lines.push(line);
  }

  return lines;
}

const spawnTest = async (url) => {
  fs.chmodSync(`./lite/lite`,0o777)
  // spawn(`bash -c "chmod 777 ${__dirname}/lite/lite"`);
  let ls = spawn(`bash -c "${__dirname}/lite/lite --config config.json --test ${url}"`, { shell: true, cwd: __dirname + "/lite" });
  ls.on("error", function (err) {
    console.log("ls error", err);
  });

  ls.stdout.on("data", function (data) {
    console.log("stdout: " + data);
  });

  ls.stderr.on("data", function (data) {
    console.log('stderr: ' + data);
  });

  ls.on("close", function (code) {
    console.log("child process exited with code " + code + ` , url : ${url}`);
    if (code == 0) {
      const result = fs.readFileSync(__dirname + "/lite/output.txt", "utf-8");
      fs.writeFileSync("./proxies.txt", result, { flag: "a" }, (error) => {
        if (error) {
          console.log(error);
        } else {
          console.log("File written");
        }
      });
    } else {
      console.log("rejected")
    }
  });
};

async function getNodes() {
  isChecking = true;
  fs.writeFile("./proxies.txt", "", (error) => {
    if (error) {
      console.log(error);
    } else {
      console.log("proxies Empty!");
    }
  });
  const urls = await processLineByLine("./nodes.txt");

  console.log(urls);

  for (const url of urls) {
    console.log("checking -> " + url);
    await spawnTest(url);
  }
  isChecking = false;
}

getNodes();
cron.schedule('*/30 * * * *', () => {
  if(isChecking == false){
    getNodes();
  }
});

const server = http.createServer((req,res)=>{
  res.writeHead(200,{"Content-Type" : "text/plain"})
  const data = fs.readFileSync("./proxies.txt","utf-8");
  res.end(data)
})

server.listen(80,()=>{
  console.log("http running on port 80");
})