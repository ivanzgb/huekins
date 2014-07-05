#!/usr/bin/env node

var hue = require("node-hue-api"),
    jenkinsapi = require('jenkins-api'),
    opts = require("nomnom")
      .option('hueIp',    { abbr: 'i', full: 'hue-ip', required: true, help: 'HUE bridge IP'})
      .option('hueUser',  { abbr: 'u', full: 'hue-user', default: 'newdeveloper', help: 'HUE API user'})
      .option('hueGroup', { abbr: 'g', full: 'hue-group', default: 0, help: 'HUE group ID'})
      .option('jenkins',  { abbr: 'j', default: 'http://localhost:8080/', help: 'Jenkins URL'})
      .option('job',      { abbr: 'b', required: true, help: 'Jenkins job name'})
      .parse();


var HUE_IP = opts.hueIp,
    HUE_USERNAME = opts.hueUser,
    HUE_GROUP = opts.hueGroup,
    JENKINS = opts.jenkins,
    JOB = opts.job;


var HueApi = hue.HueApi,
    lightState = hue.lightState,
    api = new HueApi(HUE_IP, HUE_USERNAME),
    jenkins = jenkinsapi.init(JENKINS);


var State = {
  BUILDING: 'building',
  SUCCESS:  'success',
  FAILED:   'failed',
  UNSTABLE: 'unstable',
  UNKNOWN:  'unknown'
};

var lastState = State.UNKNOWN;

function check() {
  jenkins.job_info(JOB, function(err, job) {
    if (err){ return console.log('JENKINS ERROR:', err); }
    //console.log("job info: ", job);

    var state = jobToState(job);
    if (state !== lastState) {
      console.log('New state:', state);
      var light = stateToLight(state);
      if (light) {
        api.setGroupLightState(HUE_GROUP, light)
          .then(displayResult).done();
      }
      lastState = state;
    }
  });  
}

function stateToLight(state) {
  var ls = lightState.create().on();
  switch (state) {
    case State.BUILDING: return ls.hsl(240, 100, 100).alert(true); // blue
    case State.SUCCESS:  return ls.hsl(120, 100, 100).alert();     // green
    case State.UNSTABLE: return ls.hsl( 60, 100, 100).alert();     // yellow
    case State.FAILED:   return ls.hsl(  0, 100, 100).alert(true); // red
    default: return lightState.create().off();
  }
}

function jobToState(job) {
  if (job.activeConfigurations) {
    var confs = job.activeConfigurations;
    for (var i = 0; i < confs.length; i++) {
      var conf = confs[i], confState = colorToState(conf.color);
      //console.log(' Configuration:', conf.name, conf.color, confState);
      if (confState === State.FAILED) {
        //console.log(' ', conf.name, '-->', conf.color);
        return confState;
      }
    }
  }
  return colorToState(job.color);
}

function colorToState(color) {
  switch (color) {
    case 'green_anime':
    case 'blue_anime':
    case 'red_anime':
    case 'yellow_anime':
    case 'aborted_anime':
      return State.BUILDING;
    case 'green':
    case 'blue':
      return State.SUCCESS;
    case 'red':
      return State.FAILED;
    case 'yellow':
      return State.UNSTABLE;
    default:
      return State.UNKNOWN;
  }
}

function displayResult(result) {
  console.log('Hue updated: ', JSON.stringify(result, null, 2));
};

setInterval(check, 5000);
check();
